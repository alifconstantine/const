import React, { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { Download, RotateCcw, Send, ExternalLink } from "lucide-react";
import { toast } from "@const/ui";
import { useTranslation } from "../../lib/i18n";
import { validUiState } from "./schema";
import {
  parseWidget,
  parseWidgetMessage,
  widgetPreview,
} from "./widget-contract";
import { buildWidgetDocument } from "./widget-document";
import {
  ProgramSource,
  type IntelligenceBlockProps,
} from "./intelligence-block";

function cleanHtml(html: string) {
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: [
      "script",
      "iframe",
      "object",
      "embed",
      "base",
      "meta",
      "link",
    ],
    FORBID_ATTR: ["srcdoc", "autofocus", "formaction", "target"],
    ADD_TAGS: ["style"],
  });
}

export default function WidgetBlock({
  program,
  complete,
  isStreaming,
  disabled,
  state,
  onStateChange,
  onSubmit,
  onOpenBrowser,
}: IntelligenceBlockProps) {
  const { t, language } = useTranslation();
  const widget = useMemo(() => parseWidget(program), [program]);
  const preview = useMemo(
    () => (!complete ? widgetPreview(program) : null),
    [program, complete],
  );
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light",
  );
  useEffect(() => {
    const observer = new MutationObserver(() =>
      setTheme(
        document.documentElement.classList.contains("dark") ? "dark" : "light",
      ),
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);
  const frame = useRef<HTMLIFrameElement>(null);
  const saved = useRef(
    validUiState(state) ? state : widget?.initialState || {},
  );
  const hydrated = useRef(validUiState(state));
  const callbacks = useRef({
    onStateChange,
    onSubmit,
    onOpenBrowser,
    disabled,
  });
  callbacks.current = { onStateChange, onSubmit, onOpenBrowser, disabled };
  const [revision, setRevision] = useState(0);
  const [source, setSource] = useState<{ key: string; html: string } | null>(
    null,
  );
  const [height, setHeight] = useState(320);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const sending = useRef(false);
  const snapshot = useRef<null | (() => Promise<Record<string, unknown>>)>(
    null,
  );
  const setInteraction = useRef<(disabled: boolean) => void>(() => {});
  const [followUp, setFollowUp] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const executable = complete && !!widget && !isStreaming;
  const content = executable ? widget : preview;
  const sanitized = useMemo(
    () => (content ? { ...content, html: cleanHtml(content.html) } : null),
    [content],
  );

  useEffect(() => {
    setReady(false);
    setFailed(false);
    setFollowUp("");
    setLink(null);
    if (!sanitized) {
      setSource(null);
      return;
    }
    if (executable && !hydrated.current) {
      saved.current = widget?.initialState || {};
      hydrated.current = true;
    }
    const channel = crypto.randomUUID();
    const nonce = crypto.randomUUID();
    let messageCount = 0;
    let windowStart = Date.now();
    let lastSaved = JSON.stringify(saved.current);
    setInteraction.current = (locked) =>
      frame.current?.contentWindow?.postMessage(
        { channel, type: "interaction", disabled: locked },
        "*",
      );
    const requests = new Map<
      string,
      {
        resolve: (value: Record<string, unknown>) => void;
        reject: () => void;
        timer: ReturnType<typeof setTimeout>;
      }
    >();
    snapshot.current = () =>
      new Promise((resolve, reject) => {
        const requestId = crypto.randomUUID();
        const fail = () => {
          requests.delete(requestId);
          reject(new Error("Widget snapshot unavailable"));
        };
        requests.set(requestId, {
          resolve,
          reject: fail,
          timer: setTimeout(fail, 1500),
        });
        frame.current?.contentWindow?.postMessage(
          { channel, type: "snapshot", requestId },
          "*",
        );
      });
    const listener = (event: MessageEvent) => {
      if (
        !executable ||
        event.source !== frame.current?.contentWindow ||
        event.origin !== "null"
      )
        return;
      if (Date.now() - windowStart >= 1000) {
        messageCount = 0;
        windowStart = Date.now();
      }
      if (++messageCount > 120) return;
      const message = parseWidgetMessage(event.data, channel);
      if (!message) return;
      switch (message.type) {
        case "ready":
          clearTimeout(timeout);
          setReady(true);
          setInteraction.current(callbacks.current.disabled || sending.current);
          break;
        case "error":
          clearTimeout(timeout);
          setFailed(true);
          break;
        case "resize":
          setHeight(message.height);
          break;
        case "snapshot":
        case "state": {
          const serialized = JSON.stringify(message.state);
          if (serialized !== lastSaved) {
            lastSaved = serialized;
            saved.current = message.state;
            callbacks.current.onStateChange?.(message.state);
          }
          if (message.type === "snapshot") {
            const request = requests.get(message.requestId);
            if (request) {
              clearTimeout(request.timer);
              requests.delete(message.requestId);
              request.resolve(message.state);
            }
          }
          break;
        }
        case "followUp":
          if (!callbacks.current.disabled) setFollowUp(message.text);
          break;
        case "openLink":
          if (!callbacks.current.disabled) setLink(message.url);
          break;
      }
    };
    // Listen before assigning srcDoc; iframe scripts can post during its first load.
    window.addEventListener("message", listener);
    const timeout = executable
      ? setTimeout(() => setFailed(true), 30_000)
      : undefined;
    setHeight(320);
    // Mount one complete document per channel. Mounting srcDoc="" first can race
    // the initial about:blank navigation and leave Chromium with a blank frame.
    setSource({
      key: channel,
      html: buildWidgetDocument(sanitized, {
        channel,
        nonce,
        theme,
        language,
        state: saved.current,
        preview: !executable,
      }),
    });
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("message", listener);
      snapshot.current = null;
      setInteraction.current = () => {};
      for (const request of requests.values()) {
        clearTimeout(request.timer);
        request.reject();
      }
      requests.clear();
    };
  }, [sanitized, executable, theme, language, revision, widget]);

  const reset = () => {
    if (!widget || disabled || pending) return;
    saved.current = widget.initialState;
    onStateChange?.(saved.current);
    setRevision((value) => value + 1);
  };
  const submit = async () => {
    if (
      !widget ||
      !onSubmit ||
      disabled ||
      !ready ||
      failed ||
      !executable ||
      sending.current
    )
      return;
    sending.current = true;
    setPending(true);
    const prompt =
      followUp ||
      t("intelligenceUi.widgetQuestion").replace("{title}", widget.title);
    try {
      if (!snapshot.current) throw new Error("Widget unavailable");
      const current = await snapshot.current();
      if (callbacks.current.disabled) return;
      await onSubmit(
        `${prompt}\n\n${t("intelligenceUi.formValues")}: ${JSON.stringify(current, null, 2)}`,
      );
      setFollowUp("");
    } catch {
      toast.error(t("intelligenceUi.submitFailed"));
    } finally {
      sending.current = false;
      setPending(false);
    }
  };
  const download = async () => {
    if (!widget || !executable || !sanitized) return;
    try {
      const current =
        ready && !failed && snapshot.current
          ? await snapshot.current()
          : saved.current;
      const html = buildWidgetDocument(
        { ...widget, html: sanitized.html },
        {
          channel: crypto.randomUUID(),
          nonce: crypto.randomUUID(),
          theme,
          language,
          state: current,
          standalone: true,
          exportNotice: t("intelligenceUi.widgetExportNotice"),
        },
      );
      const url = URL.createObjectURL(
        new Blob([html], { type: "text/html;charset=utf-8" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${widget.title.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 60) || "widget"}.html`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error(t("intelligenceUi.widgetRuntimeError"));
    }
  };

  const locked = disabled || !executable || !ready || failed || pending;
  useEffect(() => {
    setInteraction.current(locked);
    if (locked && document.activeElement === frame.current)
      frame.current?.blur();
  }, [locked]);

  if (!content)
    return (
      <div
        role="status"
        className="rounded-2xl bg-black/[0.025] p-4 text-sm dark:bg-[#222222]"
      >
        {t(
          complete || !isStreaming
            ? "intelligenceUi.unavailable"
            : "intelligenceUi.preparing",
        )}
        {complete && <ProgramSource program={program} />}
      </div>
    );
  return (
    <section
      data-intelligence-widget
      className="min-w-0 overflow-hidden rounded-2xl bg-black/[0.025] dark:bg-[#222222]"
      aria-label={content.title}
      aria-busy={isStreaming || (executable && !ready && !failed)}
    >
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="min-w-0 flex-1 break-words text-sm font-medium">
          {content.title}
        </span>
        <button
          type="button"
          onClick={reset}
          disabled={disabled || !executable || pending}
          title={t("intelligenceUi.widgetReset")}
          aria-label={t("intelligenceUi.widgetReset")}
          className="rounded-lg p-2 disabled:opacity-40"
        >
          <RotateCcw className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => void download()}
          disabled={!executable}
          title={t("intelligenceUi.widgetExport")}
          aria-label={t("intelligenceUi.widgetExport")}
          className="rounded-lg p-2 disabled:opacity-40"
        >
          <Download className="size-4" />
        </button>
      </div>
      {widget?.description && (
        <p className="px-4 pb-3 text-sm">{widget.description}</p>
      )}
      {failed ? (
        <p role="status" className="px-4 pb-3 text-sm">
          {t("intelligenceUi.widgetRuntimeError")}
        </p>
      ) : (
        <>
          {!ready && (
            <p role="status" className="px-4 pb-2 text-xs text-[#969696]">
              {t(
                !complete && !isStreaming
                  ? "intelligenceUi.unavailable"
                  : "intelligenceUi.preparing",
              )}
            </p>
          )}
          <div className={locked ? "pointer-events-none opacity-60" : ""}>
            {source && (
              <iframe
                key={source.key}
                ref={frame}
                title={content.title}
                srcDoc={source.html}
                sandbox={executable ? "allow-scripts" : ""}
                referrerPolicy="no-referrer"
                tabIndex={locked ? -1 : 0}
                aria-disabled={locked}
                allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'"
                className="block w-full border-0"
                style={{ height }}
              />
            )}
          </div>
        </>
      )}
      {followUp && (
        <p className="whitespace-pre-wrap break-words px-4 pt-3 text-sm">
          {followUp}
        </p>
      )}
      <div className="flex flex-wrap gap-2 p-4">
        <button
          type="button"
          disabled={locked || !onSubmit}
          onClick={() => void submit()}
          className="flex items-center gap-2 rounded-xl bg-black/5 px-3 py-2 text-sm disabled:opacity-40 dark:bg-[#2b2b2b]"
        >
          <Send className="size-4" />
          {t(
            followUp ? "intelligenceUi.widgetSend" : "intelligenceUi.widgetAsk",
          )}
        </button>
        {link && (
          <button
            type="button"
            disabled={locked}
            onClick={() => {
              if (onOpenBrowser) onOpenBrowser(link);
              else window.open(link, "_blank", "noopener,noreferrer");
              setLink(null);
            }}
            title={link}
            className="flex items-center gap-2 break-all rounded-xl px-3 py-2 text-sm disabled:opacity-40"
          >
            <ExternalLink className="size-4 shrink-0" />
            {t("intelligenceUi.widgetOpenLink")} · {new URL(link).hostname}
          </button>
        )}
      </div>
      <div className="px-4 pb-3">
        <ProgramSource program={program} />
      </div>
    </section>
  );
}
