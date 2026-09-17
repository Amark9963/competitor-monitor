"use client";

import { useMemo, useState } from "react";
import { Empty, ErrorBox, InsightCard, Skeleton } from "@/components/ui";
import { CATEGORY_LABELS, Category, Competitor, Insight, SIGNIFICANCE_LABELS, Significance } from "@/lib/api";
import { useApi } from "@/lib/hooks";

export default function InsightsPage() {
  const [competitor, setCompetitor] = useState("");
  const [significance, setSignificance] = useState("");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");

  const params = new URLSearchParams({ limit: "300" });
  if (competitor) params.set("competitor", competitor);
  if (significance) params.set("significance", significance);
  if (category) params.set("category", category);

  const { data, error, loading } = useApi<Insight[]>(`/api/insights?${params}`);
  const { data: competitors } = useApi<Competitor[]>("/api/competitors");
  const nameOf = Object.fromEntries((competitors ?? []).map((c) => [c.slug, c.name]));

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return q ? data.filter((i) => [i.title, i.summary, i.implications_for_us].join(" ").toLowerCase().includes(q)) : data;
  }, [data, query]);

  const select = "rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
      <div className="flex flex-wrap gap-2">
        <select className={select} value={competitor} onChange={(e) => setCompetitor(e.target.value)} aria-label="Competitor">
          <option value="">All competitors</option>
          {(competitors ?? []).map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
        <select className={select} value={significance} onChange={(e) => setSignificance(e.target.value)} aria-label="Significance">
          <option value="">Any significance</option>
          {(Object.keys(SIGNIFICANCE_LABELS) as Significance[]).map((s) => (
            <option key={s} value={s}>{SIGNIFICANCE_LABELS[s]}</option>
          ))}
        </select>
        <select className={select} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">Any category</option>
          {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${select} min-w-48 flex-1`}
          aria-label="Search insights"
        />
      </div>
      {error ? (
        <ErrorBox message={error} />
      ) : loading ? (
        <Skeleton lines={5} />
      ) : filtered.length === 0 ? (
        <Empty>No insights match these filters.</Empty>
      ) : (
        <>
          <p className="text-xs text-muted">{filtered.length} insight(s)</p>
          <div className="grid gap-4">
            {filtered.map((i) => (
              <InsightCard key={i.id} insight={i} competitorName={nameOf[i.competitor] ?? i.competitor} showRun />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
