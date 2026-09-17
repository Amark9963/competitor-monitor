// Types mirror the JSON returned by competitor_monitor/api.py.

export type Significance = "high" | "medium" | "low";
export type Category =
  | "new_feature"
  | "product_update"
  | "pricing_change"
  | "business_change"
  | "partnership_or_integration"
  | "content_or_marketing"
  | "hiring_or_team"
  | "other";

export interface Run {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: "running" | "succeeded" | "failed";
  mode: "changes" | "full";
  error: string | null;
  stage: string | null;
  progress: string | null;
  change_count?: number;
  insight_count?: number;
}

export interface Insight {
  id: number;
  run_id: number;
  competitor: string;
  category: Category;
  significance: Significance;
  title: string;
  summary: string;
  implications_for_us: string;
  recommended_action: string;
  evidence_urls: string[];
  created_at: string;
  run_started_at?: string;
}

export interface Executive {
  headline: string;
  summary: string;
  watch_list: string[];
}

export interface SigCounts {
  high: number;
  medium: number;
  low: number;
}

export interface OverviewCompetitor {
  slug: string;
  name: string;
  domain: string;
  pages_tracked: number;
  insights_featured_run: SigCounts;
  insights_all_time: SigCounts;
}

export interface Overview {
  company: string;
  /** Most recent run of any kind. */
  latest_run: Run | null;
  /** Most recent run that produced insights; what the dashboard features. */
  featured_run: Run | null;
  executive: Executive | null;
  competitors: OverviewCompetitor[];
  running: Run | null;
}

export interface Change {
  id: number;
  run_id: number;
  competitor: string;
  url: string;
  page_type: string;
  title: string | null;
  change_type: "new" | "changed";
  changed_chars: number;
  detected_at: string;
  diff_text?: string;
}

export interface RunDetail {
  run: Run;
  report: { markdown: string; executive: Executive | null } | null;
  insights: Insight[];
  changes: Change[];
}

export interface TrackedPage {
  competitor: string;
  url: string;
  page_type: string;
  title: string | null;
  content_length: number;
  first_seen_at: string;
  last_seen_at: string;
  last_changed_at: string;
}

export interface Competitor {
  slug: string;
  name: string;
  domain: string;
  configured_pages: { url: string; type: string; depth: number }[];
  tracked_pages: TrackedPage[];
}

export const CATEGORY_LABELS: Record<Category, string> = {
  new_feature: "New feature",
  product_update: "Product update",
  pricing_change: "Pricing change",
  business_change: "Business change",
  partnership_or_integration: "Partnership / integration",
  content_or_marketing: "Content / marketing",
  hiring_or_team: "Hiring / team",
  other: "Other",
};

export const SIGNIFICANCE_LABELS: Record<Significance, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export function startRun(body: { competitors?: string[]; full?: boolean; analyze?: boolean }) {
  return api<{ run_id: number }>("/api/runs", { method: "POST", body: JSON.stringify(body) });
}

// ---- formatting helpers ----

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function duration(start: string, end: string | null): string {
  if (!end) return "…";
  const s = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? u.hostname.replace(/^www\./, "") : u.pathname;
  } catch {
    return url;
  }
}
