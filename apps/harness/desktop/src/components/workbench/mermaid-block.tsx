import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import mermaid from "mermaid";
import {
  AlertCircle,
  Check,
  Code2,
  Copy,
  Download,
  Eye,
  Hand,
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

interface DiagramCanvasProps {
  svgHtml: string;
  zoom: number;
  onZoomChange: (updater: (prev: number) => number) => void;
  pan: { x: number; y: number };
  onPanChange: (pan: { x: number; y: number }) => void;
  onReset: () => void;
  isFullscreen?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

function DiagramCanvas({
  svgHtml,
  zoom,
  onZoomChange,
  pan,
  onPanChange,
  onReset,
  isFullscreen = false,
  className,
  style,
}: DiagramCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only drag with left mouse button / single touch
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    onPanChange({
      x: Math.round(dragStartRef.current.panX + dx),
      y: Math.round(dragStartRef.current.panY + dy),
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
    }
  };

  // Wheel listener: trackpad pinch / Ctrl+wheel zooms, trackpad swipe pans
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Zoom on pinch (e.ctrlKey in browsers) or Ctrl/Meta + wheel or in fullscreen
      if (e.ctrlKey || e.metaKey || isFullscreen) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.06 : 0.94;
        onZoomChange((prev) => {
          const max = isFullscreen ? 4 : 3;
          const min = 0.25;
          const next = Math.min(Math.max(min, Number((prev * factor).toFixed(2))), max);
          return next;
        });
      } else {
        // Trackpad 2-finger pan or horizontal scroll
        if (Math.abs(e.deltaX) > 0 || Math.abs(e.deltaY) > 0) {
          if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            e.preventDefault();
            onPanChange({
              x: pan.x - e.deltaX,
              y: pan.y - (e.shiftKey ? 0 : e.deltaY),
            });
          }
        }
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [isFullscreen, onZoomChange, onPanChange, pan]);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={onReset}
      style={style}
      className={cn(
        "relative w-full overflow-hidden select-none flex items-center justify-center touch-none",
        isDragging ? "cursor-grabbing" : "cursor-grab",
        className,
      )}
      title="Drag to pan • Pinch / Ctrl+Scroll to zoom • Double-click to reset"
    >
      <div
        className={cn(
          "w-full h-full flex items-center justify-center p-6 will-change-transform",
          // Eliminates drag latency: disable transition while actively dragging for 1:1 instantaneous response
          isDragging ? "transition-none" : "transition-transform duration-150 ease-out",
          // Ensure SVG fits completely inside bounds without clipping or overflow on initial render
          "[&_svg]:!max-w-full [&_svg]:!max-h-full [&_svg]:!w-auto [&_svg]:!h-auto [&_svg]:block [&_svg]:pointer-events-none [&_svg]:select-none",
        )}
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
          transformOrigin: "center center",
        }}
        dangerouslySetInnerHTML={{ __html: svgHtml }}
      />
    </div>
  );
}

interface MermaidBlockProps {
  code: string;
  className?: string;
  isStreaming?: boolean;
}

export function MermaidBlock({
  code,
  className,
  isStreaming = false,
}: MermaidBlockProps) {
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

  // Inline view state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Fullscreen view state
  const [fullscreenZoom, setFullscreenZoom] = useState<number>(1);
  const [fullscreenPan, setFullscreenPan] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

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

    // When streaming, debounce slightly so we don't spam mermaid.render on every single token.
    // When stream completes (!isStreaming), render immediately (0ms).
    const debounceMs = isStreaming ? 250 : 0;
    const timer = setTimeout(async () => {
      const trimmed = code.trim();
      if (!trimmed) {
        if (!cancelled) {
          setIsRendering(false);
          setSvgHtml(null);
        }
        return;
      }

      setIsRendering(true);

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

        const { svg } = await mermaid.render(renderId, trimmed);
        if (!cancelled) {
          setSvgHtml(svg);
          setError(null);
          setIsRendering(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          // If streaming, suppress error until generation is finalized
          setError(err?.message || "Failed to render diagram syntax");
          setIsRendering(false);
        }
      } finally {
        // Clean up temporary DOM artifacts left by Mermaid
        const el = document.getElementById(renderId);
        if (el) el.remove();
        const dEl = document.getElementById(`d${renderId}`);
        if (dEl) dEl.remove();
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, isDark, baseId, isStreaming]);

  // Parse viewBox from svgHtml to compute adaptive container height
  const viewBox = useMemo(() => {
    if (!svgHtml) return null;
    const match = svgHtml.match(
      /viewBox=["']\s*([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s*["']/i,
    );
    if (match && match[3] && match[4]) {
      const w = parseFloat(match[3]);
      const h = parseFloat(match[4]);
      if (!Number.isNaN(w) && !Number.isNaN(h) && w > 0 && h > 0) {
        return { w, h };
      }
    }
    return null;
  }, [svgHtml]);

  const dynamicHeight = useMemo(() => {
    if (!viewBox) return 380;
    // Assume average chat column content width is ~680px
    const estimated = Math.round((680 / viewBox.w) * viewBox.h) + 48;
    // Clamp between 260px (compact) and 560px (comfortable inline ceiling)
    return Math.min(Math.max(estimated, 260), 560);
  }, [viewBox]);

  const handleResetInline = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleResetFullscreen = useCallback(() => {
    setFullscreenZoom(1);
    setFullscreenPan({ x: 0, y: 0 });
  }, []);

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

  // If streaming and diagram isn't valid yet, show the streaming loading card instead of syntax error!
  const isStreamingPlaceholder = isStreaming && !svgHtml;
  // Only show the syntax error when streaming is done AND there's an error AND no SVG
  const shouldShowError = !isStreaming && Boolean(error) && !svgHtml;

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
            {isStreaming && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#ff7a00]/10 text-[#ff7a00] text-[10px] font-medium animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff7a00]" />
                Streaming
              </span>
            )}
            {viewMode === "diagram" && !error && svgHtml && (
              <span className="hidden md:inline-flex items-center gap-1 text-[10px] text-[#888] dark:text-[#777] ml-1">
                <Hand className="w-3 h-3" />
                <span>Drag to pan • Pinch / Ctrl+Scroll to zoom</span>
              </span>
            )}
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

            {/* Zoom Controls (only in diagram view with active SVG) */}
            {viewMode === "diagram" && !error && svgHtml && (
              <div className="flex items-center gap-0.5 mr-1 text-[#666] dark:text-[#999]">
                <button
                  type="button"
                  onClick={() =>
                    setZoom((z) => Math.max(0.25, Number((z - 0.15).toFixed(2))))
                  }
                  className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleResetInline}
                  className="px-1.5 py-0.5 text-[10px] font-mono rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1"
                  title="Reset Zoom & Pan (100%)"
                >
                  <span>{Math.round(zoom * 100)}%</span>
                  <RotateCcw className="w-2.5 h-2.5 opacity-60" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setZoom((z) => Math.min(3, Number((z + 0.15).toFixed(2))))
                  }
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
                onClick={() => {
                  setFullscreenZoom(zoom);
                  setFullscreenPan(pan);
                  setExpanded(true);
                }}
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
          <ScrollArea
            orientation="horizontal"
            thumbClassName="bg-white/20 hover:bg-white/30"
          >
            <pre className="p-3.5 text-[12.5px] leading-relaxed font-mono text-[#262626] dark:text-white select-text bg-[#f4f4f6] dark:bg-[#18181a]">
              <code>{code}</code>
            </pre>
          </ScrollArea>
        ) : isStreamingPlaceholder ? (
          <div className="p-8 flex flex-col items-center justify-center gap-3 text-xs bg-white dark:bg-[#111113] min-h-[220px]">
            <div className="relative flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-[#ff7a00]/10 dark:bg-[#ff7a00]/20 flex items-center justify-center">
                <Workflow className="w-5 h-5 text-[#ff7a00] animate-pulse" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff7a00] opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ff7a00]" />
              </span>
            </div>
            <div className="text-center space-y-1">
              <p className="text-xs font-medium text-[#262626] dark:text-[#f0f0f0]">
                Menyiapkan visualisasi {diagramType}...
              </p>
              <p className="text-[11px] text-[#888888] dark:text-[#888888]">
                Diagram sedang di-stream oleh AI
              </p>
            </div>
          </div>
        ) : shouldShowError ? (
          <div className="p-4 space-y-3 bg-white dark:bg-[#111113]">
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
          <div className="p-8 flex flex-col items-center justify-center gap-2 text-xs text-[#888] bg-white dark:bg-[#111113] min-h-[220px]">
            <Workflow className="w-6 h-6 animate-pulse text-[#ff7a00]" />
            <span>Rendering {diagramType}...</span>
          </div>
        ) : (
          <DiagramCanvas
            svgHtml={svgHtml || ""}
            zoom={zoom}
            onZoomChange={setZoom}
            pan={pan}
            onPanChange={setPan}
            onReset={handleResetInline}
            style={{ height: `${dynamicHeight}px` }}
            className="bg-white dark:bg-[#111113]"
          />
        )}
      </div>

      {/* Fullscreen Interactive Modal */}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent
          hideClose
          aria-describedby={undefined}
          className="flex h-[92vh] max-w-[min(1500px,96vw)] flex-col gap-0 overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#121214] p-0 shadow-2xl dark:text-white ring-0"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-black/10 dark:border-white/10 bg-[#f8f8fa] dark:bg-[#1a1a1d]">
            <div className="flex items-center gap-2">
              <Workflow className="w-4 h-4 text-[#ff7a00]" />
              <DialogTitle className="text-sm font-semibold">
                {diagramType} — Interactive View
              </DialogTitle>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-[#888] dark:text-[#777] ml-2">
                <Hand className="w-3.5 h-3.5" />
                <span>Drag to pan • Pinch / Scroll to zoom • Double click to center</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Zoom Controls inside modal */}
              <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded-lg px-2 py-0.5 border border-black/5 dark:border-white/5 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    setFullscreenZoom((z) =>
                      Math.max(0.25, Number((z - 0.2).toFixed(2))),
                    )
                  }
                  className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleResetFullscreen}
                  className="px-1.5 py-0.5 text-xs font-mono rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer flex items-center gap-1"
                  title="Reset Zoom & Pan (100%)"
                >
                  <span>{Math.round(fullscreenZoom * 100)}%</span>
                  <RotateCcw className="w-3 h-3 opacity-60" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFullscreenZoom((z) =>
                      Math.min(4, Number((z + 0.2).toFixed(2))),
                    )
                  }
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
                title="Download SVG"
              >
                <Download className="w-3.5 h-3.5" />
                <span>SVG</span>
              </button>

              <button
                type="button"
                onClick={handleCopyCode}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="Copy Mermaid code"
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

          {/* Modal SVG Body with Full Canvas Interaction */}
          <div className="flex-1 w-full h-[calc(92vh-58px)] overflow-hidden bg-white dark:bg-[#111113]">
            <DiagramCanvas
              svgHtml={svgHtml || ""}
              zoom={fullscreenZoom}
              onZoomChange={setFullscreenZoom}
              pan={fullscreenPan}
              onPanChange={setFullscreenPan}
              onReset={handleResetFullscreen}
              isFullscreen={true}
              className="w-full h-full"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
