"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, Competitor, Run, fmtDate, startRun } from "@/lib/api";
import { announceRunFinished, useApi } from "@/lib/hooks";
import { IconAlert, IconEye, IconPlay } from "./icons";

export interface StatusResponse {
  running: Run | null;
  /** Backend requires an access code (x-run-token) to start runs. */
  requires_token?: boolean;
  /** Set by the bundled-snapshot API (DEMO_MODE=1): read-only, no live runs. */
  demo?: boolean;
  /** Backend unreachable; the app is showing the bundled snapshot instead. */
  stale?: boolean;
  exported_at?: string;
}

const STAGE_LABEL: Record<string, string> = {
  queued: "Queued",
  scraping: "Scraping",
  detecting: "Diffing",
  analyzing: "Analyzing",
  summarizing: "Summarizing",
  reporting: "Reporting",
};

const TOKEN_KEY = "monitor:run-token";

function readToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

/** "Run now" button with an options popover, plus a live status pill while a run is in progress. */
export function RunControls() {
  const { data: status } = useApi<StatusResponse>("/api/status", { refreshMs: 4000 });
  const { data: competitors } = useApi<Competitor[]>("/api/competitors");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [full, setFull] = useState(false);
  const [analyze, setAnalyze] = useState(true);
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wasRunning = useRef(false);
  const popover = useRef<HTMLDivElement>(null);

  const running = status?.running ?? null;

  // Fire a page-wide refresh when a run transitions from running -> finished.
  useEffect(() => {
    if (wasRunning.current && !running) announceRunFinished();
    wasRunning.current = !!running;
  }, [running]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (popover.current && !popover.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function openPopover() {
    setToken(readToken());
    setError(null);
    setOpen((o) => !o);
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await startRun({ competitors: selected.length ? selected : undefined, full, analyze }, token || undefined);
      try {
        if (token) localStorage.setItem(TOKEN_KEY, token);
      } catch {
        /* storage unavailable */
      }
      setOpen(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not start run");
    } finally {
      setSubmitting(false);
    }
  }

  if (status?.demo) {
    return (
      <div
        className="flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs text-ink-2"
        title="Read-only demo built from a real monitoring run. Live runs need the Python backend."
      >
        <IconEye className="h-3.5 w-3.5 text-muted" />
        <span className="font-medium text-ink">Read-only demo</span>
        {status.exported_at && <span className="hidden sm:inline">· snapshot {fmtDate(status.exported_at)}</span>}
      </div>
    );
  }

  if (status?.stale) {
    return (
      <div
        className="flex items-center gap-2 rounded-full border border-sig-medium/50 bg-[#fff4d6] px-3 py-1.5 text-xs text-[#7a4b00] dark:bg-[#3a2c0d] dark:text-[#f5cf7a]"
        role="status"
        title="The monitoring backend is not reachable. Showing the last exported snapshot; this usually resolves within a minute."
      >
        <IconAlert className="h-3.5 w-3.5" />
        <span className="font-medium">Backend reconnecting</span>
        <span className="hidden sm:inline">· showing snapshot</span>
      </div>
    );
  }

  if (running) {
    return (
      <div
        className="flex items-center gap-2 rounded-full border border-accent/30 bg-accent-soft px-3 py-1.5 text-sm text-ink"
        role="status"
        aria-live="polite"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
        </span>
        <span className="font-medium">{STAGE_LABEL[running.stage ?? ""] ?? "Running"}</span>
        <span className="hidden text-ink-2 sm:inline">· {running.progress}</span>
      </div>
    );
  }

  const input = "h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-ink";

  return (
    <div className="relative" ref={popover}>
      <button
        type="button"
        onClick={openPopover}
        className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <IconPlay className="h-4 w-4" />
        Run now
      </button>
      {open && (
        <div role="dialog" aria-label="Run options" className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-surface p-4 shadow-xl">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Competitors</p>
          <div className="mb-3 max-h-40 space-y-1 overflow-y-auto">
            {(competitors ?? []).map((c) => (
              <label key={c.slug} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(c.slug)}
                  onChange={(e) => setSelected((s) => (e.target.checked ? [...s, c.slug] : s.filter((x) => x !== c.slug)))}
                />
                {c.name}
              </label>
            ))}
            {selected.length === 0 && <p className="text-xs text-muted">None selected = all competitors</p>}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={analyze} onChange={(e) => setAnalyze(e.target.checked)} />
            Analyze with Claude
          </label>
          <label className="mt-1 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} />
            Full review (all pages, not just changes)
          </label>
          {full && analyze && <p className="mt-1 text-xs text-muted">Sends every tracked page to Claude — slower and costs more.</p>}

          {status?.requires_token && (
            <div className="mt-3 border-t border-border pt-3">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted" htmlFor="run-token">
                Access code
              </label>
              <input
                id="run-token"
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Required to start a run"
                className={`${input} mt-1`}
              />
              <p className="mt-1 text-xs text-muted">Runs use paid Apify and Claude credits, so starting one needs the code.</p>
            </div>
          )}

          {error && <p className="mt-2 text-sm text-sig-high">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-2">
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || (!!status?.requires_token && !token)}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:bg-accent-hover disabled:opacity-60"
            >
              {submitting ? "Starting…" : "Start run"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
