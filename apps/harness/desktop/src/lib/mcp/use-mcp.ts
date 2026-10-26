import { useCallback, useEffect, useState } from "react";
import type { McpConnectionView } from "./types";

export function useMcpConnections(workspacePath?: string) {
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<{
    workspacePath?: string;
    connections: McpConnectionView[];
    error: boolean;
  }>();
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let cancelled = false;
    const bridge = window.electron?.mcp;
    if (!bridge) {
      setSnapshot({ workspacePath, connections: [], error: true });
      return;
    }
    bridge
      .list(workspacePath)
      .then((connections) => {
        if (!cancelled)
          setSnapshot({ workspacePath, connections, error: false });
      })
      .catch(() => {
        if (!cancelled)
          setSnapshot({ workspacePath, connections: [], error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [workspacePath, revision]);
  useEffect(() => {
    const unsubscribe = window.electron?.mcp?.onChanged(refresh);
    const plugins = window.electron?.marketplace?.onChanged(refresh);
    return () => {
      unsubscribe?.();
      plugins?.();
    };
  }, [refresh]);
  const current =
    snapshot?.workspacePath === workspacePath ? snapshot : undefined;
  return {
    connections: current?.connections ?? [],
    error: current?.error ?? false,
    loading: !current,
    refresh,
  };
}
