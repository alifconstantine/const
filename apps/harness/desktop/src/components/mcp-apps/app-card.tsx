import { useEffect, useRef, useState } from "react";
import {
  AppBridge,
  PostMessageTransport,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import { ExternalLink, Loader2, RotateCw, Check } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@const/ui";
import { useTranslation } from "../../lib/i18n";
import {
  sandboxHtml,
  type McpAppRef,
  type McpAppView,
} from "../../lib/mcp/apps";
import { normalizeDiagram, previewElements } from "./diagram";
import { PluginIcon } from "../settings/plugin-icon";

export function McpAppCard({
  app,
  onOpenFile,
}: {
  app: McpAppRef;
  onOpenFile?: (filePath: string) => void;
}) {
  const { t, language } = useTranslation();
  const frame = useRef<HTMLIFrameElement>(null);
  const bridge = useRef<AppBridge | null>(null);
  const [view, setView] = useState<McpAppView>();
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [saved, setSaved] = useState(false);
  const [sharing, setSharing] = useState(false);
  const consent = useRef<((allowed: boolean) => void) | undefined>(undefined);
  const shared = useRef(false);
  const initialFrameLoaded = useRef(false);
  const populateFrame = useRef<() => void>(() => {});
  const open = useRef(onOpenFile);
  open.current = onOpenFile;
  useEffect(() => {
    let cancelled = false;
    setError(false);
    setView(undefined);
    setSaved(false);
    initialFrameLoaded.current = false;
    void (async () => {
      try {
        const value = await window.electron!.mcp!.appView(app.id);
        if (cancelled) return;
        if (value.filePath) {
          const scene = await normalizeDiagram(value);
          if (cancelled) return;
          await window.electron!.mcp!.saveDiagram(app.id, scene);
          value.scene = scene;
          // Reopen the latest local edits rather than replaying the original model inputs.
          let cameras: any[] = [];
          try {
            cameras = JSON.parse(String(value.arguments.elements)).filter(
              (el: any) => el.type === "cameraUpdate",
            );
          } catch {}
          value.arguments = {
            ...value.arguments,
            elements: JSON.stringify([
              ...cameras,
              ...previewElements(scene.elements),
            ]),
          };
        }
        if (!cancelled) {
          setSaved(!!value.filePath);
          setView(value);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          // A provider outage must not hide an already saved local editor.
          if (app.filePath) {
            try {
              await window.electron!.mcp!.readDiagram(app.filePath);
              if (!cancelled) setSaved(true);
            } catch {
              /* This card has not materialized a local file yet. */
            }
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [app.id, revision]);
  useEffect(() => {
    if (!view || !frame.current?.contentWindow) return;
    const api = new AppBridge(
      null,
      { name: "Const Harness", version: "1.0.0" },
      { serverTools: {}, openLinks: {}, updateModelContext: {}, logging: {} },
      {
        hostContext: {
          theme: "dark",
          locale: language,
          displayMode: "inline",
          availableDisplayModes: ["inline", "fullscreen"],
          containerDimensions: {
            width: frame.current.clientWidth,
            height: 420,
          },
        },
      },
    );
    bridge.current = api;
    const handshake = setTimeout(() => setError(true), 30000);
    api.oninitialized = async () => {
      clearTimeout(handshake);
      await api.sendToolInput({ arguments: view.arguments });
      await api.sendToolResult(view.result as any);
    };
    api.oncalltool = async ({ name, arguments: args }) => {
      let approved = false;
      if (name === "export_to_excalidraw") {
        if (consent.current) throw new Error("busy");
        approved = await new Promise<boolean>((resolve) => {
          consent.current = resolve;
          setSharing(true);
        });
        consent.current = undefined;
        setSharing(false);
        if (!approved)
          return {
            isError: true,
            content: [{ type: "text", text: t("common.cancel") }],
          };
        shared.current = true;
      }
      try {
        const result = await window.electron!.mcp!.appCall(
          app.id,
          name,
          args ?? {},
          approved,
        );
        if (name === "save_checkpoint") setSaved(true);
        return result;
      } catch {
        setError(true);
        throw new Error(t("mcp.appSaveError"));
      }
    };
    api.onopenlink = async ({ url }) => {
      if (!shared.current || new URL(url).origin !== "https://excalidraw.com")
        throw new Error("invalid");
      await window.electron?.openExternal(url);
      return {};
    };
    api.onupdatemodelcontext = async ({ content }) => {
      await window.electron!.mcp!.appContext(
        app.id,
        JSON.stringify(content ?? []),
      );
      return {};
    };
    api.onrequestdisplaymode = async () => {
      if (view.filePath) open.current?.(view.filePath);
      return { mode: "inline" };
    };
    const updated = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.id !== app.id || !Array.isArray(detail.scene?.elements))
        return;
      void api
        .sendToolInput({
          arguments: {
            ...view.arguments,
            elements: JSON.stringify(previewElements(detail.scene.elements)),
          },
        })
        .then(() => api.sendToolResult(view.result as any))
        .catch(() => {});
    };
    window.addEventListener("const:diagram-saved", updated);
    const element = frame.current;
    let connected = false;
    let populated = false;
    const populate = () => {
      if (
        connected &&
        initialFrameLoaded.current &&
        !populated &&
        bridge.current === api
      ) {
        populated = true;
        // A new bridge needs a fresh app handshake even when HTML is unchanged
        // (for example when the user changes the host language).
        element.srcdoc =
          sandboxHtml(view.html, view.csp) +
          `<!-- host:${crypto.randomUUID()} -->`;
      }
    };
    populateFrame.current = populate;
    // Install the message listener before navigating the opaque-origin iframe.
    void api
      .connect(
        new PostMessageTransport(
          element.contentWindow!,
          element.contentWindow!,
        ),
      )
      .then(() => {
        connected = true;
        populate();
      })
      .catch(() => setError(true));
    return () => {
      clearTimeout(handshake);
      populateFrame.current = () => {};
      window.removeEventListener("const:diagram-saved", updated);
      consent.current?.(false);
      consent.current = undefined;
      bridge.current = null;
      void api.close();
    };
  }, [view, app.id, language, t]);
  return (
    <section
      className="overflow-hidden rounded-2xl bg-[#222222] my-3"
      aria-label={app.title}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <PluginIcon name="excalidraw" className="size-5 shrink-0" />
          <span className="text-sm font-medium text-white truncate">
            {app.title}
          </span>
          {saved && (
            <Check
              className="size-3.5 text-[#969696]"
              aria-label={t("mcp.appSaved")}
            />
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          disabled={!saved || !app.filePath || !onOpenFile}
          onClick={() => app.filePath && onOpenFile?.(app.filePath)}
        >
          <ExternalLink className="size-3.5 mr-2" />
          {t("mcp.appOpen")}
        </Button>
      </div>
      {error ? (
        <div className="p-5 text-sm text-[#969696] flex items-center gap-3">
          <span>{t("mcp.appError")}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRevision((value) => value + 1)}
          >
            <RotateCw className="size-3.5 mr-2" />
            {t("mcp.appRetry")}
          </Button>
        </div>
      ) : !view ? (
        <div className="h-[320px] grid place-items-center text-[#969696]">
          <span className="flex items-center gap-2 text-xs">
            <Loader2 className="size-4 animate-spin" />
            {t("mcp.appPreparing")}
          </span>
        </div>
      ) : (
        <div className="grid place-items-center bg-white">
          <iframe
            ref={frame}
            title={app.title}
            srcDoc=""
            onLoad={() => {
              initialFrameLoaded.current = true;
              populateFrame.current();
            }}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            className="h-[420px] w-full max-w-[560px] bg-white"
          />
        </div>
      )}
      <Dialog
        open={sharing}
        onOpenChange={(value) => {
          if (!value) consent.current?.(false);
        }}
      >
        <DialogContent className="rounded-2xl bg-[#222222] max-w-md">
          <DialogTitle>{t("mcp.appShareTitle")}</DialogTitle>
          <DialogDescription>{t("mcp.appShareDescription")}</DialogDescription>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="ghost" onClick={() => consent.current?.(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => consent.current?.(true)}>
              {t("mcp.appShareConfirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
