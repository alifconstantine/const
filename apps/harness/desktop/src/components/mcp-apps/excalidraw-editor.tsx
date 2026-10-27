import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@const/ui";
import { useTranslation } from "../../lib/i18n";
import { loadExcalidraw, downloadBlob } from "./diagram";
import "@excalidraw/excalidraw/index.css";

export default function ExcalidrawEditor({ filePath }: { filePath: string }) {
  const { t, language } = useTranslation();
  const [loaded, setLoaded] = useState<{
    Editor: any;
    id: string;
    scene: any;
  }>();
  const [status, setStatus] = useState<
    "loading" | "saving" | "saved" | "error"
  >("loading");
  const sceneRef = useRef<any>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const save = useRef<() => Promise<void>>(async () => {});
  const [revision, setRevision] = useState(0);
  const savedSignature = useRef("");
  const dirty = useRef(false);
  const currentId = useRef<string | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    setLoaded(undefined);
    setStatus("loading");
    void (async () => {
      try {
        const [library, app] = await Promise.all([
          loadExcalidraw(),
          window.electron!.mcp!.readDiagram(filePath),
        ]);
        if (cancelled) return;
        if (!app.scene) throw new Error("invalid");
        sceneRef.current = app.scene;
        currentId.current = app.id;
        savedSignature.current = JSON.stringify([
          app.scene.elements,
          app.scene.files,
          app.scene.appState?.viewBackgroundColor,
        ]);
        save.current = async () => {
          const snapshot = sceneRef.current;
          setStatus("saving");
          try {
            await window.electron!.mcp!.saveDiagram(app.id, snapshot);
            window.dispatchEvent(
              new CustomEvent("const:diagram-saved", {
                detail: { id: app.id, scene: snapshot },
              }),
            );
            if (snapshot === sceneRef.current) {
              dirty.current = false;
              setStatus("saved");
            }
          } catch {
            setStatus("error");
          }
        };
        setLoaded({ Editor: library.Excalidraw, id: app.id, scene: app.scene });
        setStatus("saved");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer.current);
      if (sceneRef.current && currentId.current && dirty.current)
        void save.current();
    };
  }, [filePath, revision]);
  const changed = useCallback(
    (elements: readonly any[], appState: any, files: any) => {
      sceneRef.current = {
        elements: [...elements],
        appState: { viewBackgroundColor: appState.viewBackgroundColor },
        files,
      };
      const signature = JSON.stringify([
        elements,
        files,
        appState.viewBackgroundColor,
      ]);
      if (signature === savedSignature.current) return;
      savedSignature.current = signature;
      dirty.current = true;
      setStatus("saving");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void save.current(), 700);
    },
    [],
  );
  const exportFile = async (format: "svg" | "png" | "excalidraw") => {
    const scene = sceneRef.current;
    if (!scene) return;
    try {
      const library = await loadExcalidraw();
      const base = filePath
        .split(/[\\/]/)
        .at(-1)!
        .replace(/\.excalidraw$/, "");
      if (format === "svg") {
        const svg = await library.exportToSvg(scene);
        downloadBlob(
          new Blob([svg.outerHTML], { type: "image/svg+xml" }),
          base + ".svg",
        );
      } else if (format === "png")
        downloadBlob(
          await library.exportToBlob({ ...scene, mimeType: "image/png" }),
          base + ".png",
        );
      else
        downloadBlob(
          new Blob(
            [
              library.serializeAsJSON(
                scene.elements,
                scene.appState,
                scene.files,
                "local",
              ),
            ],
            { type: "application/json" },
          ),
          base + ".excalidraw",
        );
    } catch {
      setStatus("error");
    }
  };
  const Editor = loaded?.Editor;
  return (
    <div className="h-full flex flex-col bg-[#161616]">
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#222222] flex-wrap">
        <span role="status" className="text-xs text-[#969696]">
          {t(
            status === "saved"
              ? "mcp.appSaved"
              : status === "saving"
                ? "mcp.appSaving"
                : status === "error"
                  ? "mcp.appSaveError"
                  : "mcp.appPreparing",
          )}
        </span>
        <div className="flex gap-1">
          {status === "error" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                loaded ? void save.current() : setRevision((n) => n + 1)
              }
            >
              {t("mcp.appRetry")}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={!loaded}
            onClick={() => void exportFile("excalidraw")}
          >
            {t("mcp.appExportFile")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!loaded}
            onClick={() => void exportFile("svg")}
          >
            {t("mcp.appExportSvg")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!loaded}
            onClick={() => void exportFile("png")}
          >
            {t("mcp.appExportPng")}
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0 relative">
        {Editor ? (
          <Editor
            key={filePath}
            initialData={{ ...loaded.scene, scrollToContent: true }}
            onChange={changed}
            theme="dark"
            validateEmbeddable={() => false}
            onLinkOpen={(element: any, event: any) => {
              event.preventDefault();
              try {
                const url = new URL(element.link);
                if (["http:", "https:"].includes(url.protocol))
                  void window.electron?.openExternal(url.toString());
              } catch {}
            }}
            langCode={
              (
                {
                  en: "en",
                  id: "id-ID",
                  ja: "ja-JP",
                  zh: "zh-CN",
                  es: "es-ES",
                } as Record<string, string>
              )[language] ?? "en"
            }
            UIOptions={{
              canvasActions: {
                loadScene: false,
                saveToActiveFile: false,
                export: false,
              },
            }}
          />
        ) : (
          <div className="h-full grid place-items-center text-[#969696]">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
