"use client";
import { useEffect, useRef, useState } from "react";
import { remoteCopy } from "@const/remote/copy";
import { useI18n } from "@/context/I18nContext";

/** Mount the desktop renderer separately so Electron never enters Next's server graph. */
export function RemoteWorkspace({
  sessionId,
  convexUrl,
  accountsUrl = "https://accounts.const.web.id",
}: {
  sessionId: string;
  convexUrl: string;
  accountsUrl?: string;
}) {
  const element = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { locale } = useI18n();
  const t = remoteCopy(locale);
  useEffect(() => {
    let disposed = false;
    let unmount: (() => void) | undefined;
    setError(false);
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "/remote/workspace.css";
    document.head.appendChild(css);
    const script = document.createElement("script");
    script.type = "module";
    script.src = "/remote/workspace.js";
    const ready = () => {
      if (disposed || !element.current) return;
      try {
        unmount = (window as any).ConstRemoteWorkspace.mount(element.current, {
          sessionId,
          convexUrl,
          accountsUrl,
        });
      } catch {
        setError(true);
      }
    };
    script.addEventListener("load", ready);
    script.addEventListener("error", () => {
      if (!disposed) setError(true);
    });
    document.head.appendChild(script);
    return () => {
      disposed = true;
      unmount?.();
      script.remove();
      css.remove();
    };
  }, [sessionId, convexUrl, accountsUrl, attempt]);
  return (
    <>
      <div ref={element} id="remote-workspace" className="fixed inset-0" />
      {error && (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#161616] p-8 text-center text-white">
          <p>{t("error")}</p>
          <button
            className="rounded-xl bg-[#2b2b2b] px-4 py-2"
            onClick={() => setAttempt((value) => value + 1)}
          >
            {t("retry")}
          </button>
        </div>
      )}
    </>
  );
}
