"use client";

import Link from "next/link";
import { useState } from "react";
import { InsightChart } from "@/components/InsightChart";
import { Card, Empty, ErrorBox, InsightCard, SectionTitle, Skeleton, StatTile } from "@/components/ui";
import { Insight, Overview, duration, fmtDate, timeAgo } from "@/lib/api";
import { useApi } from "@/lib/hooks";

type Metric = "insights_featured_run" | "insights_all_time";

export default function DashboardPage() {
  const { data, error, loading } = useApi<Overview>("/api/overview");
  const featuredId = data?.featured_run?.id;
  const { data: insights } = useApi<Insight[]>(featuredId ? `/api/insights?run_id=${featuredId}&limit=6` : null);
  const [metric, setMetric] = useState<Metric>("insights_featured_run");

  if (error) return <ErrorBox message={error} />;
  if (loading || !data) return <Skeleton lines={6} />;

  const last = data.latest_run;
  const featured = data.featured_run;
  const nameOf = Object.fromEntries(data.competitors.map((c) => [c.slug, c.name]));
  const totals = data.competitors.reduce(
    (acc, c) => ({
      high: acc.high + c.insights_featured_run.high,
      all: acc.all + c.insights_featured_run.high + c.insights_featured_run.medium + c.insights_featured_run.low,
    }),
    { high: 0, all: 0 },
  );
  const pagesTracked = data.competitors.reduce((s, c) => s + c.pages_tracked, 0);
  const lastIsFeatured = last && featured && last.id === featured.id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{data.company} — competitive intelligence</h1>
        <p className="mt-1 text-sm text-ink-2">
          {last ? (
            <>
              Last run <Link href={`/runs/${last.id}`} className="text-accent hover:underline">#{last.id}</Link>{" "}
              {last.status === "succeeded" ? "completed" : last.status} {timeAgo(last.finished_at ?? last.started_at)}
              {last.finished_at && <> in {duration(last.started_at, last.finished_at)}</>}
              {last.mode === "full" && " (full review)"}
              {!lastIsFeatured && last.status === "succeeded" && " — no new insights"}
              {featured && !lastIsFeatured && (
                <>
                  . Showing results from run{" "}
                  <Link href={`/runs/${featured.id}`} className="text-accent hover:underline">#{featured.id}</Link>{" "}
                  ({timeAgo(featured.finished_at ?? featured.started_at)}).
                </>
              )}
            </>
          ) : (
            "No runs yet — use Run now to capture a baseline."
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Insights" value={totals.all} hint={featured ? `Run #${featured.id} · ${fmtDate(featured.started_at)}` : "No analyzed run yet"} />
        <StatTile label="High significance" value={totals.high} hint="Likely to affect roadmap, pricing or positioning" />
        <StatTile label="Competitors" value={data.competitors.length} hint={`${data.competitors.filter((c) => c.pages_tracked > 0).length} with a baseline`} />
        <StatTile label="Pages tracked" value={pagesTracked} hint="Across all competitors" />
      </div>

      {data.executive ? (
        <Card>
          <SectionTitle action={featured && <Link href={`/runs/${featured.id}`} className="text-xs text-accent hover:underline">Run #{featured.id}</Link>}>
            Executive summary
          </SectionTitle>
          <p className="text-lg font-semibold leading-snug">{data.executive.headline}</p>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-2">
            {data.executive.summary.split(/\n{2,}/).map((p, i) => (
              <p key={i}>{p.replace(/\*\*/g, "")}</p>
            ))}
          </div>
          {data.executive.watch_list.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Watch list</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {data.executive.watch_list.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <SectionTitle>Executive summary</SectionTitle>
          <p className="text-sm text-ink-2">
            {featured
              ? <>Run #{featured.id} has insights but no stored summary — <Link href={`/runs/${featured.id}`} className="text-accent hover:underline">open its report</Link>.</>
              : "No analyzed run yet. Capture baselines first, then subsequent runs will surface changes here."}
          </p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <SectionTitle
            action={
              <div className="flex gap-1 text-xs" role="tablist" aria-label="Metric">
                {(["insights_featured_run", "insights_all_time"] as const).map((m) => (
                  <button
                    key={m}
                    role="tab"
                    aria-selected={metric === m}
                    onClick={() => setMetric(m)}
                    className={`rounded-md px-2 py-1 ${metric === m ? "bg-surface-2 text-ink" : "text-ink-2 hover:text-ink"}`}
                  >
                    {m === "insights_featured_run" ? (featured ? `Run #${featured.id}` : "Latest") : "All time"}
                  </button>
                ))}
              </div>
            }
          >
            Insights by competitor
          </SectionTitle>
          <InsightChart competitors={data.competitors} metric={metric} />
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle action={<Link href="/competitors" className="text-xs text-accent hover:underline">Details</Link>}>
            Coverage
          </SectionTitle>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="pb-2 font-medium">Competitor</th>
                <th className="pb-2 text-right font-medium">Pages</th>
                <th className="pb-2 text-right font-medium">High</th>
                <th className="pb-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {data.competitors.map((c) => {
                const v = c[metric];
                return (
                  <tr key={c.slug} className="border-t border-border">
                    <td className="py-2">
                      <span className="font-medium">{c.name}</span>
                      <span className="ml-2 text-xs text-muted">{c.domain}</span>
                    </td>
                    <td className="py-2 text-right">{c.pages_tracked || <span className="text-muted">none</span>}</td>
                    <td className="py-2 text-right">{v.high}</td>
                    <td className="py-2 text-right">{v.high + v.medium + v.low}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>

      <div>
        <SectionTitle action={<Link href="/insights" className="text-xs text-accent hover:underline">All insights</Link>}>
          Top insights{featured ? ` from run #${featured.id}` : ""}
        </SectionTitle>
        {insights && insights.length > 0 ? (
          <div className="grid gap-4">
            {insights.map((i) => (
              <InsightCard key={i.id} insight={i} competitorName={nameOf[i.competitor]} />
            ))}
          </div>
        ) : (
          <Empty>No insights yet.</Empty>
        )}
      </div>
    </div>
  );
}
