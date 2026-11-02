import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { useTranslation } from "../../lib/i18n";

/** Reuse BrowserTab's existing controls with the host guest, without a browser-only webview tag. */
export function RemoteBrowserViewport({
  tabId,
  conversationId,
  url,
  webviewRef,
}: {
  tabId: string;
  conversationId?: string;
  url: string;
  webviewRef: MutableRefObject<any>;
}) {
  const { t } = useTranslation();
  const [frame, setFrame] = useState("");
  const [failed, setFailed] = useState(false);
  const image = useRef<HTMLImageElement>(null);
  const touch = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const refresh = useRef<() => Promise<void>>(async () => {});
  const shim = useMemo(() => {
    const events = new Map<string, Set<(event: any) => void>>();
    let currentUrl = url,
      back = false,
      forward = false,
      zoom = 1;
    const emit = (name: string, value = {}) => {
      for (const listener of events.get(name) || []) listener(value);
    };
    const act = async (action: string, data = {}) => {
      const result = await window.electron!.browser!.remoteInput!({
        tabId,
        action,
        ...data,
      });
      if (result?.url) {
        currentUrl = result.url;
        back = !!result.canGoBack;
        forward = !!result.canGoForward;
        emit("did-navigate", { url: currentUrl });
      }
      await refresh.current();
      return result;
    };
    const run = (action: string, data = {}) => {
      void act(action, data).catch(() => setFailed(true));
    };
    return {
      addEventListener(name: string, handler: (value: any) => void) {
        const set = events.get(name) || new Set();
        set.add(handler);
        events.set(name, set);
      },
      removeEventListener(name: string, handler: (value: any) => void) {
        events.get(name)?.delete(handler);
      },
      loadURL(next: string) {
        emit("did-start-loading");
        void act("navigate", { url: next })
          .finally(() => emit("did-stop-loading"))
          .catch(() => setFailed(true));
      },
      getURL: () => currentUrl,
      canGoBack: () => back,
      canGoForward: () => forward,
      goBack: () => run("back"),
      goForward: () => run("forward"),
      reload: () => run("reload"),
      reloadIgnoringCache: () => run("reload"),
      stop() {},
      getZoomFactor: () => zoom,
      setZoomFactor(value: number) {
        zoom = value;
        run("zoom", { factor: value });
      },
      setAudioMuted: (muted: boolean) => run("mute", { muted }),
      openDevTools: () => run("devtools"),
      executeJavaScript: (script: string) => act("evaluate", { script }),
      update(next: string, title?: string) {
        if (next !== currentUrl) {
          currentUrl = next;
          emit("did-navigate", { url: next });
        }
        if (title) emit("page-title-updated", { title });
      },
      act,
    };
  }, [tabId]);
  useLayoutEffect(() => {
    webviewRef.current = shim;
    return () => {
      if (webviewRef.current === shim) webviewRef.current = null;
    };
  }, [shim, webviewRef]);
  useEffect(() => {
    let disposed = false,
      busy = false;
    const capture = async () => {
      if (
        disposed ||
        busy ||
        (image.current && (!image.current.getClientRects().length || image.current.closest('[aria-hidden="true"]')))
      )
        return;
      busy = true;
      try {
        const shot = await window.electron!.browser!.screenshot({
          tabId,
          format: "jpeg",
          quality: 55,
          ephemeral: true,
          annotate: false,
        });
        if (!disposed) {
          setFrame(shot.dataUrl);
          setFailed(false);
          shim.update(shot.url, shot.title);
        }
      } catch {
        if (!disposed) setFailed(true);
      } finally {
        busy = false;
      }
    };
    refresh.current = capture;
    void window.electron!.browser!.openTab!(url, { tabId, conversationId, newTab: false })
      .then(capture)
      .catch(() => setFailed(true));
    const timer = setInterval(() => void capture(), 1500);
    return () => {
      disposed = true;
      clearInterval(timer);
      refresh.current = async () => {};
    };
  }, [tabId, conversationId, shim]);
  return (
    <div
      className="relative h-full min-h-0 flex-1 touch-none overflow-hidden bg-[#161616] outline-none"
      data-remote-browser
      tabIndex={0}
      aria-label={t("rightPane.browser")}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse") return;
        suppressClick.current = false;
        touch.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      }}
      onPointerMove={(event) => {
        const start = touch.current;
        if (!start || start.id !== event.pointerId) return;
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) {
          start.moved = true;
        }
      }}
      onPointerUp={(event) => {
        const start = touch.current;
        touch.current = null;
        if (!start || start.id !== event.pointerId || !start.moved) return;
        suppressClick.current = true;
        void shim.act("scroll", { deltaY: Math.max(-1000, Math.min(1000, event.clientY - start.y)) })
          .catch(() => setFailed(true));
      }}
      onPointerCancel={() => { touch.current = null; suppressClick.current = true; }}
      onLostPointerCapture={() => { touch.current = null; }}
      onKeyDown={(event) => {
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          void shim
            .act("text", { text: event.key })
            .catch(() => setFailed(true));
        } else if (
          [
            "Enter",
            "Backspace",
            "Tab",
            "Escape",
            "ArrowLeft",
            "ArrowRight",
            "ArrowUp",
            "ArrowDown",
          ].includes(event.key)
        ) {
          event.preventDefault();
          void shim.act("key", { key: event.key }).catch(() => setFailed(true));
        }
      }}
      onWheel={(event) => {
        void shim
          .act("scroll", {
            deltaY: Math.max(-1000, Math.min(1000, -event.deltaY)),
          })
          .catch(() => setFailed(true));
      }}
    >
      {frame && (
        <img
          ref={image}
          src={frame}
          alt={t("rightPane.browser")}
          draggable={false}
          className="w-full object-contain object-top"
          onClick={(event) => {
            if (suppressClick.current) { suppressClick.current = false; return; }
            const box = event.currentTarget.getBoundingClientRect();
            event.currentTarget.parentElement?.focus();
            void shim
              .act("click", {
                x: (event.clientX - box.left) / box.width,
                y: (event.clientY - box.top) / box.height,
              })
              .catch(() => setFailed(true));
          }}
        />
      )}
      {failed && (
        <p
          role="status"
          className="absolute bottom-3 left-3 right-3 rounded-xl bg-[#222222] px-3 py-2 text-xs text-[#d4d4d4]"
        >
          {t("remoteControl.actionError")}
        </p>
      )}
    </div>
  );
}
