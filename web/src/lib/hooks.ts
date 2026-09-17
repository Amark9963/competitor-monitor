"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

interface Options {
  /** Re-fetch on this interval (ms). 0 disables polling. */
  refreshMs?: number;
}

interface Result<T> {
  path: string;
  data: T | null;
  error: string | null;
}

/** Minimal fetch hook: GET `path`, expose data/error/loading, optional polling + manual refresh. */
export function useApi<T>(path: string | null, { refreshMs = 0 }: Options = {}) {
  const [result, setResult] = useState<Result<T> | null>(null);
  const latest = useRef(0);

  const refresh = useCallback(async () => {
    if (!path) return;
    const seq = ++latest.current;
    try {
      const data = await api<T>(path);
      if (seq === latest.current) setResult({ path, data, error: null });
    } catch (e) {
      if (seq === latest.current) {
        setResult((prev) => ({ path, data: prev?.path === path ? prev.data : null, error: e instanceof Error ? e.message : String(e) }));
      }
    }
  }, [path]);

  useEffect(() => {
    refresh();
    // Any page re-fetches when a run finishes (event fired by RunControls).
    window.addEventListener(RUN_FINISHED_EVENT, refresh);
    const id = refreshMs ? setInterval(refresh, refreshMs) : undefined;
    return () => {
      window.removeEventListener(RUN_FINISHED_EVENT, refresh);
      if (id) clearInterval(id);
    };
  }, [refresh, refreshMs]);

  // Loading is derived: we have no result yet for the current path.
  const current = result && result.path === path ? result : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: !!path && current === null,
    refresh,
  };
}

export const RUN_FINISHED_EVENT = "monitor:run-finished";

export function announceRunFinished() {
  window.dispatchEvent(new Event(RUN_FINISHED_EVENT));
}
