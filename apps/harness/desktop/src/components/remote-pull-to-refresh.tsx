import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "../lib/i18n";
import { installRemotePullToRefresh } from "../lib/remote-pull-to-refresh";

export function RemotePullToRefresh({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const { t } = useTranslation();
  useEffect(() => {
    if (!enabled || !ref.current) return;
    return installRemotePullToRefresh(ref.current, setProgress, () => location.reload());
  }, [enabled]);
  return (
    <div ref={ref} className="h-full w-full">
      {enabled && progress > 0 && (
        <div role="status" className="pointer-events-none absolute inset-x-0 top-3 z-[100] flex justify-center">
          <span className="rounded-xl bg-[#2b2b2b] px-4 py-3 text-xs text-white shadow-lg">
            {t(progress >= 1 ? "remoteControl.releaseToRefresh" : "remoteControl.pullToRefresh")}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}
