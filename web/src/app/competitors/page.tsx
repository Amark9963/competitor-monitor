"use client";

import { Card, Empty, ErrorBox, SectionTitle, Skeleton } from "@/components/ui";
import { Competitor, fmtDate, pathOf, timeAgo } from "@/lib/api";
import { useApi } from "@/lib/hooks";

export default function CompetitorsPage() {
  const { data, error, loading } = useApi<Competitor[]>("/api/competitors");

  if (error) return <ErrorBox message={error} />;
  if (loading || !data) return <Skeleton lines={6} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Competitors</h1>
        <p className="mt-1 text-sm text-ink-2">
          Tracked pages and when each last changed. Edit <code className="rounded bg-surface-2 px-1">config/competitors.json</code> to add sites or pages.
        </p>
      </div>
      {data.map((c) => {
        const tracked = [...c.tracked_pages].sort((a, b) => b.last_changed_at.localeCompare(a.last_changed_at));
        return (
          <Card key={c.slug}>
            <SectionTitle
              action={
                <span className="text-xs text-muted">
                  {c.configured_pages.length} start URL(s) · {tracked.length} page(s) tracked
                </span>
              }
            >
              {c.name} <span className="ml-2 text-sm font-normal text-muted">{c.domain}</span>
            </SectionTitle>

            <div className="mb-3 flex flex-wrap gap-1.5">
              {c.configured_pages.map((p) => (
                <a
                  key={p.url}
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-border px-2 py-0.5 text-xs text-ink-2 hover:bg-surface-2"
                  title={p.url}
                >
                  {p.type}
                  {p.depth > 0 && <span className="text-muted"> · follows links</span>}
                </a>
              ))}
            </div>

            {tracked.length === 0 ? (
              <Empty>No baseline yet — run the monitor to capture one.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted">
                    <tr>
                      <th className="py-1.5 font-medium">Page</th>
                      <th className="py-1.5 font-medium">Type</th>
                      <th className="py-1.5 font-medium">Last changed</th>
                      <th className="py-1.5 font-medium">Last seen</th>
                      <th className="py-1.5 text-right font-medium">Size</th>
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    {tracked.map((p) => (
                      <tr key={p.url} className="border-t border-border">
                        <td className="max-w-md py-1.5 pr-3">
                          <a href={p.url} target="_blank" rel="noreferrer" className="block truncate text-accent hover:underline" title={p.url}>
                            {p.title || pathOf(p.url)}
                          </a>
                          <span className="block truncate text-xs text-muted">{pathOf(p.url)}</span>
                        </td>
                        <td className="py-1.5 pr-3 text-xs text-ink-2">{p.page_type}</td>
                        <td className="py-1.5 pr-3" title={fmtDate(p.last_changed_at)}>{timeAgo(p.last_changed_at)}</td>
                        <td className="py-1.5 pr-3" title={fmtDate(p.last_seen_at)}>{timeAgo(p.last_seen_at)}</td>
                        <td className="py-1.5 text-right text-xs text-ink-2">{(p.content_length / 1000).toFixed(1)} k</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
