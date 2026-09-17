"""Export the database as a JSON snapshot for the read-only demo deployment.

The Next.js app bundles this file and serves it from its /api routes when
DEMO_MODE=1 (e.g. on Vercel), so the dashboard works without the Python backend.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from fastapi.testclient import TestClient

from .api import app
from .config import Env
from .storage import Store


def export_snapshot(env: Env, out_path: Path) -> dict:
    """Walk the API with an in-process client so the snapshot matches the live JSON exactly."""
    client = TestClient(app)
    store = Store(env.db_path)
    run_ids = [int(r["id"]) for r in store.list_runs(limit=200)]
    change_ids = [int(r["id"]) for run_id in run_ids for r in store.changes_for_run(run_id)]
    store.close()

    snapshot = {
        "exported_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "overview": client.get("/api/overview").json(),
        "runs": client.get("/api/runs?limit=200").json(),
        "run_details": {str(i): client.get(f"/api/runs/{i}").json() for i in run_ids},
        "changes": {str(i): client.get(f"/api/changes/{i}").json() for i in change_ids},
        "insights": client.get("/api/insights?limit=500").json(),
        "competitors": client.get("/api/competitors").json(),
    }
    snapshot["overview"]["running"] = None

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(snapshot, ensure_ascii=False), encoding="utf-8")
    return snapshot
