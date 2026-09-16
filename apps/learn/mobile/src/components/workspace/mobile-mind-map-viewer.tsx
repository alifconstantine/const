import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  ArrowLeft,
  Share2,
  Maximize,
  Plus,
  Minus,
  Download,
  ThumbsUp,
  ThumbsDown,
  LayoutGrid,
  ListTree,
  ChevronRight,
  ChevronDown,
  FileText,
  FileCode,
} from "lucide-react";
import { cn, toast } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import { db } from "../../lib/db";
import type { MindMapData, MindMapNode, TreeLayoutResult } from "./mind-map/types";
import { computeTreeLayout } from "./mind-map/types";

interface MobileMindMapViewerProps {
  data: MindMapData;
  onClose: () => void;
}

export function MobileMindMapViewer({ data, onClose }: MobileMindMapViewerProps) {
  const { t } = useI18n();

  // Dual-view mode: 'canvas' or 'outline'
  const [viewMode, setViewMode] = useState<"canvas" | "outline">("canvas");

  // Feedback state
  const [feedback, setFeedback] = useState<"good" | "bad" | null>(data.feedback || null);

  // Collapsed node IDs state (Smart default for mobile: collapse Level 2+ nodes initially)
  const initialCollapsed = useMemo(() => {
    const collapsed = new Set<string>();
    if (data.root?.children) {
      for (const level1 of data.root.children) {
        if (level1.children && level1.children.length > 0) {
          // Collapse level 1 children by default on mobile so user sees clean overview
          collapsed.add(level1.id);
        }
      }
    }
    return collapsed;
  }, [data.root]);

  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(initialCollapsed);

  // ---------------------------------------------------------------------------
  // Canvas Gesture & Pan/Zoom Logic
  // ---------------------------------------------------------------------------
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(0.75);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 10, y: 40 });
  const [isPanning, setIsPanning] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pinchStartDistRef = useRef<number | null>(null);
  const zoomStartRef = useRef<number>(1);

  const layout: TreeLayoutResult = useMemo(() => {
    return computeTreeLayout(data.root, collapsedIds);
  }, [data.root, collapsedIds]);

  const handleFitToView = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth === 0 || clientHeight === 0) return;

    const { bounds } = layout;
    const padding = 30;
    const scaleX = (clientWidth - padding) / bounds.width;
    const scaleY = (clientHeight - padding) / bounds.height;
    const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.35), 1.1);

    const centerX = clientWidth / 2 - (bounds.minX + bounds.width / 2) * newZoom;
    const centerY = clientHeight / 2 - (bounds.minY + bounds.height / 2) * newZoom;

    setZoom(newZoom);
    setPan({ x: centerX, y: centerY });
  }, [layout]);

  useEffect(() => {
    handleFitToView();
  }, [handleFitToView]);

  const handleToggleCollapse = (nodeId: string, e: React.MouseEvent | React.TouchEvent) => {
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

  // Touch handlers for mobile pan & pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && e.touches[0]) {
      setIsPanning(true);
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      panStartRef.current = { ...pan };
      pinchStartDistRef.current = null;
    } else if (e.touches.length === 2 && e.touches[0] && e.touches[1]) {
      setIsPanning(false);
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDistRef.current = Math.hypot(dx, dy);
      zoomStartRef.current = zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isPanning && e.touches[0]) {
      const dx = e.touches[0].clientX - touchStartRef.current.x;
      const dy = e.touches[0].clientY - touchStartRef.current.y;
      setPan({
        x: panStartRef.current.x + dx,
        y: panStartRef.current.y + dy,
      });
    } else if (e.touches.length === 2 && pinchStartDistRef.current !== null && e.touches[0] && e.touches[1]) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const scale = dist / pinchStartDistRef.current;
      setZoom(Math.min(Math.max(zoomStartRef.current * scale, 0.25), 2.2));
    }
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
    pinchStartDistRef.current = null;
  };

  const handleFeedback = async (val: "good" | "bad") => {
    const next = feedback === val ? null : val;
    setFeedback(next);
    try {
      const art = await db.artifacts.get(data.id);
      if (art && art.content) {
        const parsed = JSON.parse(art.content);
        parsed.feedback = next;
        await db.artifacts.update(data.id, {
          content: JSON.stringify(parsed),
        });
      }
    } catch (err) {
      console.error("Failed to save mobile feedback:", err);
    }
  };

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

    const md = `# ${data.title}\n\n${nodeToMarkdown(data.root, 0)}`;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.title.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ---------------------------------------------------------------------------
  // Outline Accordion Item Component for Mode B
  // ---------------------------------------------------------------------------
  const renderOutlineNode = (node: MindMapNode, depth: number) => {
    const hasChildren = Boolean(node.children && node.children.length > 0);
    const isCollapsed = collapsedIds.has(node.id);

    return (
      <div key={node.id} className="space-y-1.5" style={{ marginLeft: depth > 0 ? "14px" : "0" }}>
        <div
          onClick={(e) => {
            if (hasChildren) handleToggleCollapse(node.id, e);
          }}
          className={cn(
            "p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-colors",
            depth === 0
              ? "bg-[#25272f] border-[#424858] text-white font-semibold text-xs"
              : depth === 1
              ? "bg-[#1f2026] border-[#343640] text-[#eaecef] font-medium text-xs"
              : "bg-[#19191d] border-[#292a30] text-[#c0c4ce] text-[11.5px]",
            hasChildren && "cursor-pointer active:bg-white/5"
          )}
        >
          <div className="flex items-center gap-2 truncate">
            {depth === 0 ? (
              <span className="w-2 h-2 rounded-full bg-[#0066ff] shrink-0" />
            ) : depth === 1 ? (
              <span className="w-1.5 h-1.5 rounded-full bg-[#f472b6] shrink-0" />
            ) : (
              <span className="w-1 h-1 rounded-full bg-[#888890] shrink-0" />
            )}
            <span className="truncate">{node.label}</span>
          </div>

          {hasChildren && (
            <div className="flex items-center gap-1.5 shrink-0 text-[#888892]">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 font-mono">
                {node.children?.length}
              </span>
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5 transition-transform duration-200",
                  isCollapsed ? "-rotate-90" : "rotate-0"
                )}
              />
            </div>
          )}
        </div>

        {/* Children branches */}
        {hasChildren && !isCollapsed && (
          <div className="border-l border-[#2e303a] pl-2 space-y-1.5 mt-1">
            {node.children?.map((c) => renderOutlineNode(c, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const sourceCount = data.sourceCount || (data.sourceIds ? data.sourceIds.length : 1);

  return (
    <div className="fixed inset-0 z-50 bg-[#141416] text-[#d4d4d4] flex flex-col font-sans select-none overflow-hidden animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="h-14 px-3.5 border-b border-[#26262a] bg-[#1a1a1e] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-white/10 text-[#969696] hover:text-white flex items-center justify-center transition-colors -ml-1 shrink-0 active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-semibold text-white tracking-tight truncate">
              {data.title}
            </h2>
            <div className="text-[10px] text-[#888890] flex items-center gap-1.5">
              <span>{t("toolsMindMap") || "Peta Pikiran"}</span>
              <span>•</span>
              <span>{sourceCount} sumber</span>
            </div>
          </div>
        </div>

        {/* Header Right: Dual-Mode Switcher [Kanvas | Outline] */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-[#25252a] p-0.5 rounded-xl border border-[#34343a]">
            <button
              type="button"
              onClick={() => setViewMode("canvas")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors",
                viewMode === "canvas" ? "bg-[#343640] text-white shadow-xs" : "text-[#888892] hover:text-white"
              )}
            >
              <LayoutGrid className="w-3 h-3" />
              <span>{t("viewCanvas") || "Kanvas"}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("outline")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors",
                viewMode === "outline" ? "bg-[#343640] text-white shadow-xs" : "text-[#888892] hover:text-white"
              )}
            >
              <ListTree className="w-3 h-3" />
              <span>{t("viewOutline") || "Outline"}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportMarkdown}
            className="h-8 w-8 rounded-lg hover:bg-white/10 text-[#a0a0a8] hover:text-white flex items-center justify-center transition-colors"
            title="Ekspor Markdown"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 w-full min-h-0 relative overflow-hidden bg-[#161618]">
        {viewMode === "canvas" ? (
          /* Mode A: Interactive Touch Canvas */
          <div
            ref={containerRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="w-full h-full relative overflow-hidden bg-[#151517]"
          >
            {/* Floating Mobile Controls Toolbar (Bottom-Right) */}
            <div className="absolute bottom-5 right-4 z-20 flex items-center bg-[#202024]/90 backdrop-blur-md rounded-2xl border border-[#36363c] p-1 shadow-lg space-x-1">
              <button
                type="button"
                onClick={handleFitToView}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-[#a0a0a8] hover:text-white hover:bg-white/10"
                title="Pusatkan"
              >
                <Maximize className="w-3.5 h-3.5" />
              </button>

              <div className="w-[1px] h-4 bg-[#36363c]" />

              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(z * 1.25, 2.2))}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-[#a0a0a8] hover:text-white hover:bg-white/10"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(z / 1.25, 0.25))}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-[#a0a0a8] hover:text-white hover:bg-white/10"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* SVG Canvas */}
            <svg
              className="w-full h-full absolute inset-0 pointer-events-none"
              style={{ overflow: "visible" }}
            >
              <g
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "0 0",
                  transition: isPanning ? "none" : "transform 0.12s ease-out",
                }}
              >
                {layout.curves.map((curve) => (
                  <path
                    key={curve.id}
                    d={curve.path}
                    fill="none"
                    stroke="#505666"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                ))}

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
                      <rect
                        x="0"
                        y="0"
                        width={posNode.width}
                        height={posNode.height}
                        rx="16"
                        ry="16"
                        fill={isRoot ? "#24262d" : "#222328"}
                        stroke={isRoot ? "#4c556b" : "#363840"}
                        strokeWidth={isRoot ? "1.6" : "1"}
                        className="active:fill-[#2d2f38]"
                      />

                      <text
                        x={isRoot ? 20 : 16}
                        y={posNode.height / 2 + 4}
                        fill="#ffffff"
                        fontSize={isRoot ? "13px" : "11.5px"}
                        fontWeight={isRoot ? "600" : "500"}
                        fontFamily="Inter, -apple-system, sans-serif"
                        style={{ pointerEvents: "none" }}
                      >
                        {posNode.label.length > 22
                          ? `${posNode.label.slice(0, 20)}...`
                          : posNode.label}
                      </text>

                      {hasChildren && (
                        <g
                          transform={`translate(${posNode.width - 22}, ${(posNode.height - 18) / 2})`}
                          onClick={(e) => handleToggleCollapse(posNode.id, e)}
                          className="cursor-pointer"
                        >
                          <rect
                            x="0"
                            y="0"
                            width="16"
                            height="18"
                            rx="8"
                            ry="8"
                            fill="#30323a"
                          />
                          <text
                            x="8"
                            y="13"
                            textAnchor="middle"
                            fill="#d0d4dc"
                            fontSize="10px"
                            fontWeight="bold"
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
        ) : (
          /* Mode B: Hierarchical Outline Accordion List */
          <div className="w-full h-full overflow-y-auto p-4 space-y-2">
            <div className="text-[11px] text-[#888892] px-1 mb-2">
              Daftar struktur hierarki materi (ketuk untuk ciutkan/mekarkan cabang):
            </div>
            {renderOutlineNode(data.root, 0)}
          </div>
        )}
      </div>

      {/* Footer with Thumbs Up/Down */}
      <div className="px-4 py-2 border-t border-[#242428] bg-[#18181b] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleFeedback("good")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors",
              feedback === "good" ? "bg-[#0066ff]/20 text-white" : "text-[#888892]"
            )}
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            <span>{t("goodContent") || "Konten bagus"}</span>
          </button>

          <button
            type="button"
            onClick={() => handleFeedback("bad")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors",
              feedback === "bad" ? "bg-rose-500/20 text-rose-300" : "text-[#888892]"
            )}
          >
            <ThumbsDown className="w-3.5 h-3.5" />
            <span>{t("badContent") || "Konten buruk"}</span>
          </button>
        </div>

        <div className="text-[10px] text-[#606068]">
          Const Learn Mobile
        </div>
      </div>
    </div>
  );
}
