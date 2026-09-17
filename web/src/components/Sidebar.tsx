"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Run, timeAgo } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { IconExternal } from "./icons";
import { NAV_LINKS, isActive } from "./nav-links";
import type { StatusResponse } from "./RunControls";

const GROUPS = [
  { label: "Overview", hrefs: ["/", "/insights"] },
  { label: "Monitoring", hrefs: ["/runs", "/competitors"] },
];

/** Fixed navy sidebar (desktop). Mobile navigation lives in TopBar. */
export function Sidebar() {
  const pathname = usePathname();
  const { data: status, error } = useApi<StatusResponse>("/api/status", { refreshMs: 10000 });
  const { data: runs } = useApi<Run[]>("/api/runs?limit=1");
  const last = runs?.[0];

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar text-sidebar-ink lg:flex">
      <Link href="/" className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
        <Wordmark />
      </Link>

      <nav className="flex-1 space-y-6 px-3 pt-5" aria-label="Primary">
        {GROUPS.map((g) => (
          <div key={g.label}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted/80">{g.label}</p>
            <div className="space-y-0.5">
              {NAV_LINKS.filter((l) => g.hrefs.includes(l.href)).map(({ href, label, icon: Icon }) => {
                const active = isActive(href, pathname);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors ${
                      active ? "bg-white/10 text-white" : "text-sidebar-muted hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {active && <span className="absolute inset-y-1.5 -left-3 w-0.5 rounded-r bg-accent" aria-hidden />}
                    <Icon className={`h-[18px] w-[18px] ${active ? "text-accent" : ""}`} />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <div>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted/80">Resources</p>
          <a
            href="https://github.com/Amark9963/competitor-monitor"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium text-sidebar-muted hover:bg-white/5 hover:text-white"
          >
            <IconExternal className="h-[18px] w-[18px]" />
            Repository
          </a>
        </div>
      </nav>

      <div className="border-t border-white/10 px-5 py-4">
        <div className="rounded-lg bg-white/5 p-3 text-xs">
          <div className="flex items-center gap-2 font-medium text-white">
            <span className={`inline-block h-2 w-2 rounded-full ${error ? "bg-sig-high" : status?.running ? "animate-pulse bg-accent" : "bg-[#3ccb6a]"}`} aria-hidden />
            {error ? "API offline" : status?.demo ? "Read-only demo" : status?.running ? "Run in progress" : "All systems normal"}
          </div>
          <p className="mt-1 text-sidebar-muted">
            {status?.demo
              ? "Snapshot of real monitoring runs"
              : status?.running
                ? status.running.progress
                : last
                  ? `Last run ${timeAgo(last.finished_at ?? last.started_at)}`
                  : "No runs yet"}
          </p>
        </div>
        <p className="mt-3 text-[11px] text-sidebar-muted">Retell AI · Competitive Intelligence</p>
      </div>
    </aside>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        className="grid h-8 w-8 place-items-center rounded-lg text-sm font-bold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
        style={{ background: "linear-gradient(135deg, var(--accent) 0%, var(--brand-2) 100%)" }}
        aria-hidden
      >
        R
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-tight">Retell AI</span>
        {!compact && <span className="block text-[11px] text-sidebar-muted">Competitor Monitor</span>}
      </span>
    </span>
  );
}
