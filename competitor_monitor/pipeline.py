"""Run orchestration: scrape → detect → analyze → report.

Shared by the CLI (``python -m competitor_monitor run``) and the web API
(``POST /api/runs``). Progress is written to the ``runs`` table so a UI can poll it.
"""

from __future__ import annotations

import json
import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone

import anthropic

from .analyze import Insight, analyze_competitor, write_executive_summary
from .config import CompetitorConfig, Config, Env
from .detect import Change, detect_changes
from .report import post_to_slack, render_markdown, write_report_file
from .scraper import scrape_competitor
from .storage import Store

log = logging.getLogger(__name__)


@dataclass
class RunOptions:
    competitors: list[str] | None = None  # slugs; None = all
    full: bool = False
    analyze: bool = True
    slack: bool = True


@dataclass
class RunResult:
    run_id: int
    markdown: str
    report_path: str
    insights_by_slug: dict[str, list[Insight]] = field(default_factory=dict)


def select_competitors(config: Config, slugs: list[str] | None) -> list[CompetitorConfig]:
    if not slugs:
        return list(config.competitors)
    wanted = set(slugs)
    chosen = [c for c in config.competitors if c.slug in wanted]
    missing = wanted - {c.slug for c in chosen}
    if missing:
        raise ValueError(f"unknown competitor slug(s): {', '.join(sorted(missing))}")
    return chosen


def run_pipeline(config: Config, env: Env, opts: RunOptions, run_id: int | None = None) -> RunResult:
    """Execute one monitoring run. If ``run_id`` is given the row already exists (created
    by the API so it can return the id immediately); otherwise a new run row is created."""
    competitors = select_competitors(config, opts.competitors)
    store = Store(env.db_path)
    if run_id is None:
        run_id = store.start_run("full" if opts.full else "changes")
    log.info("run #%d started (%d competitors, backend=%s)", run_id, len(competitors), config.scraper.backend)

    try:
        result = _execute(store, run_id, config, env, opts, competitors)
        store.finish_run(run_id, "succeeded")
        return result
    except Exception as exc:
        store.finish_run(run_id, "failed", error=f"{type(exc).__name__}: {exc}")
        raise
    finally:
        store.close()


def _execute(
    store: Store, run_id: int, config: Config, env: Env, opts: RunOptions,
    competitors: list[CompetitorConfig],
) -> RunResult:
    pages_scanned: dict[str, int] = {}
    changes_by_slug: dict[str, list[Change]] = {}
    notes: dict[str, str] = {}

    # 1. Scrape (competitors in parallel - each is an independent Apify run).
    store.set_progress(run_id, "scraping", f"Scraping {len(competitors)} competitor site(s)")

    def _scrape(c: CompetitorConfig):
        try:
            return c, scrape_competitor(c, config.scraper, env.apify_token), None
        except Exception as exc:  # noqa: BLE001 - keep going for the other competitors
            log.exception("[%s] scrape failed", c.slug)
            return c, [], str(exc)

    with ThreadPoolExecutor(max_workers=min(4, len(competitors)) or 1) as pool:
        scraped = list(pool.map(_scrape, competitors))

    # 2. Diff against stored state.
    store.set_progress(run_id, "detecting", "Comparing pages with previous state")
    for c, pages, error in scraped:
        pages_scanned[c.slug] = len(pages)
        if error:
            notes[c.slug] = "scrape failed"
            changes_by_slug[c.slug] = []
            continue
        if not pages:
            notes[c.slug] = "no pages returned"
            changes_by_slug[c.slug] = []
            continue
        had_baseline = store.has_baseline(c.slug)
        changes_by_slug[c.slug] = detect_changes(store, run_id, c, pages, config.detection, full=opts.full)
        if not had_baseline and not opts.full:
            notes[c.slug] = "baseline captured"

    # 3. Analyze with Claude.
    insights_by_slug: dict[str, list[Insight]] = {c.slug: [] for c in competitors}
    executive = None
    if not opts.analyze:
        log.info("analysis disabled for this run")
    else:
        client = anthropic.Anthropic()
        to_analyze = [(c, changes_by_slug[c.slug]) for c in competitors if changes_by_slug[c.slug]]
        for idx, (c, changes) in enumerate(to_analyze, 1):
            store.set_progress(run_id, "analyzing", f"Analyzing {c.name} ({idx}/{len(to_analyze)}, {len(changes)} change(s))")
            try:
                analysis = analyze_competitor(client, config.analysis, config.company, c, changes)
            except Exception as exc:  # noqa: BLE001
                log.exception("[%s] analysis failed", c.slug)
                notes[c.slug] = f"analysis failed: {type(exc).__name__}"
                continue
            insights_by_slug[c.slug] = analysis.insights
            for i in analysis.insights:
                store.add_insight(run_id, c.slug, {**i.model_dump(), "evidence_urls": json.dumps(i.evidence_urls)})
            if analysis.ignored_as_noise and analysis.ignored_as_noise.lower() != "none":
                log.info("[%s] noise skipped: %s", c.slug, analysis.ignored_as_noise)
        store.commit()

        if any(insights_by_slug.values()):
            store.set_progress(run_id, "summarizing", "Writing executive summary")
            by_name = {c.name: insights_by_slug[c.slug] for c in competitors if insights_by_slug[c.slug]}
            period = datetime.now(timezone.utc).strftime("%B %d, %Y")
            try:
                executive = write_executive_summary(client, config.analysis, config.company, by_name, period)
            except Exception:  # noqa: BLE001
                log.exception("executive summary failed; report will omit it")

    # 4. Report.
    store.set_progress(run_id, "reporting", "Rendering report")
    markdown = render_markdown(
        run_id, config.company.name, competitors, insights_by_slug, executive,
        pages_scanned, {k: len(v) for k, v in changes_by_slug.items()}, notes,
        analysis_skipped=not opts.analyze,
    )
    report_path = write_report_file(env.reports_dir, run_id, markdown)
    store.save_report(
        run_id,
        executive.headline if executive else "",
        markdown,
        executive_json=executive.model_dump_json() if executive else None,
    )
    store.commit()
    log.info("report written to %s", report_path)

    if env.slack_webhook_url and opts.slack:
        by_name = {c.name: insights_by_slug[c.slug] for c in competitors}
        try:
            post_to_slack(env.slack_webhook_url, config.company.name, executive, by_name, report_path)
        except Exception:  # noqa: BLE001
            log.exception("Slack post failed")

    return RunResult(run_id, markdown, str(report_path), insights_by_slug)
