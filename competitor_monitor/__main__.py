"""CLI entry point.

    python -m competitor_monitor run [--full] [--competitor SLUG ...] [--no-analyze] [--no-slack]
    python -m competitor_monitor report [RUN_ID]
    python -m competitor_monitor history
    python -m competitor_monitor serve [--port 8000]
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from .config import Env, load_config, load_env
from .pipeline import RunOptions, run_pipeline
from .storage import Store

log = logging.getLogger("competitor_monitor")


def cmd_run(args: argparse.Namespace, env: Env) -> int:
    config = load_config(args.config)
    opts = RunOptions(
        competitors=args.competitor or None,
        full=args.full,
        analyze=not args.no_analyze,
        slack=not args.no_slack,
    )
    try:
        result = run_pipeline(config, env, opts)
    except ValueError as exc:  # bad slug etc.
        log.error("%s", exc)
        return 2
    print(result.markdown)
    return 0


def cmd_report(args: argparse.Namespace, env: Env) -> int:
    store = Store(env.db_path)
    run_id = args.run_id or store.latest_run_id()
    if run_id is None:
        print("No runs yet. Run `python -m competitor_monitor run` first.")
        return 1
    row = store.get_report(run_id)
    if row is None:
        print(f"Run #{run_id} has no report.")
        return 1
    print(row["markdown"])
    return 0


def cmd_history(env: Env) -> int:
    store = Store(env.db_path)
    rows = store.list_runs()
    if not rows:
        print("No runs yet.")
        return 0
    print(f"{'run':>4}  {'started (UTC)':<20} {'status':<10} {'mode':<8} {'changes':>7} {'insights':>8}")
    for r in rows:
        print(f"{r['id']:>4}  {r['started_at'][:19]:<20} {r['status']:<10} {r['mode']:<8} "
              f"{r['change_count']:>7} {r['insight_count']:>8}")
    return 0


def cmd_serve(args: argparse.Namespace) -> int:
    import uvicorn

    uvicorn.run("competitor_monitor.api:app", host=args.host, port=args.port, reload=args.reload)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="competitor_monitor", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--config", type=Path, help="path to competitors.json")
    parser.add_argument("-v", "--verbose", action="store_true")
    sub = parser.add_subparsers(dest="command", required=True)

    p_run = sub.add_parser("run", help="scrape, detect changes, analyze, and report")
    p_run.add_argument("--full", action="store_true",
                       help="analyze every page, not just changes (use for a first landscape review)")
    p_run.add_argument("--competitor", action="append", metavar="SLUG",
                       help="only run for this competitor slug (repeatable)")
    p_run.add_argument("--no-analyze", action="store_true", help="scrape and diff only; skip Claude")
    p_run.add_argument("--no-slack", action="store_true", help="do not post to Slack even if configured")

    p_rep = sub.add_parser("report", help="print a stored report")
    p_rep.add_argument("run_id", nargs="?", type=int)

    sub.add_parser("history", help="list past runs")

    p_srv = sub.add_parser("serve", help="start the web API (backend for the dashboard)")
    p_srv.add_argument("--host", default="127.0.0.1")
    p_srv.add_argument("--port", type=int, default=8000)
    p_srv.add_argument("--reload", action="store_true")

    args = parser.parse_args(argv)
    # Reports contain em dashes and emoji; Windows consoles default to a legacy code page.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stderr,
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)

    env = load_env()
    if args.command == "run":
        return cmd_run(args, env)
    if args.command == "report":
        return cmd_report(args, env)
    if args.command == "serve":
        return cmd_serve(args)
    return cmd_history(env)


if __name__ == "__main__":
    sys.exit(main())
