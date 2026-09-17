"use client";

import Link from "next/link";
import { IconExternal } from "@/components/icons";
import { Card, Empty, ErrorBox, Favicon, PageHeader, Skeleton, Table, Td, Th, btn } from "@/components/ui";
import { Competitor, Overview, fmtDate, pathOf, timeAgo } from "@/lib/api";
import { useApi } from "@/lib/hooks";

export default function CompetitorsPage() {
  const { data, error, loading } = useApi<Competitor[]>("/api/competitors");
  const { data: overview } = useApi<Overview>("/api/overview");

  if (error) return <ErrorBox message={error} />;
  if (loading || !data) return <Skeleton lines={6} />;

  const stats = Object.fromEntries((overview?.competitors ?? []).map((c) => [c.slug, c]));

  return (
    <div>
      <PageHeader
        eyebrow="Monitoring"
        title="Competitors"
        description={
          <>
            {data.length} competitors · {data.reduce((s, c) => s + c.tracked_pages.length, 0)} pages tracked. Edit{" "}
            <code className="rounded bg-surface-2 px-1 text-xs">config/competitors.json</code> to add sites or pages.
          </>
        }
      />

      <div className="space-y-6">
        {data.map((c) => {
          const tracked = [...c.tracked_pages].sort((a, b) => b.last_changed_at.localeCompare(a.last_changed_at));
          const lastChange = tracked[0]?.last_changed_at;
          const all = stats[c.slug]?.insights_all_time;
          const total = all ? all.high + all.medium + all.low : 0;
          return (
            <Card
              key={c.slug}
              padded={false}
              title={
                <span className="flex items-center gap-3">
                  <Favicon domain={c.domain} name={c.name} size={28} />
                  <span>
                    {c.name}
                    <a href={`https://${c.domain}`} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-muted hover:text-accent">
                      {c.domain} <IconExternal className="h-3 w-3" />
                    </a>
                  </span>
                </span>
              }
              action={
                <Link href={`/insights?competitor=${c.slug}`} className={btn.secondary}>
                  View insights
                </Link>
              }
            >
              <div className="grid grid-cols-2 divide-x divide-border border-b border-border sm:grid-cols-4">
                {[
                  { label: "Pages tracked", value: tracked.length },
                  { label: "Start URLs", value: c.configured_pages.length },
                  { label: "Last change", value: lastChange ? timeAgo(lastChange) : "—" },
                  { label: "Insights (all time)", value: total, sub: all ? `${all.high} high` : undefined },
                ].map((m) => (
                  <div key={m.label} className="px-5 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{m.label}</p>
                    <p className="mt-0.5 text-xl font-semibold tracking-tight text-ink">
                      {m.value}
                      {m.sub && <span className="ml-2 text-xs font-medium text-sig-high">{m.sub}</span>}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-5 py-3">
                <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Monitored</span>
                {c.configured_pages.map((p) => (
                  <a
                    key={p.url}
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs capitalize text-ink-2 hover:border-accent/40 hover:text-accent"
                    title={p.url}
                  >
                    {p.type}
                    {p.depth > 0 && <span className="text-muted">· +links</span>}
                  </a>
                ))}
              </div>

              {tracked.length === 0 ? (
                <div className="p-5">
                  <Empty>No baseline yet — run the monitor to capture one.</Empty>
                </div>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Page</Th>
                      <Th>Type</Th>
                      <Th>Last changed</Th>
                      <Th>Last seen</Th>
                      <Th align="right">Size</Th>
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    {tracked.map((p) => (
                      <tr key={p.url} className="hover:bg-surface-2/60">
                        <Td className="max-w-md">
                          <a href={p.url} target="_blank" rel="noreferrer" className="block truncate font-medium text-ink hover:text-accent" title={p.url}>
                            {p.title || pathOf(p.url)}
                          </a>
                          <span className="block truncate text-xs text-muted">{pathOf(p.url)}</span>
                        </Td>
                        <Td className="text-xs capitalize text-ink-2">{p.page_type}</Td>
                        <Td className="text-ink-2" >
                          <span title={fmtDate(p.last_changed_at)}>{timeAgo(p.last_changed_at)}</span>
                        </Td>
                        <Td className="text-ink-2">
                          <span title={fmtDate(p.last_seen_at)}>{timeAgo(p.last_seen_at)}</span>
                        </Td>
                        <Td align="right" className="text-xs text-ink-2">{(p.content_length / 1000).toFixed(1)} k</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
