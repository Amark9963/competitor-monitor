"""Render the run's insights as a Markdown report and optionally post to Slack."""

from __future__ import annotations

import json
import logging
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from .analyze import ExecutiveSummary, Insight
from .config import CompetitorConfig

log = logging.getLogger(__name__)

_CATEGORY_LABELS = {
    "new_feature": "New feature",
    "product_update": "Product update",
    "pricing_change": "Pricing change",
    "business_change": "Business change",
    "partnership_or_integration": "Partnership / integration",
    "content_or_marketing": "Content / marketing",
    "hiring_or_team": "Hiring / team",
    "other": "Other",
}
_SIG_ICON = {"high": "🔴", "medium": "🟡", "low": "⚪"}
_SIG_ORDER = {"high": 0, "medium": 1, "low": 2}


def render_markdown(
    run_id: int,
    company_name: str,
    competitors: list[CompetitorConfig],
    insights_by_slug: dict[str, list[Insight]],
    executive: ExecutiveSummary | None,
    pages_scanned: dict[str, int],
    changes_found: dict[str, int],
    notes: dict[str, str],
    analysis_skipped: bool = False,
) -> str:
    date = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    total = sum(len(v) for v in insights_by_slug.values())
    high = sum(1 for v in insights_by_slug.values() for i in v if i.significance == "high")

    out: list[str] = [
        f"# {company_name} — Competitor Intelligence Report",
        f"_Run #{run_id} · {date} · {total} insight(s), {high} high-significance_\n",
    ]

    if executive:
        out += [
            "## Executive summary",
            f"**{executive.headline}**\n",
            executive.summary.strip(),
            "",
        ]
        if executive.watch_list:
            out.append("**Watch list**")
            out += [f"- {w}" for w in executive.watch_list]
            out.append("")
    elif analysis_skipped:
        n = sum(changes_found.values())
        out.append(f"_AI analysis was skipped for this run; {n} change(s) recorded for later review._\n")
    elif total == 0:
        out.append("_No meaningful changes were detected across monitored competitors this run._\n")

    out.append("## Coverage")
    out.append("| Competitor | Pages scanned | Changes detected | Insights |")
    out.append("|---|---:|---:|---:|")
    for c in competitors:
        note = notes.get(c.slug)
        out.append(
            f"| {c.name} | {pages_scanned.get(c.slug, 0)} | {changes_found.get(c.slug, 0)} "
            f"| {len(insights_by_slug.get(c.slug, []))}{' — ' + note if note else ''} |"
        )
    out.append("")

    for c in competitors:
        insights = sorted(insights_by_slug.get(c.slug, []), key=lambda i: _SIG_ORDER[i.significance])
        if not insights:
            continue
        out.append(f"## {c.name}")
        for i in insights:
            out.append(f"### {_SIG_ICON[i.significance]} {i.title}")
            out.append(f"_{_CATEGORY_LABELS[i.category]} · {i.significance} significance_\n")
            out.append(i.summary.strip() + "\n")
            out.append(f"**Implications for {company_name}:** {i.implications_for_us.strip()}\n")
            out.append(f"**Recommended action:** {i.recommended_action.strip()}\n")
            if i.evidence_urls:
                out.append("Evidence: " + " · ".join(f"<{u}>" for u in i.evidence_urls) + "\n")
    return "\n".join(out).rstrip() + "\n"


def write_report_file(reports_dir: Path, run_id: int, markdown: str) -> Path:
    reports_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M")
    path = reports_dir / f"{stamp}_run{run_id}.md"
    path.write_text(markdown, encoding="utf-8")
    (reports_dir / "latest.md").write_text(markdown, encoding="utf-8")
    return path


def post_to_slack(
    webhook_url: str,
    company_name: str,
    executive: ExecutiveSummary | None,
    insights_by_name: dict[str, list[Insight]],
    report_path: Path,
) -> None:
    """Post a compact digest: headline, high/medium insights, pointer to the full report."""
    lines = [f"*{company_name} — competitor intelligence digest*"]
    if executive:
        lines.append(f"> {executive.headline}")
    for name, insights in insights_by_name.items():
        notable = [i for i in insights if i.significance in ("high", "medium")]
        if not notable:
            continue
        lines.append(f"\n*{name}*")
        for i in sorted(notable, key=lambda i: _SIG_ORDER[i.significance]):
            link = f" (<{i.evidence_urls[0]}|source>)" if i.evidence_urls else ""
            lines.append(f"• {_SIG_ICON[i.significance]} {i.title}{link}")
    if len(lines) == 1 + (1 if executive else 0):
        lines.append("\nNo notable changes detected this run.")
    lines.append(f"\n_Full report: `{report_path.name}`_")

    body = json.dumps({"text": "\n".join(lines)}).encode("utf-8")
    req = urllib.request.Request(
        webhook_url, data=body, headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        if resp.status >= 300:
            log.warning("Slack webhook returned HTTP %s", resp.status)
        else:
            log.info("posted digest to Slack")
