"""HTTP API backing the dashboard (``python -m competitor_monitor serve``).

All endpoints live under /api so the Next.js dev server can proxy them without CORS.
"""

from __future__ import annotations

import json
import logging
import threading
from contextlib import asynccontextmanager
from typing import Iterator

from fastapi import Depends, FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from .config import Config, Env, load_config, load_env
from .pipeline import RunOptions, run_pipeline, select_competitors
from .storage import Store

log = logging.getLogger(__name__)

_run_lock = threading.Lock()
_active_thread: threading.Thread | None = None


@asynccontextmanager
async def _lifespan(app: FastAPI):
    env = load_env()
    Store(env.db_path).mark_stale_runs_failed()
    yield


app = FastAPI(title="Competitor Monitor API", lifespan=_lifespan)


# ---- dependencies ---------------------------------------------------------


def get_env() -> Env:
    return load_env()


def get_config() -> Config:
    return load_config()


def get_store(env: Env = Depends(get_env)) -> Iterator[Store]:
    store = Store(env.db_path)
    try:
        yield store
    finally:
        store.close()


def _row(r) -> dict:
    return dict(r) if r is not None else None


def _insight(r) -> dict:
    d = dict(r)
    d["evidence_urls"] = json.loads(d.get("evidence_urls") or "[]")
    return d


# ---- read endpoints -------------------------------------------------------


@app.get("/api/overview")
def overview(store: Store = Depends(get_store), config: Config = Depends(get_config)) -> dict:
    latest = store.list_runs(limit=1)
    latest_run = _row(latest[0]) if latest else None
    # The run the dashboard features: the most recent one that produced insights
    # (a baseline capture or a quiet day shouldn't blank the page).
    featured_run = _row(store.latest_run_with_insights())
    featured_report = _row(store.get_report(featured_run["id"])) if featured_run else None
    executive = (
        json.loads(featured_report["executive_json"])
        if featured_report and featured_report.get("executive_json") else None
    )

    page_counts = store.page_counts()
    all_time = {}
    for r in store.insight_stats():
        all_time.setdefault(r["competitor"], {"high": 0, "medium": 0, "low": 0})[r["significance"]] = r["n"]
    this_run = {}
    if featured_run:
        for r in store.insight_stats(featured_run["id"]):
            this_run.setdefault(r["competitor"], {"high": 0, "medium": 0, "low": 0})[r["significance"]] = r["n"]

    competitors = [
        {
            "slug": c.slug,
            "name": c.name,
            "domain": c.domain,
            "pages_tracked": page_counts.get(c.slug, 0),
            "insights_featured_run": this_run.get(c.slug, {"high": 0, "medium": 0, "low": 0}),
            "insights_all_time": all_time.get(c.slug, {"high": 0, "medium": 0, "low": 0}),
        }
        for c in config.competitors
    ]
    return {
        "company": config.company.name,
        "latest_run": latest_run,
        "featured_run": featured_run,
        "executive": executive,
        "competitors": competitors,
        "running": _row(store.running_run()),
    }


@app.get("/api/runs")
def list_runs(limit: int = Query(50, le=200), store: Store = Depends(get_store)) -> list[dict]:
    return [_row(r) for r in store.list_runs(limit=limit)]


@app.get("/api/runs/{run_id}")
def get_run(run_id: int, store: Store = Depends(get_store)) -> dict:
    run = store.get_run(run_id)
    if run is None:
        raise HTTPException(404, "run not found")
    report = _row(store.get_report(run_id))
    return {
        "run": _row(run),
        "report": report and {
            "markdown": report["markdown"],
            "executive": json.loads(report["executive_json"]) if report.get("executive_json") else None,
        },
        "insights": [_insight(r) for r in store.insights_for_run(run_id)],
        "changes": [_row(r) for r in store.changes_for_run(run_id)],
    }


@app.get("/api/changes/{change_id}")
def get_change(change_id: int, store: Store = Depends(get_store)) -> dict:
    row = store.get_change(change_id)
    if row is None:
        raise HTTPException(404, "change not found")
    return _row(row)


@app.get("/api/insights")
def list_insights(
    competitor: str | None = None,
    significance: str | None = None,
    category: str | None = None,
    run_id: int | None = None,
    limit: int = Query(100, le=500),
    store: Store = Depends(get_store),
) -> list[dict]:
    return [_insight(r) for r in store.list_insights(competitor, significance, category, run_id, limit)]


@app.get("/api/competitors")
def list_competitors(store: Store = Depends(get_store), config: Config = Depends(get_config)) -> list[dict]:
    return [
        {
            "slug": c.slug,
            "name": c.name,
            "domain": c.domain,
            "configured_pages": [{"url": str(p.url), "type": p.type, "depth": p.depth} for p in c.pages],
            "tracked_pages": [_row(r) for r in store.pages_for_competitor(c.slug)],
        }
        for c in config.competitors
    ]


@app.get("/api/status")
def status(store: Store = Depends(get_store)) -> dict:
    running = store.running_run()
    return {"running": _row(running)}


# ---- trigger a run --------------------------------------------------------


class RunRequest(BaseModel):
    competitors: list[str] | None = Field(default=None, description="slugs; omit for all")
    full: bool = False
    analyze: bool = True
    slack: bool = True


@app.post("/api/runs", status_code=202)
def start_run(
    body: RunRequest,
    store: Store = Depends(get_store),
    config: Config = Depends(get_config),
    env: Env = Depends(get_env),
) -> dict:
    global _active_thread
    try:
        select_competitors(config, body.competitors)
    except ValueError as exc:
        raise HTTPException(400, str(exc))

    with _run_lock:
        if _active_thread and _active_thread.is_alive():
            raise HTTPException(409, "a run is already in progress")
        run_id = store.start_run("full" if body.full else "changes")
        opts = RunOptions(body.competitors, body.full, body.analyze, body.slack)

        def _work() -> None:
            try:
                run_pipeline(config, env, opts, run_id=run_id)
            except Exception:  # noqa: BLE001 - recorded on the run row by run_pipeline
                log.exception("run #%d failed", run_id)

        _active_thread = threading.Thread(target=_work, name=f"run-{run_id}", daemon=True)
        _active_thread.start()
    return {"run_id": run_id}
