"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Run } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { NAV_LINKS, isActive } from "./nav-links";

/** Fixed navy sidebar (desktop). Mobile navigation lives in TopBar. */
export function Sidebar() {
  const pathname = usePathname();
  const { data: status, error } = useApi<{ running: Run | null }>("/api/status", { refreshMs: 10000 });

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar text-sidebar-ink lg:flex">
      <Link href="/" className="flex items-center gap-3 px-6 pb-5 pt-6">
        <Wordmark />
      </Link>

      <nav className="flex-1 space-y-0.5 px-3" aria-label="Primary">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-white/10 text-white" : "text-sidebar-muted hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className={`h-[18px] w-[18px] ${active ? "text-accent" : ""}`} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-6 py-4 text-xs text-sidebar-muted">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${error ? "bg-sig-high" : status?.running ? "bg-accent" : "bg-good"}`} aria-hidden />
          {error ? "API offline" : status?.running ? "Run in progress" : "API connected"}
        </div>
        <p className="mt-2">Competitive intelligence for Retell AI</p>
      </div>
    </aside>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        className="grid h-8 w-8 place-items-center rounded-lg text-sm font-bold text-white"
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
