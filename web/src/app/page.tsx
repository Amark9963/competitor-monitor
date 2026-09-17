"use client";

import Link from "next/link";
import { useState } from "react";
import { BriefBody } from "@/components/BriefBody";
import { InsightChart } from "@/components/InsightChart";
import { IconArrowRight, IconEye, IconFile, IconInsights, IconLayers, IconRuns } from "@/components/icons";
import {
  Card, Empty, ErrorBox, Favicon, InsightCard, PageHeader, Skeleton, StatTile, StatusPill, Table, Td, Th, ViewAll, btn,
} from "@/components/ui";
import { Competitor, Insight, Overview, Run, duration, fmtDate, timeAgo } from "@/lib/api";
import { useApi } from "@/lib/hooks";

type Metric = "insights_featured_run" | "insights_all_time";

export default function DashboardPage() {
  const { data, error, loading } = useApi<Overview>("/api/overview");
  const { data: runs } = useApi<Run[]>("/api/runs?limit=8");
  const { data: competitorDetails } = useApi<Competitor[]>("/api/competitors");
  const featuredId = data?.featured_run?.id;
  const { data: insights } = useApi<Insight[]>(featuredId ? `/api/insights?run_id=${featuredId}&limit=4` : null);
  const [metric, setMetric] = useState<Metric>("insights_featured_run");

  if (error) return <ErrorBox message={error} />;
  if (loading || !data) return <Skeleton lines={6} />;

  const last = data.latest_run;
  const featured = data.featured_run;
  const byslug = Object.fromEntries(data.competitors.map((c) => [c.slug, c]));
  const totals = data.competitors.reduce(
    (acc, c) => ({
      high: acc.high + c.insights_featured_run.high,
      all: acc.all + c.insights_featured_run.high + c.insights_featured_run.medium + c.insights_featured_run.low,
    }),
    { high: 0, all: 0 },
  );
  const pagesTracked = data.competitors.reduce((s, c) => s + c.pages_tracked, 0);
  const withBaseline = data.competitors.filter((c) => c.pages_tracked > 0).length;

  // Trend context from run history (oldest -> newest).
  const history = [...(runs ?? [])].reverse();
  // Compare only against the previous analyzed run of the same mode: a full review
  // and a changes-only run are not comparable.
  const analyzed = history.filter((r) => (r.insight_count ?? 0) > 0 && r.mode === featured?.mode);
  const prev = analyzed.length >= 2 ? analyzed[analyzed.length - 2] : null;
  const insightDelta = prev && featured ? { value: (featured.insight_count ?? 0) - (prev.insight_count ?? 0), label: `vs run #${prev.id}` } : null;
  const spark = history.map((r) => r.insight_count ?? 0);
  const lastChangeOf = (slug: string) =>
    competitorDetails?.find((c) => c.slug === slug)?.tracked_pages.reduce<string | null>((m, p) => (!m || p.last_changed_at > m ? p.last_changed_at : m), null) ?? null;

  return (
    <div>
      <PageHeader
        eyebrow="Dashboard"
        title="Competitive intelligence"
        description={
          last ? (
            <>
              Last run <Link href={`/runs/${last.id}`} className="font-medium text-accent hover:underline">#{last.id}</Link>{" "}
              {last.status === "succeeded" ? "completed" : last.status} {timeAgo(last.finished_at ?? last.started_at)}
              {last.finished_at && <> in {duration(last.started_at, last.finished_at)}</>}
              {featured && last.id !== featured.id && (
                <>
                  {" "}with no new insights · showing brief from run{" "}
                  <Link href={`/runs/${featured.id}`} className="font-medium text-accent hover:underline">#{featured.id}</Link>
                </>
              )}
            </>
          ) : (
            "No runs yet — use Run now to capture a baseline."
          )
        }
        actions={
          featured && (
            <Link href={`/runs/${featured.id}`} className={btn.secondary}>
              <IconFile className="h-4 w-4" /> Full report
            </Link>
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile label="Insights" value={totals.all} icon={<IconInsights />} delta={insightDelta} spark={spark} hint={featured ? `Run #${featured.id}` : "No analyzed run"} />
        <StatTile label="High significance" value={totals.high} icon={<IconEye />} hint="Likely to affect roadmap, pricing or positioning" />
        <StatTile label="Competitors" value={data.competitors.length} icon={<IconLayers />} hint={`${withBaseline} of ${data.competitors.length} with a baseline`} />
        <StatTile label="Pages tracked" value={pagesTracked} icon={<IconRuns />} hint={`${history.length} run${history.length === 1 ? "" : "s"} in history`} />
      </div>

      {data.executive && featured && (
        <section
          className="relative mt-6 overflow-hidden rounded-xl p-6 text-white shadow-[0_8px_24px_rgba(0,18,46,0.18)] sm:p-7"
          style={{ background: "linear-gradient(135deg, #00122e 0%, #0b1f45 60%, #17285e 100%)" }}
        >
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-30 blur-3xl"
            style={{ background: "radial-gradient(circle, var(--brand-2), transparent 70%)" }}
            aria-hidden
          />
          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
              Executive brief · Run #{featured.id} · {fmtDate(featured.started_at)}
            </p>
            <h2 className="mt-2 max-w-4xl text-[21px] font-semibold leading-snug tracking-tight sm:text-[23px]">{data.executive.headline}</h2>
            <div className="mt-5 grid gap-6 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <BriefBody text={data.executive.summary} tone="dark" />
              </div>
              {data.executive.watch_list.length > 0 && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-4 lg:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">Watch list</p>
                  <ol className="mt-2 space-y-2.5">
                    {data.executive.watch_list.map((w, i) => (
                      <li key={i} className="flex gap-3 text-[13px] leading-snug text-white/90">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-semibold text-white">{i + 1}</span>
                        {w}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
            <Link href={`/runs/${featured.id}`} className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-white/90 hover:text-white">
              Open full report <IconArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card
          className="lg:col-span-3"
          title="Insights by competitor"
          description="Stacked by significance"
          action={
            <div className="flex gap-1" role="tablist" aria-label="Metric">
              {(["insights_featured_run", "insights_all_time"] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={metric === m}
                  onClick={() => setMetric(m)}
                  className={`rounded-md px-2 py-1 font-medium ${metric === m ? "bg-accent-soft text-accent" : "text-ink-2 hover:text-ink"}`}
                >
                  {m === "insights_featured_run" ? (featured ? `Run #${featured.id}` : "Latest") : "All time"}
                </button>
              ))}
            </div>
          }
        >
          <InsightChart competitors={data.competitors} metric={metric} />
        </Card>

        <Card className="lg:col-span-2" title="Recent runs" action={<ViewAll href="/runs" />} padded={false}>
          {history.length === 0 ? (
            <p className="p-5 text-sm text-ink-2">No runs yet.</p>
          ) : (
            <ol className="divide-y divide-border">
              {[...history].reverse().slice(0, 6).map((r) => (
                <li key={r.id}>
                  <Link href={`/runs/${r.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-2">
                    <span className="w-10 shrink-0 text-sm font-semibold text-ink">#{r.id}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{fmtDate(r.started_at)}</span>
                      <span className="block text-xs text-muted">
                        {r.mode === "full" ? "Full review" : "Changes"} · {r.change_count ?? 0} changes · {r.insight_count ?? 0} insights
                      </span>
                    </span>
                    <StatusPill status={r.status} />
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <Card className="mt-6" title="Competitor activity" description="Coverage and output per tracked competitor" action={<ViewAll href="/competitors" />} padded={false}>
        <Table>
          <thead>
            <tr>
              <Th>Competitor</Th>
              <Th align="right">Pages</Th>
              <Th>Last change</Th>
              <Th align="right">High</Th>
              <Th align="right">Medium</Th>
              <Th align="right">Low</Th>
              <Th align="right">All time</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody className="tabular">
            {data.competitors.map((c) => {
              const v = c.insights_featured_run;
              const all = c.insights_all_time;
              const lastChange = lastChangeOf(c.slug);
              return (
                <tr key={c.slug} className="hover:bg-surface-2/60">
                  <Td>
                    <span className="flex items-center gap-2.5">
                      <Favicon domain={c.domain} name={c.name} size={24} />
                      <span>
                        <span className="block font-medium text-ink">{c.name}</span>
                        <span className="block text-xs text-muted">{c.domain}</span>
                      </span>
                    </span>
                  </Td>
                  <Td align="right">{c.pages_tracked || <span className="text-muted">—</span>}</Td>
                  <Td className="text-ink-2">{lastChange ? timeAgo(lastChange) : <span className="text-muted">no baseline</span>}</Td>
                  <Td align="right" className={v.high ? "font-semibold text-sig-high" : "text-muted"}>{v.high}</Td>
                  <Td align="right" className={v.medium ? "text-ink" : "text-muted"}>{v.medium}</Td>
                  <Td align="right" className={v.low ? "text-ink" : "text-muted"}>{v.low}</Td>
                  <Td align="right">{all.high + all.medium + all.low}</Td>
                  <Td align="right">
                    <Link href={`/insights?competitor=${c.slug}`} className="text-xs font-medium text-accent hover:underline">
                      Insights
                    </Link>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <div className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">Top insights{featured ? ` · run #${featured.id}` : ""}</h2>
          <ViewAll href="/insights">All insights</ViewAll>
        </div>
        {insights && insights.length > 0 ? (
          <div className="grid gap-4">
            {insights.map((i) => (
              <InsightCard key={i.id} insight={i} competitor={byslug[i.competitor]} />
            ))}
          </div>
        ) : (
          <Empty>No insights yet. Capture baselines first; subsequent runs surface what changed.</Empty>
        )}
      </div>
    </div>
  );
}
