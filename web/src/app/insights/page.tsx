"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { IconSearch } from "@/components/icons";
import { Empty, ErrorBox, InsightCard, PageHeader, Skeleton } from "@/components/ui";
import { CATEGORY_LABELS, Category, Competitor, Insight, SIGNIFICANCE_LABELS, Significance } from "@/lib/api";
import { useApi } from "@/lib/hooks";

export default function InsightsPage() {
  return (
    <Suspense fallback={<Skeleton lines={5} />}>
      <InsightsView />
    </Suspense>
  );
}

function InsightsView() {
  const params0 = useSearchParams();
  const [competitor, setCompetitor] = useState(params0.get("competitor") ?? "");
  const [significance, setSignificance] = useState("");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");

  const params = new URLSearchParams({ limit: "300" });
  if (competitor) params.set("competitor", competitor);
  if (category) params.set("category", category);

  const { data, error, loading } = useApi<Insight[]>(`/api/insights?${params}`);
  const { data: competitors } = useApi<Competitor[]>("/api/competitors");
  const byslug = Object.fromEntries((competitors ?? []).map((c) => [c.slug, c]));

  const counts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 };
    for (const i of data ?? []) c[i.significance]++;
    return c;
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.filter(
      (i) =>
        (!significance || i.significance === significance) &&
        (!q || [i.title, i.summary, i.implications_for_us, i.recommended_action].join(" ").toLowerCase().includes(q)),
    );
  }, [data, query, significance]);

  const select = "h-9 rounded-lg border border-border bg-surface px-2.5 text-sm text-ink";
  const sigLevels: Significance[] = ["high", "medium", "low"];

  return (
    <div>
      <PageHeader eyebrow="Overview" title="Insights" description="Every insight extracted across runs, newest first." />

      <div className="mb-4 rounded-xl border border-border bg-surface p-3 shadow-[0_1px_2px_rgba(0,18,46,0.05)]">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <IconSearch className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted" />
            <input
              type="search"
              placeholder="Search titles, summaries, actions…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={`${select} w-full pl-8`}
              aria-label="Search insights"
            />
          </div>
          <select className={select} value={competitor} onChange={(e) => setCompetitor(e.target.value)} aria-label="Competitor">
            <option value="">All competitors</option>
            {(competitors ?? []).map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
          <select className={select} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
            <option value="">All categories</option>
            {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3" role="group" aria-label="Significance">
          <button
            type="button"
            onClick={() => setSignificance("")}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${!significance ? "bg-ink text-white" : "bg-surface-2 text-ink-2 hover:text-ink"}`}
          >
            All <span className="ml-1 opacity-70">{data?.length ?? 0}</span>
          </button>
          {sigLevels.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSignificance((cur) => (cur === s ? "" : s))}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                significance === s ? "bg-ink text-white" : "bg-surface-2 text-ink-2 hover:text-ink"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${s === "high" ? "bg-sig-high" : s === "medium" ? "bg-sig-medium" : "bg-sig-low"}`} aria-hidden />
              {SIGNIFICANCE_LABELS[s]} <span className="opacity-70">{counts[s]}</span>
            </button>
          ))}
          <span className="ml-auto text-xs text-muted">{filtered.length} shown</span>
        </div>
      </div>

      {error ? (
        <ErrorBox message={error} />
      ) : loading ? (
        <Skeleton lines={5} />
      ) : filtered.length === 0 ? (
        <Empty>No insights match these filters.</Empty>
      ) : (
        <div className="grid gap-4">
          {filtered.map((i) => (
            <InsightCard key={i.id} insight={i} competitor={byslug[i.competitor]} showRun />
          ))}
        </div>
      )}
    </div>
  );
}
