"use client";

import { useState } from "react";
import { OverviewCompetitor, SIGNIFICANCE_LABELS, Significance } from "@/lib/api";

const LEVELS: Significance[] = ["high", "medium", "low"];
const FILL: Record<Significance, string> = {
  high: "var(--sig-high)",
  medium: "var(--sig-medium)",
  low: "var(--sig-low)",
};

interface Props {
  competitors: OverviewCompetitor[];
  metric: "insights_featured_run" | "insights_all_time";
}

/**
 * Insights per competitor, stacked by significance. Horizontal so competitor
 * names read naturally; one shared x-scale; 2px surface gaps between segments.
 */
export function InsightChart({ competitors, metric }: Props) {
  const [hover, setHover] = useState<{ slug: string; level: Significance; x: number; y: number } | null>(null);
  const rows = competitors.map((c) => ({ ...c, counts: c[metric], total: LEVELS.reduce((s, l) => s + c[metric][l], 0) }));
  const max = Math.max(1, ...rows.map((r) => r.total));

  const labelW = 120;
  const barH = 18;
  const rowGap = 12;
  const width = 640;
  const plotW = width - labelW - 40;
  const height = rows.length * (barH + rowGap);

  if (rows.every((r) => r.total === 0)) {
    return <p className="text-sm text-ink-2">No insights yet for this view.</p>;
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label="Insights per competitor, stacked by significance"
        onMouseLeave={() => setHover(null)}
      >
        {rows.map((r, i) => {
          const y = i * (barH + rowGap);
          let x = labelW;
          return (
            <g key={r.slug}>
              <text x={labelW - 10} y={y + barH / 2} dominantBaseline="middle" textAnchor="end" fontSize="12" fill="var(--ink)">
                {r.name}
              </text>
              {/* baseline tick */}
              <line x1={labelW} x2={labelW} y1={y} y2={y + barH} stroke="var(--grid)" />
              {LEVELS.map((level) => {
                const n = r.counts[level];
                if (!n) return null;
                const w = (n / max) * plotW;
                const seg = { x, w };
                x += w;
                const isLast = level === LEVELS.filter((l) => r.counts[l] > 0).at(-1);
                return (
                  <g key={level}>
                    <rect
                      x={seg.x}
                      y={y}
                      width={Math.max(0, seg.w - 2)}
                      height={barH}
                      rx={isLast ? 4 : 0}
                      fill={FILL[level]}
                      onMouseMove={(e) => {
                        const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                        setHover({ slug: r.slug, level, x: e.clientX - box.left, y: e.clientY - box.top });
                      }}
                    />
                    {seg.w > 18 && (
                      <text
                        x={seg.x + (seg.w - 2) / 2}
                        y={y + barH / 2}
                        dominantBaseline="middle"
                        textAnchor="middle"
                        fontSize="11"
                        fill={level === "medium" ? "#0b0b0b" : "#ffffff"}
                        pointerEvents="none"
                      >
                        {n}
                      </text>
                    )}
                  </g>
                );
              })}
              <text x={x + 6} y={y + barH / 2} dominantBaseline="middle" fontSize="12" fill="var(--ink-2)" className="tabular">
                {r.total}
              </text>
            </g>
          );
        })}
      </svg>
      {hover && (() => {
        const r = rows.find((x) => x.slug === hover.slug)!;
        return (
          <div
            className="pointer-events-none absolute z-10 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs shadow"
            style={{ left: hover.x + 12, top: hover.y - 8 }}
            role="tooltip"
          >
            <span className="font-medium">{r.name}</span> · {SIGNIFICANCE_LABELS[hover.level]}:{" "}
            <span className="tabular">{r.counts[hover.level]}</span> of {r.total}
          </div>
        );
      })()}
      <ul className="mt-2 flex flex-wrap gap-4 text-xs text-ink-2" aria-label="Legend">
        {LEVELS.map((l) => (
          <li key={l} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: FILL[l] }} aria-hidden />
            {SIGNIFICANCE_LABELS[l]} significance
          </li>
        ))}
      </ul>
    </div>
  );
}
