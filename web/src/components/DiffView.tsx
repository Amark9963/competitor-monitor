"use client";

import { useState } from "react";
import { Change } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { Skeleton } from "./ui";

/** Renders a stored unified diff (or full content for a new page) with +/- colouring. */
export function DiffView({ changeId, changeType }: { changeId: number; changeType: Change["change_type"] }) {
  const { data, error, loading } = useApi<Change>(`/api/changes/${changeId}`);
  const [expanded, setExpanded] = useState(false);

  if (loading) return <Skeleton lines={4} />;
  if (error || !data?.diff_text) return <p className="text-sm text-ink-2">{error ?? "No diff stored."}</p>;

  const lines = data.diff_text.split("\n");
  const LIMIT = 80;
  const shown = expanded ? lines : lines.slice(0, LIMIT);

  return (
    <div className="rounded-md border border-border bg-surface text-xs">
      <div className="border-b border-border px-3 py-1.5 text-muted">
        {changeType === "new" ? "Full content of new page" : "Unified diff · lines starting with − were removed, + were added"}
      </div>
      <pre className="max-h-[32rem] overflow-auto py-2 font-mono leading-5">
        {shown.map((ln, i) => {
          const cls =
            changeType === "changed"
              ? ln.startsWith("+++") || ln.startsWith("---")
                ? "diff-hunk"
                : ln.startsWith("+")
                  ? "diff-add"
                  : ln.startsWith("-")
                    ? "diff-del"
                    : ln.startsWith("@@")
                      ? "diff-hunk"
                      : ""
              : "";
          return (
            <span key={i} className={`diff-line ${cls}`}>
              {ln || " "}
            </span>
          );
        })}
      </pre>
      {lines.length > LIMIT && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="w-full border-t border-border px-3 py-1.5 text-left text-accent hover:bg-surface-2"
        >
          {expanded ? "Show less" : `Show all ${lines.length} lines`}
        </button>
      )}
    </div>
  );
}
