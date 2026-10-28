import { useEffect, useState } from "react";
import type { LocalRequestLog } from "./usage-logs";

/** Remote usage belongs to the paired host, not this browser's IndexedDB. */
export function useHostUsageLogs(enabled: boolean, revision: number) {
  const [logs, setLogs] = useState<LocalRequestLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let pending = false;
    let dirty = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      if (pending) { dirty = true; return; }
      pending = true;
      try {
        if (!window.electron?.getUsageLogs) throw new Error("REMOTE_CAPABILITY_DENIED");
        const next = await window.electron.getUsageLogs();
        if (!Array.isArray(next)) throw new Error("REMOTE_INVALID_RESPONSE");
        if (!disposed) { setLogs(next); setError(false); }
      } catch {
        if (!disposed) setError(true);
      } finally {
        pending = false;
        if (!disposed) {
          setLoading(false);
          if (dirty) { dirty = false; void load(); }
        }
      }
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = undefined; void load(); }, 200);
    };
    setLoading(true);
    void load();
    const unsubscribeChanged = window.electron?.onConversationsChanged?.(data => { if (!data?.uiOnly) schedule(); });
    const unsubscribeEnded = window.electron?.onSessionEnded?.(schedule);
    const unsubscribeUsage = window.electron?.onAgentEvent?.(event => {
      if (["usage", "llm_request", "subagent_updated", "subagent_finished"].includes(event.type)) schedule();
    });
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      unsubscribeChanged?.();
      unsubscribeEnded?.();
      unsubscribeUsage?.();
    };
  }, [enabled, revision]);
  return { logs, loading, error };
}
