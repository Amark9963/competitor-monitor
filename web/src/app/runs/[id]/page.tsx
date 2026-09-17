"use client";

import Link from "next/link";
import { use, useState } from "react";
import { DiffView } from "@/components/DiffView";
import { Card, Empty, ErrorBox, InsightCard, SectionTitle, Skeleton } from "@/components/ui";
import { Change, Competitor, RunDetail, duration, fmtDate, pathOf } from "@/lib/api";
import { useApi } from "@/lib/hooks";

export default function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isRunning = (d: RunDetail | null) => d?.run.status === "running";
  const { data, error, loading } = useApi<RunDetail>(`/api/runs/${id}`, { refreshMs: 5000 });
  const { data: competitors } = useApi<Competitor[]>("/api/competitors");
  const [openChange, setOpenChange] = useState<number | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [changeFilter, setChangeFilter] = useState("");

  if (error) return <ErrorBox message={error} />;
  if (loading || !data) return <Skeleton lines={6} />;

  const { run, report, insights, changes } = data;
  const nameOf = Object.fromEntries((competitors ?? []).map((c) => [c.slug, c.name]));
  const slugs = Array.from(new Set(changes.map((c) => c.competitor)));
  const visibleChanges = changeFilter ? changes.filter((c) => c.competitor === changeFilter) : changes;
  const executive = report?.executive;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/runs" className="text-xs text-muted hover:text-ink">← All runs</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Run #{run.id}</h1>
        <p className="mt-1 text-sm text-ink-2">
          {fmtDate(run.started_at)} · {run.mode === "full" ? "full review" : "changes only"} ·{" "}
          <span className={run.status === "failed" ? "text-sig-high" : run.status === "running" ? "text-accent" : "text-good"}>
            {run.status}
          </span>
          {run.finished_at && <> in {duration(run.started_at, run.finished_at)}</>}
          {isRunning(data) && run.progress && <> · {run.progress}</>}
        </p>
        {run.error && <p className="mt-2 rounded-md border border-sig-high/40 p-3 text-sm text-sig-high">{run.error}</p>}
      </div>

      {executive && (
        <Card>
          <SectionTitle>Executive summary</SectionTitle>
          <p className="text-lg font-semibold leading-snug">{executive.headline}</p>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-2">
            {executive.summary.split(/\n{2,}/).map((p, i) => (
              <p key={i}>{p.replace(/\*\*/g, "")}</p>
            ))}
          </div>
          {executive.watch_list.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Watch list</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {executive.watch_list.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      <div>
        <SectionTitle>Insights ({insights.length})</SectionTitle>
        {insights.length === 0 ? (
          <Empty>{isRunning(data) ? "Analysis in progress…" : "No insights for this run."}</Empty>
        ) : (
          <div className="grid gap-4">
            {insights.map((i) => (
              <InsightCard key={i.id} insight={i} competitorName={nameOf[i.competitor] ?? i.competitor} />
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionTitle
          action={
            slugs.length > 1 && (
              <select
                value={changeFilter}
                onChange={(e) => setChangeFilter(e.target.value)}
                className="rounded-lg border border-border bg-surface px-2 py-1 text-xs"
                aria-label="Filter changes by competitor"
              >
                <option value="">All competitors</option>
                {slugs.map((s) => (
                  <option key={s} value={s}>{nameOf[s] ?? s}</option>
                ))}
              </select>
            )
          }
        >
          Page changes ({changes.length})
        </SectionTitle>
        {visibleChanges.length === 0 ? (
          <Empty>No page changes recorded.</Empty>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            {visibleChanges.map((c: Change) => (
              <div key={c.id} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpenChange((o) => (o === c.id ? null : c.id))}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-2"
                  aria-expanded={openChange === c.id}
                >
                  <span
                    className={`w-14 shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-medium ${
                      c.change_type === "new" ? "bg-accent/15 text-accent" : "bg-surface-2 text-ink-2"
                    }`}
                  >
                    {c.change_type}
                  </span>
                  <span className="w-28 shrink-0 text-xs text-muted">{nameOf[c.competitor] ?? c.competitor}</span>
                  <span className="w-20 shrink-0 text-xs text-muted">{c.page_type}</span>
                  <span className="min-w-0 flex-1 truncate" title={c.url}>{c.title || pathOf(c.url)}</span>
                  <span className="tabular shrink-0 text-xs text-muted">{c.changed_chars.toLocaleString()} chars</span>
                </button>
                {openChange === c.id && (
                  <div className="px-4 pb-4">
                    <a href={c.url} target="_blank" rel="noreferrer" className="mb-2 inline-block text-xs text-accent hover:underline">
                      {c.url}
                    </a>
                    <DiffView changeId={c.id} changeType={c.change_type} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {report && (
        <div>
          <button type="button" onClick={() => setShowReport((s) => !s)} className="text-sm text-accent hover:underline">
            {showReport ? "Hide" : "Show"} raw Markdown report
          </button>
          {showReport && (
            <pre className="mt-2 max-h-[40rem] overflow-auto rounded-xl border border-border bg-surface p-4 text-xs leading-5 whitespace-pre-wrap">
              {report.markdown}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
