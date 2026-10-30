import { useCallback, useEffect, useState } from "react";
import type { PluginInventory } from "./types";

export function usePluginInventory(workspacePath?: string) {
  const [snapshot, setSnapshot] = useState<{
    workspacePath?: string;
    inventory: PluginInventory;
    error: boolean;
  }>();
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let cancelled = false;
    const bridge = window.electron?.marketplace;
    if (!bridge) {
      setSnapshot({
        workspacePath,
        inventory: { catalog: [], installed: [] },
        error: true,
      });
    } else {
      bridge
        .listPlugins(workspacePath)
        .then((value) => {
          if (!cancelled) {
            setSnapshot({ workspacePath, inventory: value, error: false });
          }
        })
        .catch(() => {
          if (!cancelled)
            setSnapshot({
              workspacePath,
              inventory: { catalog: [], installed: [] },
              error: true,
            });
        });
    }
    return () => {
      cancelled = true;
    };
  }, [workspacePath, revision]);
  useEffect(() => {
    const unsubscribe = window.electron?.marketplace?.onChanged(refresh);
    return unsubscribe;
  }, [refresh]);
  const current =
    snapshot?.workspacePath === workspacePath ? snapshot : undefined;
  return {
    catalog: current?.inventory.catalog ?? [],
    installed: current?.inventory.installed ?? [],
    error: current?.error ?? false,
    loading: !current,
    refresh,
  };
}
