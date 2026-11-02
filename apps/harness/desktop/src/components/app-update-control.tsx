import { useMemo } from "react";
import { UpdateControl } from "../../../shared/updates/update-control";
import { useTranslation } from "../lib/i18n";
import { useRemoteRuntime } from "../lib/remote-runtime";

export function DesktopUpdateControl({ settings = false }: { settings?: boolean }) {
  const remote = useRemoteRuntime();
  const { dictionary, language } = useTranslation();
  const api = window.electron?.updates;
  const client = useMemo(() => api ? { ...api, subscribe: api.onState } : null, [api]);
  if (remote || !client) return null;
  return <UpdateControl client={client} labels={dictionary.updates} language={language} settings={settings} />;
}
