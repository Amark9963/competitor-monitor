"use client";

import { useState } from "react";

/** Executive-summary paragraphs, collapsed to the first `initial` with a toggle. */
export function BriefBody({ text, initial = 2, tone = "light" }: { text: string; initial?: number; tone?: "light" | "dark" }) {
  const [open, setOpen] = useState(false);
  const paras = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\*\*/g, "").trim())
    .filter(Boolean);
  const shown = open ? paras : paras.slice(0, initial);
  const more = paras.length - initial;
  const dark = tone === "dark";
  return (
    <div className={`space-y-3 text-[13.5px] leading-relaxed ${dark ? "text-white/80" : "text-ink-2"}`}>
      {shown.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {more > 0 && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`text-[13px] font-medium ${dark ? "text-white/90 hover:text-white" : "text-accent hover:underline"}`}
        >
          {open ? "Show less" : `Read ${more} more paragraph${more === 1 ? "" : "s"}`}
        </button>
      )}
    </div>
  );
}
