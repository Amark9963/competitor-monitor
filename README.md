# Retell AI — Competitor Monitor

Watches competitor websites (Bland AI, Vapi, Synthflow, ElevenLabs Agents, …), detects what changed since the last run, and uses Claude to turn those changes into team-ready competitive insights: new features, product updates, pricing moves, business changes, and notable blog/changelog content.

```
config/competitors.json ──► Apify Website Content Crawler ──► SQLite page state
                                                                    │
                                              diff vs. last run ◄───┘
                                                    │
                                     Claude (structured insights + exec summary)
                                                    │
                                     reports/YYYY-MM-DD_run{N}.md  +  Slack digest
```

## How it works

1. **Scrape** — One Apify run per competitor (`apify/website-content-crawler`). Each configured URL is a start URL; pages with `depth > 0` (e.g. `/blog`) are allowed to follow links beneath that path so new posts and changelog entries get picked up. Output is clean Markdown.
2. **Detect** — Every page's whitespace-normalised content is hashed and compared with the stored copy. New pages are captured in full; changed pages produce a unified diff. Tiny diffs (rotating testimonials, dates, cookie banners) are dropped by the `min_changed_chars` threshold. The first run for a competitor only stores a baseline.
3. **Analyze** — For each competitor with changes, Claude Opus 5 (adaptive thinking, structured output) extracts insights: category, significance, a specific summary, *implications for Retell*, a recommended action with an owner, and evidence URLs. A second call writes the executive summary across competitors.
4. **Report** — Markdown report saved to `reports/` (and `reports/latest.md`), stored in SQLite, printed to stdout, and optionally posted as a Slack digest.

## Setup

Requires Python 3.11+.

```bash
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt     # Windows
# source .venv/bin/activate && pip install -r requirements.txt  # macOS/Linux

copy .env.example .env      # then fill in APIFY_TOKEN, ANTHROPIC_API_KEY, optional SLACK_WEBHOOK_URL
```

## Usage

```bash
python -m competitor_monitor run                     # scrape → diff → analyze → report
python -m competitor_monitor run --full              # analyze every page (first-time landscape review)
python -m competitor_monitor run --competitor bland  # one competitor only (repeatable)
python -m competitor_monitor run --no-analyze        # scrape + diff only, no Claude calls
python -m competitor_monitor report [RUN_ID]         # print a stored report (latest by default)
python -m competitor_monitor history                 # list past runs
```

Recommended first-time sequence:

```bash
python -m competitor_monitor run --no-analyze   # capture baseline, verify URLs resolve
python -m competitor_monitor run                # from now on, only changes are analyzed
```

Or run `--full` once if you want an immediate landscape write-up of every tracked page.

## Dashboard (Next.js)

A web UI in [web/](web/) sits on top of the same SQLite data: dashboard with KPIs, executive summary and an insights-by-competitor chart; a filterable insight feed; run history with per-page diffs; competitor page state; and a **Run now** button that triggers the pipeline and shows live progress.

Two processes:

```bash
# 1. API (FastAPI, reads/writes data/monitor.db, runs the pipeline in the background)
python -m competitor_monitor serve            # http://127.0.0.1:8000  (--port to change)

# 2. UI
cd web && npm install && npm run dev          # http://localhost:3000
```

The UI proxies `/api/*` to the API, so no CORS setup is needed. If the API runs on a different port, start the UI with `API_URL=http://127.0.0.1:<port> npm run dev`. For production, `npm run build && npm start`.

API endpoints: `GET /api/overview`, `/api/runs`, `/api/runs/{id}`, `/api/changes/{id}`, `/api/insights?competitor=&significance=&category=`, `/api/competitors`, `/api/status`, and `POST /api/runs` (`{"competitors": [...], "full": false, "analyze": true}`; 409 if a run is already in progress).

## Configuration — `config/competitors.json`

| Key | Purpose |
|---|---|
| `company.profile` | Who *we* are. This is injected into the analysis prompt so implications are framed for Retell specifically — keep it accurate. |
| `competitors[].pages[]` | `url`, `type` (`homepage`, `pricing`, `features`, `changelog`, `blog`, `docs`, `about`, `careers`, `other`) and `depth` (0 = just this page; 1 = also follow links beneath this path). |
| `scraper.backend` | `apify` (production) or `http` (dependency-free fallback: fetches each URL directly, no JS rendering, no link following — fine for smoke tests). |
| `scraper.max_pages_per_competitor` | Cap on pages per Apify run; keeps cost bounded. |
| `detection.min_changed_chars` | Diffs smaller than this are ignored as noise. |
| `analysis.model` / `analysis.effort` | Claude model and effort level (`low` … `max`). |

Add a competitor by appending an entry — the slug is used as the DB key, so keep it stable.

## Scheduling

- **GitHub Actions** — `.github/workflows/monitor.yml` runs weekdays at 13:00 UTC (or on demand). Add `APIFY_TOKEN`, `ANTHROPIC_API_KEY` and optionally `SLACK_WEBHOOK_URL` as repository secrets. The SQLite state is persisted between runs via the Actions cache and each report is uploaded as an artifact.
- **Cron / Task Scheduler** — just schedule `python -m competitor_monitor run` from the project directory; state lives in `data/monitor.db`.

## Cost notes

- Apify: one Website Content Crawler run per competitor per execution; bounded by `max_pages_per_competitor`.
- Claude: only *changed* pages are sent (diffs, not full pages), and the system prompt is prompt-cached. A typical daily run with a handful of changes is a few cents to a few tens of cents. Server-side refusal fallbacks are enabled so a single unusual page can't blank the report.

## Troubleshooting

- **`ImportError: DLL load failed while importing impit`** — `apify-client` 2.x/3.x ship a native extension that some corporate Windows policies block. `requirements.txt` pins the pure-Python 1.x line for this reason; keep that pin if you hit the error.
- **Everything shows as `new` on every run** — the crawler is returning different canonical URLs each time (e.g. redirects). Check `pages.url` in `data/monitor.db` and adjust the configured URL to the final destination.
- **Too much noise** — raise `detection.min_changed_chars`, or add page-specific selectors to `removeElementsCssSelector` in `competitor_monitor/scraper.py`.

## Layout

```
competitor_monitor/
  __main__.py   CLI (run / report / history / serve)
  pipeline.py   run orchestration shared by CLI and API, with progress reporting
  api.py        FastAPI backend for the dashboard
  config.py     config + env loading (pydantic)
  scraper.py    Apify backend + HTTP fallback
  storage.py    SQLite: runs, pages, changes, insights, reports
  detect.py     URL/content normalisation, hashing, unified diffs
  analyze.py    Claude analysis (structured outputs) and executive summary
  report.py     Markdown rendering + Slack digest
config/competitors.json
.github/workflows/monitor.yml
```
