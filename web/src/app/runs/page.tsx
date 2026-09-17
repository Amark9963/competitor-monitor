"use client";

import Link from "next/link";
import { Empty, ErrorBox, Skeleton } from "@/components/ui";
import { Run, duration, fmtDate } from "@/lib/api";
import { useApi } from "@/lib/hooks";

const STATUS_STYLE: Record<Run["status"], string> = {
  succeeded: "text-good",
  failed: "text-sig-high",
  running: "text-accent",
};

export default function RunsPage() {
  const { data, error, loading } = useApi<Run[]>("/api/runs?limit=100", { refreshMs: 10000 });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Runs</h1>
      {error ? (
        <ErrorBox message={error} />
      ) : loading ? (
        <Skeleton lines={5} />
      ) : !data || data.length === 0 ? (
        <Empty>No runs yet.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Run</th>
                <th className="px-4 py-2 font-medium">Started</th>
                <th className="px-4 py-2 font-medium">Duration</th>
                <th className="px-4 py-2 font-medium">Mode</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Changes</th>
                <th className="px-4 py-2 text-right font-medium">Insights</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {data.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-surface-2">
                  <td className="px-4 py-2">
                    <Link href={`/runs/${r.id}`} className="font-medium text-accent hover:underline">#{r.id}</Link>
                  </td>
                  <td className="px-4 py-2">{fmtDate(r.started_at)}</td>
                  <td className="px-4 py-2">{duration(r.started_at, r.finished_at)}</td>
                  <td className="px-4 py-2">{r.mode === "full" ? "Full review" : "Changes"}</td>
                  <td className={`px-4 py-2 ${STATUS_STYLE[r.status]}`}>
                    {r.status}
                    {r.status === "running" && r.progress && <span className="ml-1 text-ink-2">· {r.progress}</span>}
                    {r.error && <span className="ml-1 text-ink-2" title={r.error}>· {r.error.slice(0, 60)}</span>}
                  </td>
                  <td className="px-4 py-2 text-right">{r.change_count}</td>
                  <td className="px-4 py-2 text-right">{r.insight_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
