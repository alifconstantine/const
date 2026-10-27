import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import mermaid from "mermaid";
import {
  AlertCircle,
  Check,
  Code2,
  Copy,
  Download,
  Eye,
  Maximize2,
  Minimize2,
  RotateCcw,
  Workflow,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  cn,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  ScrollArea,
  toast,
} from "@const/ui";
import { useTranslation } from "../../lib/i18n";

function getDiagramTypeLabel(code: string): string {
  const firstLine =
    code
      .trim()
      .split("\n")
      .find((l) => l.trim() && !l.trim().startsWith("%%")) || "";
  const match = firstLine.trim().split(/[\s[{:]/)[0]?.toLowerCase();
  switch (match) {
    case "flowchart":
    case "graph":
      return "Flowchart";
    case "sequencediagram":
      return "Sequence Diagram";
    case "classdiagram":
      return "Class Diagram";
    case "statediagram":
    case "statediagram-v2":
      return "State Diagram";
    case "erdiagram":
      return "ER Diagram";
    case "gantt":
      return "Gantt Chart";
    case "pie":
      return "Pie Chart";
    case "gitgraph":
      return "Git Graph";
    case "mindmap":
      return "Mindmap";
    case "timeline":
      return "Timeline";
    case "quadrantchart":
      return "Quadrant Chart";
    case "c4context":
    case "c4container":
    case "c4component":
    case "c4dynamic":
    case "c4deployment":
      return "C4 Architecture";
    case "sankey-beta":
      return "Sankey";
    case "block-beta":
      return "Block Diagram";
    case "packet-beta":
      return "Packet Diagram";
    case "xychart-beta":
      return "XY Chart";
    case "kanban":
      return "Kanban";
    case "architecture-beta":
      return "Architecture";
    default:
      return "Diagram";
  }
}

interface MermaidBlockProps {
  code: string;
  className?: string;
}

export function MermaidBlock({ code, className }: MermaidBlockProps) {
  const { t } = useTranslation();
  const reactId = useId().replace(/[:]/g, "-");
  const baseId = useMemo(
    () => `mm-${reactId}-${Math.random().toString(36).slice(2, 7)}`,
    [reactId],
  );

  const [svgHtml, setSvgHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<"diagram" | "code">("diagram");
  const [zoom, setZoom] = useState<number>(1);
  const [fullscreenZoom, setFullscreenZoom] = useState<number>(1);
  const [copied, setCopied] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<boolean>(false);

  // Detect theme (dark or light)
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document === "undefined") return true;
    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    const handleThemeChange = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };

    window.addEventListener("const-theme-change", handleThemeChange);
    const observer = new MutationObserver(() => {
      handleThemeChange();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-openui-theme"],
    });

    return () => {
      window.removeEventListener("const-theme-change", handleThemeChange);
      observer.disconnect();
    };
  }, []);

  // Render diagram asynchronously
  useEffect(() => {
    let cancelled = false;
    const renderId = `${baseId}-${Date.now()}`;

    const renderDiagram = async () => {
      setIsRendering(true);
      setError(null);

      try {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: isDark ? "dark" : "default",
          fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          themeVariables: isDark
            ? {
                darkMode: true,
                background: "#18181b",
                primaryColor: "#27272a",
                primaryTextColor: "#f4f4f5",
                primaryBorderColor: "#3f3f46",
                lineColor: "#a1a1aa",
                secondaryColor: "#202024",
                tertiaryColor: "#141416",
              }
            : {
                darkMode: false,
                background: "#ffffff",
                primaryColor: "#f4f4f5",
                primaryTextColor: "#18181b",
                primaryBorderColor: "#e4e4e7",
                lineColor: "#71717a",
                secondaryColor: "#f8f9fa",
                tertiaryColor: "#ffffff",
              },
        });

        const { svg } = await mermaid.render(renderId, code.trim());
        if (!cancelled) {
          setSvgHtml(svg);
          setError(null);
          setIsRendering(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to render diagram syntax");
          setIsRendering(false);
        }
      } finally {
        // Clean up temporary DOM artifacts that Mermaid occasionally leaves behind
        const el = document.getElementById(renderId);
        if (el) el.remove();
        const dEl = document.getElementById(`d${renderId}`);
        if (dEl) dEl.remove();
      }
    };

    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [code, isDark, baseId]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(t("common.copied") || "Copied to clipboard");
    } catch {
      toast.error("Failed to copy code");
    }
  };

  const handleDownloadSvg = () => {
    if (!svgHtml) return;
    try {
      const blob = new Blob([svgHtml], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const type = getDiagramTypeLabel(code).toLowerCase().replace(/\s+/g, "-");
      link.href = url;
      link.download = `${type}-${Date.now()}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Diagram SVG downloaded");
    } catch {
      toast.error("Failed to download SVG");
    }
  };

  const diagramType = useMemo(() => getDiagramTypeLabel(code), [code]);

  return (
    <>
      <div
        className={cn(
          "rounded-xl overflow-hidden border border-[#e2e2e4] dark:border-[#2e2e2e] bg-[#f9f9fb] dark:bg-[#141416] my-3 select-none transition-all shadow-sm",
          className,
        )}
      >
        {/* Toolbar Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#f0f0f3] dark:bg-[#1c1c1f] border-b border-[#e2e2e4] dark:border-[#2e2e2e] text-xs">
          <div className="flex items-center gap-2">
            <Workflow className="w-4 h-4 text-[#ff7a00] shrink-0" />
            <span className="font-medium text-[#262626] dark:text-white">
              {diagramType}
            </span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[#666] dark:text-[#aaa]">
              Mermaid
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* View Toggle: Diagram / Code */}
            <div className="flex items-center bg-black/5 dark:bg-white/5 rounded-lg p-0.5 mr-1 border border-black/5 dark:border-white/5">
              <button
                type="button"
                onClick={() => setViewMode("diagram")}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer",
                  viewMode === "diagram"
                    ? "bg-white dark:bg-[#28282b] text-[#161616] dark:text-white shadow-xs"
                    : "text-[#666] dark:text-[#999] hover:text-black dark:hover:text-white",
                )}
                title="View visual diagram"
              >
                <Eye className="w-3 h-3" />
                <span>Diagram</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("code")}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer",
                  viewMode === "code"
                    ? "bg-white dark:bg-[#28282b] text-[#161616] dark:text-white shadow-xs"
                    : "text-[#666] dark:text-[#999] hover:text-black dark:hover:text-white",
                )}
                title="View Mermaid source code"
              >
                <Code2 className="w-3 h-3" />
                <span>Code</span>
              </button>
            </div>

            {/* Zoom Controls (only in diagram view) */}
            {viewMode === "diagram" && !error && svgHtml && (
              <div className="flex items-center gap-0.5 mr-1 text-[#666] dark:text-[#999]">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))))}
                  className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="px-1.5 py-0.5 text-[10px] font-mono rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  title="Reset Zoom (100%)"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.15).toFixed(2))))}
                  className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Download SVG */}
            {svgHtml && !error && (
              <button
                type="button"
                onClick={handleDownloadSvg}
                className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-[#666] dark:text-[#aaa] hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                title="Download SVG"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Copy Code */}
            <button
              type="button"
              onClick={handleCopyCode}
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-[#666] dark:text-[#aaa] hover:text-black dark:hover:text-white transition-colors cursor-pointer"
              title={copied ? "Copied!" : "Copy Mermaid code"}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Fullscreen Modal View */}
            {svgHtml && !error && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-[#666] dark:text-[#aaa] hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                title="Expand to Fullscreen View"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        {viewMode === "code" ? (
          <ScrollArea orientation="horizontal" thumbClassName="bg-white/20 hover:bg-white/30">
            <pre className="p-3.5 text-[12.5px] leading-relaxed font-mono text-[#262626] dark:text-white select-text bg-[#f4f4f6] dark:bg-[#18181a]">
              <code>{code}</code>
            </pre>
          </ScrollArea>
        ) : error ? (
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1 min-w-0">
                <p className="font-medium">Diagram syntax error</p>
                <p className="font-mono text-[11px] opacity-80 break-words line-clamp-3">
                  {error}
                </p>
              </div>
            </div>
            <pre className="p-3 text-[12px] font-mono text-[#444] dark:text-[#bbb] bg-black/5 dark:bg-black/20 rounded-lg overflow-x-auto select-text">
              <code>{code}</code>
            </pre>
          </div>
        ) : isRendering && !svgHtml ? (
          <div className="p-8 flex flex-col items-center justify-center gap-2 text-xs text-[#888]">
            <Workflow className="w-6 h-6 animate-pulse text-[#ff7a00]" />
            <span>Rendering diagram...</span>
          </div>
        ) : (
          <ScrollArea
            orientation="horizontal"
            className="w-full max-h-[580px] p-4 bg-white dark:bg-[#111113] overflow-auto select-text cursor-default"
          >
            <div
              className="flex items-center justify-center min-w-full transition-transform duration-100 ease-out origin-top-left"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "center top",
              }}
              dangerouslySetInnerHTML={{ __html: svgHtml || "" }}
            />
          </ScrollArea>
        )}
      </div>

      {/* Fullscreen Interactive Modal */}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent
          hideClose
          aria-describedby={undefined}
          className="flex h-[90vh] max-w-[min(1400px,96vw)] flex-col gap-0 overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#121214] p-0 shadow-2xl dark:text-white ring-0"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-black/10 dark:border-white/10 bg-[#f8f8fa] dark:bg-[#1a1a1d]">
            <div className="flex items-center gap-2">
              <Workflow className="w-4 h-4 text-[#ff7a00]" />
              <DialogTitle className="text-sm font-semibold">
                {diagramType} — Fullscreen View
              </DialogTitle>
            </div>

            <div className="flex items-center gap-2">
              {/* Zoom Controls inside modal */}
              <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded-lg px-2 py-0.5 border border-black/5 dark:border-white/5 text-xs">
                <button
                  type="button"
                  onClick={() => setFullscreenZoom((z) => Math.max(0.3, Number((z - 0.2).toFixed(2))))}
                  className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setFullscreenZoom(1)}
                  className="px-1.5 py-0.5 text-xs font-mono rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                  title="Reset Zoom"
                >
                  {Math.round(fullscreenZoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setFullscreenZoom((z) => Math.min(3.5, Number((z + 0.2).toFixed(2))))}
                  className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleDownloadSvg}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>SVG</span>
              </button>

              <button
                type="button"
                onClick={handleCopyCode}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>Code</span>
              </button>

              <DialogClose className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer transition-colors ml-2">
                <Minimize2 className="w-4 h-4" />
              </DialogClose>
            </div>
          </div>

          {/* Modal SVG Body */}
          <div className="flex-1 w-full overflow-auto p-6 bg-white dark:bg-[#111113] flex items-center justify-center">
            <div
              className="transition-transform duration-100 ease-out flex items-center justify-center"
              style={{
                transform: `scale(${fullscreenZoom})`,
                transformOrigin: "center center",
              }}
              dangerouslySetInnerHTML={{ __html: svgHtml || "" }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
