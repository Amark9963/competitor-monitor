"""SQLite persistence: current page state, detected changes, insights, and reports."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at   TEXT NOT NULL,
    finished_at  TEXT,
    status       TEXT NOT NULL DEFAULT 'running',
    mode         TEXT NOT NULL,           -- 'changes' | 'full'
    error        TEXT,
    stage        TEXT,                    -- 'queued' | 'scraping' | 'detecting' | 'analyzing' | 'summarizing' | 'reporting'
    progress     TEXT                     -- human-readable progress message
);

-- Latest known state of every tracked page (one row per competitor+url).
CREATE TABLE IF NOT EXISTS pages (
    competitor      TEXT NOT NULL,
    url             TEXT NOT NULL,
    page_type       TEXT NOT NULL,
    title           TEXT,
    content_hash    TEXT NOT NULL,
    content         TEXT NOT NULL,
    first_seen_at   TEXT NOT NULL,
    last_seen_at    TEXT NOT NULL,
    last_changed_at TEXT NOT NULL,
    PRIMARY KEY (competitor, url)
);

CREATE TABLE IF NOT EXISTS changes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id       INTEGER NOT NULL REFERENCES runs(id),
    competitor   TEXT NOT NULL,
    url          TEXT NOT NULL,
    page_type    TEXT NOT NULL,
    title        TEXT,
    change_type  TEXT NOT NULL,           -- 'new' | 'changed'
    diff_text    TEXT NOT NULL,           -- unified diff, or full content for new pages
    changed_chars INTEGER NOT NULL,
    detected_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS insights (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id                  INTEGER NOT NULL REFERENCES runs(id),
    competitor              TEXT NOT NULL,
    category                TEXT NOT NULL,
    significance            TEXT NOT NULL,
    title                   TEXT NOT NULL,
    summary                 TEXT NOT NULL,
    implications_for_us     TEXT NOT NULL,
    recommended_action      TEXT NOT NULL,
    evidence_urls           TEXT NOT NULL,   -- JSON array
    created_at              TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
    run_id             INTEGER PRIMARY KEY REFERENCES runs(id),
    executive_summary  TEXT NOT NULL,     -- headline
    executive_json     TEXT,              -- full ExecutiveSummary as JSON
    markdown           TEXT NOT NULL,
    created_at         TEXT NOT NULL
);
"""

# Columns added after the first release; applied idempotently on open.
_MIGRATIONS = [
    ("runs", "stage", "TEXT"),
    ("runs", "progress", "TEXT"),
    ("reports", "executive_json", "TEXT"),
]


@dataclass
class PageRow:
    competitor: str
    url: str
    page_type: str
    title: str | None
    content_hash: str
    content: str


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Store:
    def __init__(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        # check_same_thread=False: FastAPI may open a Store in one threadpool thread and
        # close it in another. A Store is never used by two threads concurrently.
        self.conn = sqlite3.connect(path, timeout=30, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        # WAL lets the API read while a run is writing.
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.executescript(SCHEMA)
        self._migrate()

    def _migrate(self) -> None:
        for table, column, ddl in _MIGRATIONS:
            existing = {r["name"] for r in self.conn.execute(f"PRAGMA table_info({table})")}
            if column not in existing:
                self.conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")
        self.conn.commit()

    # ---- runs -------------------------------------------------------------

    def start_run(self, mode: str) -> int:
        cur = self.conn.execute(
            "INSERT INTO runs (started_at, mode, stage, progress) VALUES (?, ?, 'queued', 'Queued')",
            (now_iso(), mode),
        )
        self.conn.commit()
        return int(cur.lastrowid)

    def set_progress(self, run_id: int, stage: str, message: str) -> None:
        self.conn.execute(
            "UPDATE runs SET stage = ?, progress = ? WHERE id = ?", (stage, message, run_id)
        )
        self.conn.commit()

    def finish_run(self, run_id: int, status: str, error: str | None = None) -> None:
        self.conn.execute(
            "UPDATE runs SET finished_at = ?, status = ?, error = ?, stage = 'done', "
            "progress = ? WHERE id = ?",
            (now_iso(), status, error, "Failed" if error else "Completed", run_id),
        )
        self.conn.commit()

    def get_run(self, run_id: int) -> sqlite3.Row | None:
        return self.conn.execute(
            """
            SELECT r.*,
                   (SELECT COUNT(*) FROM changes c WHERE c.run_id = r.id)  AS change_count,
                   (SELECT COUNT(*) FROM insights i WHERE i.run_id = r.id) AS insight_count
            FROM runs r WHERE r.id = ?
            """,
            (run_id,),
        ).fetchone()

    def running_run(self) -> sqlite3.Row | None:
        return self.conn.execute(
            "SELECT * FROM runs WHERE status = 'running' ORDER BY id DESC LIMIT 1"
        ).fetchone()

    def mark_stale_runs_failed(self) -> None:
        """A run left 'running' by a crashed process can never finish; mark it failed."""
        self.conn.execute(
            "UPDATE runs SET status = 'failed', finished_at = ?, stage = 'done', "
            "progress = 'Interrupted', error = 'process exited before the run finished' "
            "WHERE status = 'running'",
            (now_iso(),),
        )
        self.conn.commit()

    def list_runs(self, limit: int = 20) -> list[sqlite3.Row]:
        return self.conn.execute(
            """
            SELECT r.*,
                   (SELECT COUNT(*) FROM changes c WHERE c.run_id = r.id)  AS change_count,
                   (SELECT COUNT(*) FROM insights i WHERE i.run_id = r.id) AS insight_count
            FROM runs r ORDER BY r.id DESC LIMIT ?
            """,
            (limit,),
        ).fetchall()

    def latest_run_id(self) -> int | None:
        row = self.conn.execute("SELECT id FROM runs ORDER BY id DESC LIMIT 1").fetchone()
        return int(row["id"]) if row else None

    def latest_run_with_insights(self) -> sqlite3.Row | None:
        return self.conn.execute(
            """
            SELECT r.*,
                   (SELECT COUNT(*) FROM changes c WHERE c.run_id = r.id)  AS change_count,
                   (SELECT COUNT(*) FROM insights i WHERE i.run_id = r.id) AS insight_count
            FROM runs r WHERE EXISTS (SELECT 1 FROM insights i WHERE i.run_id = r.id)
            ORDER BY r.id DESC LIMIT 1
            """
        ).fetchone()

    def has_baseline(self, competitor: str) -> bool:
        row = self.conn.execute(
            "SELECT 1 FROM pages WHERE competitor = ? LIMIT 1", (competitor,)
        ).fetchone()
        return row is not None

    # ---- pages ------------------------------------------------------------

    def get_page(self, competitor: str, url: str) -> PageRow | None:
        row = self.conn.execute(
            "SELECT competitor, url, page_type, title, content_hash, content "
            "FROM pages WHERE competitor = ? AND url = ?",
            (competitor, url),
        ).fetchone()
        return PageRow(**dict(row)) if row else None

    def upsert_page(self, page: PageRow, changed: bool) -> None:
        ts = now_iso()
        self.conn.execute(
            """
            INSERT INTO pages (competitor, url, page_type, title, content_hash, content,
                               first_seen_at, last_seen_at, last_changed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (competitor, url) DO UPDATE SET
                page_type       = excluded.page_type,
                title           = excluded.title,
                content_hash    = excluded.content_hash,
                content         = excluded.content,
                last_seen_at    = excluded.last_seen_at,
                last_changed_at = CASE WHEN ? THEN excluded.last_changed_at
                                       ELSE pages.last_changed_at END
            """,
            (
                page.competitor, page.url, page.page_type, page.title,
                page.content_hash, page.content, ts, ts, ts, int(changed),
            ),
        )

    # ---- changes ----------------------------------------------------------

    def add_change(
        self, run_id: int, competitor: str, url: str, page_type: str, title: str | None,
        change_type: str, diff_text: str, changed_chars: int,
    ) -> None:
        self.conn.execute(
            """
            INSERT INTO changes (run_id, competitor, url, page_type, title, change_type,
                                 diff_text, changed_chars, detected_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (run_id, competitor, url, page_type, title, change_type, diff_text, changed_chars, now_iso()),
        )

    def changes_for_run(self, run_id: int, with_diff: bool = False) -> list[sqlite3.Row]:
        cols = "*" if with_diff else (
            "id, run_id, competitor, url, page_type, title, change_type, changed_chars, detected_at"
        )
        return self.conn.execute(
            f"SELECT {cols} FROM changes WHERE run_id = ? ORDER BY competitor, page_type, url", (run_id,)
        ).fetchall()

    def get_change(self, change_id: int) -> sqlite3.Row | None:
        return self.conn.execute("SELECT * FROM changes WHERE id = ?", (change_id,)).fetchone()

    def pages_for_competitor(self, competitor: str) -> list[sqlite3.Row]:
        return self.conn.execute(
            """
            SELECT competitor, url, page_type, title, length(content) AS content_length,
                   first_seen_at, last_seen_at, last_changed_at
            FROM pages WHERE competitor = ? ORDER BY page_type, url
            """,
            (competitor,),
        ).fetchall()

    def page_counts(self) -> dict[str, int]:
        rows = self.conn.execute("SELECT competitor, COUNT(*) AS n FROM pages GROUP BY competitor")
        return {r["competitor"]: int(r["n"]) for r in rows}

    # ---- insights / reports ----------------------------------------------

    def add_insight(self, run_id: int, competitor: str, insight: dict) -> None:
        self.conn.execute(
            """
            INSERT INTO insights (run_id, competitor, category, significance, title, summary,
                                  implications_for_us, recommended_action, evidence_urls, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id, competitor, insight["category"], insight["significance"], insight["title"],
                insight["summary"], insight["implications_for_us"], insight["recommended_action"],
                insight["evidence_urls"], now_iso(),
            ),
        )

    def insights_for_run(self, run_id: int) -> list[sqlite3.Row]:
        return self.conn.execute(
            """
            SELECT * FROM insights WHERE run_id = ?
            ORDER BY competitor,
                     CASE significance WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, id
            """,
            (run_id,),
        ).fetchall()

    def list_insights(
        self,
        competitor: str | None = None,
        significance: str | None = None,
        category: str | None = None,
        run_id: int | None = None,
        limit: int = 100,
    ) -> list[sqlite3.Row]:
        clauses, params = [], []
        if competitor:
            clauses.append("i.competitor = ?"); params.append(competitor)
        if significance:
            clauses.append("i.significance = ?"); params.append(significance)
        if category:
            clauses.append("i.category = ?"); params.append(category)
        if run_id is not None:
            clauses.append("i.run_id = ?"); params.append(run_id)
        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
        params.append(limit)
        return self.conn.execute(
            f"""
            SELECT i.*, r.started_at AS run_started_at
            FROM insights i JOIN runs r ON r.id = i.run_id
            {where}
            ORDER BY i.run_id DESC,
                     CASE i.significance WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, i.id
            LIMIT ?
            """,
            params,
        ).fetchall()

    def insight_stats(self, run_id: int | None = None) -> list[sqlite3.Row]:
        """Counts by competitor × significance (for one run, or all time)."""
        where, params = ("WHERE run_id = ?", (run_id,)) if run_id is not None else ("", ())
        return self.conn.execute(
            f"SELECT competitor, significance, COUNT(*) AS n FROM insights {where} "
            "GROUP BY competitor, significance",
            params,
        ).fetchall()

    def save_report(
        self, run_id: int, executive_summary: str, markdown: str, executive_json: str | None = None
    ) -> None:
        self.conn.execute(
            "INSERT OR REPLACE INTO reports (run_id, executive_summary, executive_json, markdown, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (run_id, executive_summary, executive_json, markdown, now_iso()),
        )

    def get_report(self, run_id: int) -> sqlite3.Row | None:
        return self.conn.execute("SELECT * FROM reports WHERE run_id = ?", (run_id,)).fetchone()

    def commit(self) -> None:
        self.conn.commit()

    def close(self) -> None:
        self.conn.close()
