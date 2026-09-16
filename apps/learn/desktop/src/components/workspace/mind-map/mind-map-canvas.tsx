import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Maximize,
  Plus,
  Minus,
  Download,
  Check,
  ChevronRight,
  ChevronLeft,
  Share2,
  FileCode,
  FileDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  cn,
} from "@const/ui";
import { useI18n } from "../../../lib/i18n";
import {
  type MindMapNode,
  type TreeLayoutResult,
  computeTreeLayout,
} from "./types";

interface MindMapCanvasProps {
  root: MindMapNode;
  title?: string;
  onDownload?: () => void;
}

export function MindMapCanvas({ root, title = "Mind Map", onDownload }: MindMapCanvasProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);

  // Set of node IDs that are collapsed
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  // Pan and Zoom transform state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Compute reactive tree layout
  const layout: TreeLayoutResult = useMemo(() => {
    return computeTreeLayout(root, collapsedIds);
  }, [root, collapsedIds]);

  // Center / Fit to view callback
  const handleFitToView = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth === 0 || clientHeight === 0) return;

    const { bounds } = layout;
    const padding = 60;
    const scaleX = (clientWidth - padding) / bounds.width;
    const scaleY = (clientHeight - padding) / bounds.height;
    const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.45), 1.25);

    // Center in container
    const centerX = clientWidth / 2 - (bounds.minX + bounds.width / 2) * newZoom;
    const centerY = clientHeight / 2 - (bounds.minY + bounds.height / 2) * newZoom;

    setZoom(newZoom);
    setPan({ x: centerX, y: centerY });
  }, [layout]);

  // Initial fit to view on mount or root change
  useEffect(() => {
    handleFitToView();
  }, [root.id, handleFitToView]);

  // Toggle collapsed state of a node
  const handleToggleCollapse = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // Zoom helpers
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev * 1.2, 2.5));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev / 1.2, 0.3));
  };

  // Mouse drag pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    // If clicked inside interactive control or button, skip pan
    if ((e.target as HTMLElement).closest("button")) return;

    setIsPanning(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || Math.abs(e.deltaY) > 20) {
      const zoomFactor = e.deltaY > 0 ? 0.92 : 1.08;
      setZoom((prev) => Math.min(Math.max(prev * zoomFactor, 0.3), 2.5));
    } else {
      // Pan via 2-finger scroll
      setPan((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  // Export handlers
  const handleExportMarkdown = () => {
    function nodeToMarkdown(n: MindMapNode, depth: number): string {
      const indent = "  ".repeat(depth);
      let out = `${indent}- **${n.label}**\n`;
      if (n.children) {
        for (const c of n.children) {
          out += nodeToMarkdown(c, depth + 1);
        }
      }
      return out;
    }

    const md = `# ${title}\n\n${nodeToMarkdown(root, 0)}`;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportSvg = () => {
    const svgEl = containerRef.current?.querySelector("svg");
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgEl);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      className={cn(
        "w-full h-full relative overflow-hidden bg-background select-none font-sans",
        isPanning ? "cursor-grabbing" : "cursor-grab"
      )}
    >
      {/* Floating Canvas Controls Toolbar (Left Edge, as shown in video) */}
      <div className="absolute top-6 left-5 z-20 flex flex-col items-center bg-card/90 backdrop-blur-md rounded-2xl border border-border p-1 shadow-md space-y-1">
        <button
          type="button"
          onClick={handleFitToView}
          className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          title={t("fitToView") || "Fit to view"}
          aria-label={t("fitToView") || "Fit to view"}
        >
          <Maximize className="h-4 w-4" />
        </button>

        <div className="w-5 h-[1px] bg-border" />

        <button
          type="button"
          onClick={handleZoomIn}
          className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          title={t("zoomIn") || "Zoom in"}
          aria-label={t("zoomIn") || "Zoom in"}
        >
          <Plus className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={handleZoomOut}
          className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          title={t("zoomOut") || "Zoom out"}
          aria-label={t("zoomOut") || "Zoom out"}
        >
          <Minus className="h-4 w-4" />
        </button>

        <div className="w-5 h-[1px] bg-border" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title={t("downloadMindMap") || "Export Mind Map"}
              aria-label={t("downloadMindMap") || "Export Mind Map"}
            >
              <Download className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right" className="w-48 bg-popover border-border text-popover-foreground">
            <DropdownMenuItem
              onClick={handleExportMarkdown}
              className="cursor-pointer text-xs flex items-center gap-2 hover:bg-muted"
            >
              <FileCode className="h-3.5 w-3.5 text-sky-500" />
              <span>Export as Markdown</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleExportSvg}
              className="cursor-pointer text-xs flex items-center gap-2 hover:bg-muted"
            >
              <FileDown className="h-3.5 w-3.5 text-emerald-500" />
              <span>Export as SVG</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main Canvas SVG Layer with Pan & Zoom Transform */}
      <svg
        className="w-full h-full absolute inset-0 pointer-events-none"
        style={{ overflow: "visible" }}
      >
        <g
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            transition: isPanning ? "none" : "transform 0.15s ease-out",
          }}
        >
          {/* Connector Bezier Curves */}
          {layout.curves.map((curve) => (
            <path
              key={curve.id}
              d={curve.path}
              fill="none"
              strokeWidth="2.2"
              strokeLinecap="round"
              className="stroke-muted-foreground/60 transition-all duration-300"
            />
          ))}

          {/* Interactive Mind Map Nodes */}
          {layout.nodes.map((posNode) => {
            const isRoot = posNode.isRoot;
            const hasChildren = posNode.hasChildren;
            const isCollapsed = posNode.isCollapsed;

            return (
              <g
                key={posNode.id}
                transform={`translate(${posNode.x}, ${posNode.y})`}
                className="pointer-events-auto"
              >
                {/* Node Pill Shape */}
                <rect
                  x="0"
                  y="0"
                  width={posNode.width}
                  height={posNode.height}
                  rx="18"
                  ry="18"
                  strokeWidth={isRoot ? "1.8" : "1.2"}
                  className={cn(
                    "transition-all duration-200 filter drop-shadow-xs",
                    isRoot
                      ? "fill-card stroke-primary/60 hover:stroke-primary hover:fill-secondary/60"
                      : "fill-card stroke-border hover:stroke-border/80 hover:fill-secondary/60"
                  )}
                />

                {/* Node Label Text */}
                <text
                  x={isRoot ? 22 : 18}
                  y={posNode.height / 2 + 4.5}
                  fontSize={isRoot ? "13.5px" : "12.5px"}
                  fontWeight={isRoot ? "600" : "500"}
                  fontFamily="Inter, -apple-system, sans-serif"
                  className="fill-foreground"
                  style={{ pointerEvents: "none" }}
                >
                  {posNode.label.length > 24
                    ? `${posNode.label.slice(0, 22)}...`
                    : posNode.label}
                </text>

                {/* Collapse / Expand Toggle Button on nodes with children */}
                {hasChildren && (
                  <g
                    transform={`translate(${posNode.width - 24}, ${(posNode.height - 20) / 2})`}
                    onClick={(e) => handleToggleCollapse(posNode.id, e)}
                    className="cursor-pointer group"
                  >
                    {/* Toggle button background pill */}
                    <rect
                      x="0"
                      y="0"
                      width="18"
                      height="20"
                      rx="9"
                      ry="9"
                      className="fill-muted group-hover:fill-secondary transition-colors"
                    />

                    {/* Chevron glyph: '<' when expanded, '>' when collapsed */}
                    <text
                      x="9"
                      y="14"
                      textAnchor="middle"
                      fontSize="11px"
                      fontWeight="bold"
                      fontFamily="Inter, -apple-system, sans-serif"
                      className="fill-muted-foreground group-hover:fill-foreground select-none transition-colors"
                    >
                      {isCollapsed ? ">" : "<"}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
