"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RunControls } from "./RunControls";
import { NAV_LINKS, isActive } from "./nav-links";
import { Wordmark } from "./Sidebar";

/** Slim header: mobile brand + nav (hidden on desktop where the sidebar takes over) and run controls. */
export function TopBar() {
  const pathname = usePathname();
  const current = NAV_LINKS.find((l) => isActive(l.href, pathname));
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3 sm:px-8">
        <Link href="/" className="text-ink lg:hidden">
          <Wordmark compact />
        </Link>
        <p className="hidden text-sm text-muted lg:block">{current?.label ?? "Competitor Monitor"}</p>
        <div className="ml-auto">
          <RunControls />
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-4 pb-2 lg:hidden" aria-label="Primary (mobile)">
        {NAV_LINKS.map((l) => {
          const active = isActive(l.href, pathname);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`whitespace-nowrap rounded-lg px-3 py-1 text-sm ${active ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-surface-2"}`}
              aria-current={active ? "page" : undefined}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
