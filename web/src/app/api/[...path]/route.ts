import { NextRequest, NextResponse } from "next/server";
import snapshot from "@/data/snapshot.json";

/**
 * /api/* handler.
 *
 * - DEMO_MODE=1 (e.g. Vercel): serve the bundled JSON snapshot exported by
 *   `python -m competitor_monitor export`. Read-only; POST /api/runs is refused.
 * - Otherwise: transparently proxy to the Python API at API_URL.
 */

// Demo mode is explicit (DEMO_MODE=1) or implied on Vercel when no backend is configured.
const DEMO = process.env.DEMO_MODE === "1" || (process.env.VERCEL === "1" && !process.env.API_URL);
const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";

type Snapshot = typeof snapshot;
type Insight = Snapshot["insights"][number];

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

function fromSnapshot(path: string[], search: URLSearchParams) {
  const snap = snapshot as Snapshot;
  const [head, id] = path;

  switch (head) {
    case "overview":
      return json({ ...snap.overview, running: null, demo: true, exported_at: snap.exported_at });
    case "status":
      return json({ running: null, demo: true, exported_at: snap.exported_at });
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
  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers: { "content-type": req.headers.get("content-type") ?? "application/json" },
      body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
      cache: "no-store",
    });
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
    });
  } catch {
    return json({ detail: `Could not reach the API at ${API_URL}. Start it with: python -m competitor_monitor serve` }, 502);
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return DEMO ? fromSnapshot(path, req.nextUrl.searchParams) : proxy(req, path);
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
