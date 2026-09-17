"use client";

import Link from "next/link";
import { use, useState } from "react";
import { BriefBody } from "@/components/BriefBody";
import { DiffView } from "@/components/DiffView";
import { IconChevron, IconDownload, IconExternal } from "@/components/icons";
import { Card, Empty, ErrorBox, Favicon, InsightCard, PageHeader, Skeleton, StatusPill, btn } from "@/components/ui";
import { Change, Competitor, RunDetail, duration, fmtDate, pathOf } from "@/lib/api";
import { useApi } from "@/lib/hooks";

type Tab = "insights" | "changes" | "report";

export default function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, loading } = useApi<RunDetail>(`/api/runs/${id}`, { refreshMs: 5000 });
  const { data: competitors } = useApi<Competitor[]>("/api/competitors");
  const [tab, setTab] = useState<Tab>("insights");
  const [openChange, setOpenChange] = useState<number | null>(null);
  const [changeFilter, setChangeFilter] = useState("");

  if (error) return <ErrorBox message={error} />;
  if (loading || !data) return <Skeleton lines={6} />;

  const { run, report, insights, changes } = data;
  const running = run.status === "running";
  const byslug = Object.fromEntries((competitors ?? []).map((c) => [c.slug, c]));
  const slugs = Array.from(new Set(changes.map((c) => c.competitor)));
  const visibleChanges = changeFilter ? changes.filter((c) => c.competitor === changeFilter) : changes;
  const executive = report?.executive;
  const high = insights.filter((i) => i.significance === "high").length;

  function downloadReport() {
    if (!report) return;
    const blob = new Blob([report.markdown], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `competitor-report-run${run.id}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "insights", label: "Insights", count: insights.length },
    { key: "changes", label: "Page changes", count: changes.length },
    { key: "report", label: "Report" },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={<Link href="/runs" className="hover:text-ink">← Runs</Link>}
        title={
          <span className="flex items-center gap-3">
            Run #{run.id} <StatusPill status={run.status} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{fmtDate(run.started_at)}</span>
            <span className="text-muted">·</span>
            <span>{run.mode === "full" ? "Full review" : "Changes only"}</span>
            {run.finished_at && (
              <>
                <span className="text-muted">·</span>
                <span>{duration(run.started_at, run.finished_at)}</span>
              </>
            )}
            {running && run.progress && (
              <>
                <span className="text-muted">·</span>
                <span className="text-accent">{run.progress}</span>
              </>
            )}
          </span>
        }
        actions={
          report && (
            <button type="button" onClick={downloadReport} className={btn.secondary}>
              <IconDownload className="h-4 w-4" /> Export .md
            </button>
          )
        }
      />

      {run.error && (
        <div className="mb-6 rounded-xl border border-sig-high/40 bg-surface p-4 text-sm text-sig-high">{run.error}</div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Insights", value: insights.length },
          { label: "High significance", value: high },
          { label: "Page changes", value: changes.length },
          { label: "Competitors", value: slugs.length },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-border bg-surface px-4 py-3 shadow-[0_1px_2px_rgba(0,18,46,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{m.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">{m.value}</p>
          </div>
        ))}
      </div>

      {executive && (
        <Card className="mb-6" title="Executive summary" description={`Generated from ${insights.length} insights`}>
          <p className="text-[17px] font-semibold leading-snug tracking-tight text-ink">{executive.headline}</p>
          <div className="mt-4 grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <BriefBody text={executive.summary} initial={3} />
            </div>
            {executive.watch_list.length > 0 && (
              <div className="rounded-lg border border-border bg-surface-2/60 p-4 lg:col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Watch list</p>
                <ol className="mt-2 space-y-2.5">
                  {executive.watch_list.map((w, i) => (
                    <li key={i} className="flex gap-3 text-[13px] leading-snug text-ink">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">{i + 1}</span>
                      {w}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="mb-4 flex gap-1 border-b border-border" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.key ? "border-accent text-ink" : "border-transparent text-ink-2 hover:text-ink"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`rounded-full px-1.5 text-[11px] ${tab === t.key ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted"}`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "insights" &&
        (insights.length === 0 ? (
          <Empty>{running ? "Analysis in progress…" : "No insights for this run."}</Empty>
        ) : (
          <div className="grid gap-4">
            {insights.map((i) => (
              <InsightCard key={i.id} insight={i} competitor={byslug[i.competitor]} />
            ))}
          </div>
        ))}

      {tab === "changes" && (
        <Card
          padded={false}
          title="Page changes"
          description="Click a row to see exactly what changed"
          action={
            slugs.length > 1 && (
              <select
                value={changeFilter}
                onChange={(e) => setChangeFilter(e.target.value)}
                className="h-8 rounded-lg border border-border bg-surface px-2 text-xs"
                aria-label="Filter changes by competitor"
              >
                <option value="">All competitors</option>
                {slugs.map((s) => (
                  <option key={s} value={s}>{byslug[s]?.name ?? s}</option>
                ))}
              </select>
            )
          }
        >
          {visibleChanges.length === 0 ? (
            <p className="p-5 text-sm text-ink-2">No page changes recorded.</p>
          ) : (
            <div className="divide-y divide-border">
              {visibleChanges.map((c: Change) => {
                const comp = byslug[c.competitor];
                const open = openChange === c.id;
                return (
                  <div key={c.id}>
                    <button
                      type="button"
                      onClick={() => setOpenChange(open ? null : c.id)}
                      className="flex w-full items-center gap-3 px-5 py-2.5 text-left text-sm hover:bg-surface-2/60"
                      aria-expanded={open}
                    >
                      <IconChevron className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`} />
                      <span
                        className={`w-16 shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] font-semibold ring-1 ring-inset ${
                          c.change_type === "new" ? "bg-accent-soft text-accent ring-accent/30" : "bg-surface-2 text-ink-2 ring-border"
                        }`}
                      >
                        {c.change_type === "new" ? "New" : "Changed"}
                      </span>
                      {comp && (
                        <span className="hidden w-32 shrink-0 items-center gap-1.5 text-xs text-ink-2 sm:flex">
                          <Favicon domain={comp.domain} name={comp.name} size={16} /> {comp.name}
                        </span>
                      )}
                      <span className="w-20 shrink-0 text-xs capitalize text-muted">{c.page_type}</span>
                      <span className="min-w-0 flex-1 truncate text-ink" title={c.url}>{c.title || pathOf(c.url)}</span>
                      <span className="tabular shrink-0 text-xs text-muted">{c.changed_chars.toLocaleString()} chars</span>
                    </button>
                    {open && (
                      <div className="bg-surface-2/40 px-5 pb-4 pt-1">
                        <a href={c.url} target="_blank" rel="noreferrer" className="mb-2 inline-flex items-center gap-1 text-xs text-accent hover:underline">
                          {c.url} <IconExternal className="h-3 w-3" />
                        </a>
                        <DiffView changeId={c.id} changeType={c.change_type} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {tab === "report" &&
        (report ? (
          <Card title="Markdown report" description="Same content as the file written to reports/" action={<button type="button" onClick={downloadReport} className={btn.link}>Download</button>}>
            <pre className="max-h-[48rem] overflow-auto whitespace-pre-wrap text-xs leading-5 text-ink-2">{report.markdown}</pre>
          </Card>
        ) : (
          <Empty>No report stored for this run.</Empty>
        ))}
    </div>
  );
}
