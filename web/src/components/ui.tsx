import Link from "next/link";
import { CATEGORY_LABELS, Category, Insight, SIGNIFICANCE_LABELS, Significance, fmtDate, hostOf, pathOf } from "@/lib/api";

// Significance is a severity, so it uses the reserved status colors and always ships icon + label.
const SIG_STYLE: Record<Significance, { dot: string; text: string }> = {
  high: { dot: "bg-sig-high", text: "text-sig-high" },
  medium: { dot: "bg-sig-medium", text: "text-ink-2" },
  low: { dot: "bg-sig-low", text: "text-ink-2" },
};

export function SignificanceBadge({ level }: { level: Significance }) {
  const s = SIG_STYLE[level];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.text}`}>
      <span className={`inline-block h-2 w-2 rounded-full ${s.dot}`} aria-hidden />
      {SIGNIFICANCE_LABELS[level]}
    </span>
  );
}

export function CategoryChip({ category }: { category: Category }) {
  return (
    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
      {CATEGORY_LABELS[category] ?? category}
    </span>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(0,18,46,0.04)] ${className}`}>{children}</section>;
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 className="text-base font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

/** Stat tile: one headline number with a label. No plot, so no hover layer. */
export function StatTile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(0,18,46,0.04)]">
      <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: "linear-gradient(90deg, var(--accent), var(--brand-2))" }} aria-hidden />
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-2">{hint}</p>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-ink-2">{children}</p>;
}

export function ErrorBox({ message }: { message: string }) {
  const offline = /fetch|network|failed/i.test(message);
  return (
    <div className="rounded-xl border border-sig-high/40 bg-surface p-4 text-sm">
      <p className="font-medium text-sig-high">Could not load data</p>
      <p className="mt-1 text-ink-2">{message}</p>
      {offline && (
        <p className="mt-2 text-ink-2">
          Is the API running? Start it with <code className="rounded bg-surface-2 px-1">python -m competitor_monitor serve</code>
        </p>
      )}
    </div>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-2" aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 rounded bg-surface-2" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}

export function InsightCard({
  insight,
  competitorName,
  showRun = false,
}: {
  insight: Insight;
  competitorName?: string;
  showRun?: boolean;
}) {
  return (
    <article className="rounded-xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(0,18,46,0.04)]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <SignificanceBadge level={insight.significance} />
        <CategoryChip category={insight.category} />
        {competitorName && <span className="font-medium text-ink-2">{competitorName}</span>}
        {showRun && (
          <Link href={`/runs/${insight.run_id}`} className="ml-auto text-muted hover:text-ink">
            Run #{insight.run_id} · {fmtDate(insight.run_started_at ?? insight.created_at)}
          </Link>
        )}
      </div>
      <h3 className="mt-2 text-base font-semibold leading-snug">{insight.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{insight.summary}</p>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-lg bg-surface-2 p-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">Implications for us</dt>
          <dd className="mt-1 leading-relaxed">{insight.implications_for_us}</dd>
        </div>
        <div className="rounded-lg bg-surface-2 p-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">Recommended action</dt>
          <dd className="mt-1 leading-relaxed">{insight.recommended_action}</dd>
        </div>
      </dl>
      {insight.evidence_urls.length > 0 && (
        <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <span className="text-muted">Evidence:</span>
          {insight.evidence_urls.map((u) => (
            <a key={u} href={u} target="_blank" rel="noreferrer" className="text-accent hover:underline" title={u}>
              {hostOf(u)}
              {pathOf(u) !== hostOf(u) ? pathOf(u) : ""}
            </a>
          ))}
        </p>
      )}
    </article>
  );
}
