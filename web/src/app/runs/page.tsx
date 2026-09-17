"use client";

import Link from "next/link";
import { IconChevron } from "@/components/icons";
import { Card, Empty, ErrorBox, PageHeader, Skeleton, StatusPill, Table, Td, Th } from "@/components/ui";
import { Run, duration, fmtDate } from "@/lib/api";
import { useApi } from "@/lib/hooks";

export default function RunsPage() {
  const { data, error, loading } = useApi<Run[]>("/api/runs?limit=100", { refreshMs: 10000 });
  const succeeded = data?.filter((r) => r.status === "succeeded").length ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="Monitoring"
        title="Runs"
        description={data ? `${data.length} run${data.length === 1 ? "" : "s"} · ${succeeded} succeeded` : "Every scrape → diff → analysis cycle."}
      />
      {error ? (
        <ErrorBox message={error} />
      ) : loading ? (
        <Skeleton lines={5} />
      ) : !data || data.length === 0 ? (
        <Empty>No runs yet. Use Run now to capture a baseline.</Empty>
      ) : (
        <Card padded={false}>
          <Table>
            <thead>
              <tr>
                <Th>Run</Th>
                <Th>Started</Th>
                <Th>Mode</Th>
                <Th>Status</Th>
                <Th align="right">Duration</Th>
                <Th align="right">Changes</Th>
                <Th align="right">Insights</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody className="tabular">
              {data.map((r) => (
                <tr key={r.id} className="group hover:bg-surface-2/60">
                  <Td>
                    <Link href={`/runs/${r.id}`} className="font-semibold text-ink hover:text-accent">#{r.id}</Link>
                  </Td>
                  <Td className="text-ink-2">{fmtDate(r.started_at)}</Td>
                  <Td className="text-ink-2">{r.mode === "full" ? "Full review" : "Changes only"}</Td>
                  <Td>
                    <span className="flex items-center gap-2">
                      <StatusPill status={r.status} />
                      {r.status === "running" && r.progress && <span className="text-xs text-ink-2">{r.progress}</span>}
                      {r.error && <span className="truncate text-xs text-ink-2" title={r.error}>{r.error.slice(0, 60)}</span>}
                    </span>
                  </Td>
                  <Td align="right" className="text-ink-2">{duration(r.started_at, r.finished_at)}</Td>
                  <Td align="right">{r.change_count}</Td>
                  <Td align="right" className={r.insight_count ? "font-semibold text-ink" : "text-muted"}>{r.insight_count}</Td>
                  <Td align="right">
                    <Link href={`/runs/${r.id}`} className="inline-flex text-muted group-hover:text-accent" aria-label={`Open run ${r.id}`}>
                      <IconChevron className="h-4 w-4" />
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
