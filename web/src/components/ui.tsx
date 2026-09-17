import Link from "next/link";
import { CATEGORY_LABELS, Category, Insight, SIGNIFICANCE_LABELS, Significance, fmtDate, hostOf, pathOf } from "@/lib/api";
import { IconAlert, IconArrowRight, IconBolt, IconExternal, IconInbox, IconTarget, IconTrendDown, IconTrendUp } from "./icons";

/* ---------------------------------------------------------------- page chrome */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{eyebrow}</p>}
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-ink">{title}</h1>
        {description && <div className="mt-1.5 text-sm text-ink-2">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  children,
  className = "",
  title,
  description,
  action,
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  padded?: boolean;
}) {
  return (
    <section className={`rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgba(0,18,46,0.05)] ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-3.5">
          <div>
            {title && <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
          {action && <div className="shrink-0 text-xs">{action}</div>}
        </header>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 className="text-[15px] font-semibold tracking-tight text-ink">{children}</h2>
      {action}
    </div>
  );
}

export const btn = {
  primary:
    "inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-60",
  secondary:
    "inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-surface-2",
  ghost: "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink",
  link: "inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline",
};

/* ---------------------------------------------------------------- identity */

/** Competitor favicon via Google's favicon service, over an initial as fallback. */
export function Favicon({ domain, name, size = 20 }: { domain: string; name: string; size?: number }) {
  return (
    <span
      className="relative inline-grid shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-surface text-[10px] font-semibold text-ink-2"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span>{name.slice(0, 1)}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
        alt=""
        width={size - 4}
        height={size - 4}
        loading="lazy"
        className="absolute"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    </span>
  );
}

/* ---------------------------------------------------------------- badges */

const SIG_PILL: Record<Significance, string> = {
  high: "bg-[#fdecec] text-[#a32323] ring-[#f3c1c1] dark:bg-[#3a1717] dark:text-[#f2a0a0] dark:ring-[#5a2a2a]",
  medium: "bg-[#fff4d6] text-[#7a4b00] ring-[#f3dca0] dark:bg-[#3a2c0d] dark:text-[#f5cf7a] dark:ring-[#5a4520]",
  low: "bg-surface-2 text-ink-2 ring-border",
};
const SIG_DOT: Record<Significance, string> = { high: "bg-sig-high", medium: "bg-sig-medium", low: "bg-sig-low" };

export function SignificanceBadge({ level, compact = false }: { level: Significance; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${SIG_PILL[level]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${SIG_DOT[level]}`} aria-hidden />
      {compact ? SIGNIFICANCE_LABELS[level] : `${SIGNIFICANCE_LABELS[level]} significance`}
    </span>
  );
}

export function CategoryChip({ category }: { category: Category }) {
  return (
    <span className="inline-flex items-center rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
      {CATEGORY_LABELS[category] ?? category}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    succeeded: "bg-[#e6f4ea] text-[#0f5a2a] ring-[#bfe3c8] dark:bg-[#12301a] dark:text-[#9be09b] dark:ring-[#245a33]",
    failed: SIG_PILL.high,
    running: "bg-accent-soft text-accent ring-accent/30",
  };
  const label: Record<string, string> = { succeeded: "Succeeded", failed: "Failed", running: "Running" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${map[status] ?? SIG_PILL.low}`}>
      {status === "running" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden />}
      {label[status] ?? status}
    </span>
  );
}

/* ---------------------------------------------------------------- stat tile */

export function StatTile({
  label,
  value,
  hint,
  icon,
  delta,
  spark,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  /** Change vs. the previous comparable period; positive = more. */
  delta?: { value: number; label: string; invert?: boolean } | null;
  /** Small series for a sparkline (oldest -> newest). */
  spark?: number[];
}) {
  const up = !!delta && delta.value > 0;
  const down = !!delta && delta.value < 0;
  const good = delta ? (delta.invert ? down : up) : false;
  const bad = delta ? (delta.invert ? up : down) : false;
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(0,18,46,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</p>
        {icon && <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-soft text-accent">{icon}</span>}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[30px] font-semibold leading-none tracking-tight text-ink">{value}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-2">
            {delta && delta.value !== 0 && (
              <span className={`inline-flex items-center gap-0.5 font-semibold ${good ? "text-good" : bad ? "text-sig-high" : "text-ink-2"}`}>
                {up ? <IconTrendUp className="h-3.5 w-3.5" /> : <IconTrendDown className="h-3.5 w-3.5" />}
                {up ? "+" : ""}
                {delta.value}
              </span>
            )}
            {delta && <span className="text-muted">{delta.label}</span>}
            {!delta && hint}
          </div>
        </div>
        {spark && spark.length > 1 && <Sparkline data={spark} />}
      </div>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const w = 72;
  const h = 28;
  const pad = 3;
  const max = Math.max(1, ...data);
  const step = (w - pad * 2) / (data.length - 1);
  const pts = data.map((v, i) => [pad + i * step, h - pad - (v / max) * (h - pad * 2)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden>
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
    </svg>
  );
}

/* ---------------------------------------------------------------- tables */

export function Table({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}
export function Th({ children, align = "left", className = "" }: { children?: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return (
    <th className={`bg-surface-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted ${align === "right" ? "text-right" : "text-left"} ${className}`}>
      {children}
    </th>
  );
}
export function Td({ children, align = "left", className = "" }: { children?: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return <td className={`border-t border-border px-4 py-2.5 align-middle ${align === "right" ? "text-right" : ""} ${className}`}>{children}</td>;
}

/* ---------------------------------------------------------------- states */

export function Empty({ children, icon, action }: { children: React.ReactNode; icon?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-10 text-center">
      <span className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-muted">{icon ?? <IconInbox className="h-5 w-5" />}</span>
      <p className="max-w-sm text-sm text-ink-2">{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  const offline = /fetch|network|failed/i.test(message);
  return (
    <div className="flex gap-3 rounded-xl border border-sig-high/40 bg-surface p-4 text-sm">
      <IconAlert className="mt-0.5 h-5 w-5 shrink-0 text-sig-high" />
      <div>
        <p className="font-semibold text-sig-high">Could not load data</p>
        <p className="mt-1 text-ink-2">{message}</p>
        {offline && (
          <p className="mt-2 text-ink-2">
            Is the API running? Start it with <code className="rounded bg-surface-2 px-1">python -m competitor_monitor serve</code>
          </p>
        )}
      </div>
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

/* ---------------------------------------------------------------- insight card */

const SIG_BORDER: Record<Significance, string> = {
  high: "border-l-sig-high",
  medium: "border-l-sig-medium",
  low: "border-l-sig-low",
};

export function InsightCard({
  insight,
  competitor,
  showRun = false,
}: {
  insight: Insight;
  competitor?: { name: string; domain: string };
  showRun?: boolean;
}) {
  return (
    <article className={`rounded-xl border border-border border-l-4 bg-surface shadow-[0_1px_2px_rgba(0,18,46,0.05)] ${SIG_BORDER[insight.significance]}`}>
      <div className="flex flex-wrap items-center gap-2 px-5 pt-4 text-xs">
        {competitor && (
          <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
            <Favicon domain={competitor.domain} name={competitor.name} size={18} />
            {competitor.name}
          </span>
        )}
        <SignificanceBadge level={insight.significance} compact />
        <CategoryChip category={insight.category} />
        <span className="ml-auto text-muted">
          {showRun ? (
            <Link href={`/runs/${insight.run_id}`} className="hover:text-ink">
              Run #{insight.run_id} · {fmtDate(insight.run_started_at ?? insight.created_at)}
            </Link>
          ) : (
            fmtDate(insight.created_at)
          )}
        </span>
      </div>
      <div className="px-5 pb-5 pt-2.5">
        <h3 className="text-[15px] font-semibold leading-snug text-ink">{insight.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">{insight.summary}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-surface-2/60 p-3.5">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              <IconTarget className="h-3.5 w-3.5" /> Implications for Retell
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink">{insight.implications_for_us}</p>
          </div>
          <div className="rounded-lg border border-accent/20 bg-accent-soft/50 p-3.5">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent">
              <IconBolt className="h-3.5 w-3.5" /> Recommended action
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink">{insight.recommended_action}</p>
          </div>
        </div>
        {insight.evidence_urls.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted">Evidence</span>
            {insight.evidence_urls.map((u) => (
              <a
                key={u}
                href={u}
                target="_blank"
                rel="noreferrer"
                title={u}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-ink-2 hover:border-accent/40 hover:text-accent"
              >
                {hostOf(u)}
                <span className="max-w-[16rem] truncate text-muted">{pathOf(u) !== hostOf(u) ? pathOf(u) : ""}</span>
                <IconExternal className="h-3 w-3" />
              </a>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export function ViewAll({ href, children = "View all" }: { href: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className={btn.link}>
      {children} <IconArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}
