"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RunControls } from "./RunControls";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/insights", label: "Insights" },
  { href: "/runs", label: "Runs" },
  { href: "/competitors", label: "Competitors" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
          Competitor Monitor
        </Link>
        <nav className="ml-2 hidden items-center gap-1 sm:flex" aria-label="Primary">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto">
          <RunControls />
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-4 pb-2 sm:hidden" aria-label="Primary (mobile)">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="rounded-md px-3 py-1 text-sm text-ink-2 hover:bg-surface-2">
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
