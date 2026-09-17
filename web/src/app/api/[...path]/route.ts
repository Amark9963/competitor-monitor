import { NextRequest, NextResponse } from "next/server";
import snapshot from "@/data/snapshot.json";

/**
 * /api/* handler.
 *
 * - Live mode (default): proxy to the Python API at API_URL. If the backend cannot be
 *   reached (e.g. it is restarting), GET requests fall back to the bundled snapshot so
 *   the dashboard still renders; the response is flagged `stale: true`.
 * - Demo mode (DEMO_MODE=1, or Vercel without API_URL): always serve the snapshot.
 *
 * The snapshot is produced by `python -m competitor_monitor export`.
 */

const DEMO = process.env.DEMO_MODE === "1" || (process.env.VERCEL === "1" && !process.env.API_URL);
const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";
const UPSTREAM_TIMEOUT_MS = 8000;

type Snapshot = typeof snapshot;
type Insight = Snapshot["insights"][number];

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

function fromSnapshot(path: string[], search: URLSearchParams, mode: "demo" | "stale") {
  const snap = snapshot as Snapshot;
  const [head, id] = path;
  const flags = mode === "demo" ? { demo: true, exported_at: snap.exported_at } : { stale: true, exported_at: snap.exported_at };

  switch (head) {
    case "overview":
      return json({ ...snap.overview, running: null, ...flags });
    case "status":
      return json({ running: null, requires_token: false, ...flags });
    case "runs": {
      if (!id) {
        const limit = Number(search.get("limit") ?? 50);
        return json(snap.runs.slice(0, limit));
      }
      const detail = (snap.run_details as Record<string, unknown>)[id];
      return detail ? json(detail) : json({ detail: "run not found" }, 404);
    }
    case "changes": {
      const change = id && (snap.changes as Record<string, unknown>)[id];
      return change ? json(change) : json({ detail: "change not found" }, 404);
    }
    case "insights": {
      const competitor = search.get("competitor");
      const significance = search.get("significance");
      const category = search.get("category");
      const runId = search.get("run_id");
      const limit = Number(search.get("limit") ?? 100);
      const rows = (snap.insights as Insight[]).filter(
        (i) =>
          (!competitor || i.competitor === competitor) &&
          (!significance || i.significance === significance) &&
          (!category || i.category === category) &&
          (!runId || String(i.run_id) === runId),
      );
      return json(rows.slice(0, limit));
    }
    case "competitors":
      return json(snap.competitors);
    default:
      return json({ detail: "Not Found" }, 404);
  }
}

async function proxy(req: NextRequest, path: string[]) {
  const url = new URL(`/api/${path.join("/")}`, API_URL);
  url.search = req.nextUrl.search;
  const headers: Record<string, string> = { "content-type": req.headers.get("content-type") ?? "application/json" };
  const token = req.headers.get("x-run-token");
  if (token) headers["x-run-token"] = token;

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
    });
  } catch {
    if (req.method === "GET") return fromSnapshot(path, req.nextUrl.searchParams, "stale");
    return json({ detail: "The monitoring backend is not reachable right now. Please try again in a minute." }, 503);
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return DEMO ? fromSnapshot(path, req.nextUrl.searchParams, "demo") : proxy(req, path);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  if (DEMO) {
    return json(
      { detail: "This is a read-only demo built from a real monitoring run. Live runs need the Python backend — see the README." },
      503,
    );
  }
  return proxy(req, path);
}
