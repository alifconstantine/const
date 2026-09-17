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
  Check,
  Copy,
  Target,
  X,
  UnfoldHorizontal,
  FoldHorizontal,
} from "lucide-react";
import { cn, toast } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import { db } from "../../lib/db";
import type {
  MindMapData,
  MindMapNode,
  TreeLayoutResult,
  PositionedNode,
} from "./mind-map/types";
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

  // Selected node for Mobile Bottom Sheet Inspector
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Copy state
  const [isCopied, setIsCopied] = useState(false);

  // Collapsed node IDs state (Smart default for mobile: collapse Level 2+ nodes initially)
  const initialCollapsed = useMemo(() => {
    const collapsed = new Set<string>();
    if (data.root?.children) {
      for (const level1 of data.root.children) {
        if (level1.children && level1.children.length > 0) {
          collapsed.add(level1.id);
        }
      }
    }
    return collapsed;
  }, [data.root]);

  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(initialCollapsed);

  // Sync initial collapsed state on data.root change
  useEffect(() => {
    setCollapsedIds(initialCollapsed);
  }, [data.root?.id, initialCollapsed]);

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
  const pinchWorldCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const layout: TreeLayoutResult = useMemo(() => {
    return computeTreeLayout(data.root, collapsedIds);
  }, [data.root, collapsedIds]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return layout.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [layout.nodes, selectedNodeId]);

  const selectedBreadcrumbs = useMemo(() => {
    if (!selectedNode) return [];
    const path: string[] = [];
    let curr: PositionedNode | undefined = selectedNode;
    while (curr) {
      path.unshift(curr.label);
      curr = curr.parent;
    }
    return path;
  }, [selectedNode]);

  const handleFitToView = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth === 0 || clientHeight === 0) return;

    const { bounds } = layout;
    const padding = 36;
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

  // All node IDs with children for Expand All / Collapse All
  const allExpandableIds = useMemo(() => {
    const ids: string[] = [];
    const walk = (n: MindMapNode) => {
      if (n.children && n.children.length > 0) {
        ids.push(n.id);
        n.children.forEach(walk);
      }
    };
    walk(data.root);
    return ids;
  }, [data.root]);

  const isAllExpanded = useMemo(() => {
    if (allExpandableIds.length === 0) return false;
    return allExpandableIds.every((id) => !collapsedIds.has(id));
  }, [allExpandableIds, collapsedIds]);

  // Toggle expand all / collapse all
  const handleToggleExpandAll = useCallback(() => {
    if (isAllExpanded) {
      // Collapse back to Level 1
      const nextCollapsed = new Set<string>();
      if (data.root?.children) {
        for (const level1 of data.root.children) {
          if (level1.children && level1.children.length > 0) {
            nextCollapsed.add(level1.id);
          }
        }
      }
      setCollapsedIds(nextCollapsed);
      toast.success("Semua cabang diciutkan");
      setTimeout(() => {
        handleFitToView();
      }, 50);
    } else {
      // Expand all
      setCollapsedIds(new Set());
      toast.success("Semua cabang dimekarkan");
      setTimeout(() => {
        handleFitToView();
      }, 50);
    }
  }, [isAllExpanded, data.root, handleFitToView]);

  // Zoom anchored to container center for +/- buttons
  const zoomToCenter = useCallback((factor: number) => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const focalX = clientWidth / 2;
    const focalY = clientHeight / 2;

    setZoom((prevZoom) => {
      const nextZoom = Math.min(Math.max(prevZoom * factor, 0.25), 2.2);
      if (Math.abs(nextZoom - prevZoom) < 0.001) return prevZoom;

      setPan((prevPan) => {
        const worldX = (focalX - prevPan.x) / prevZoom;
        const worldY = (focalY - prevPan.y) / prevZoom;
        return {
          x: focalX - worldX * nextZoom,
          y: focalY - worldY * nextZoom,
        };
      });

      return nextZoom;
    });
  }, []);

  // Smart Branch Focus & Camera Auto-Framing on Mobile
  const focusNodeOrBranch = useCallback(
    (nodeId: string, customLayout?: TreeLayoutResult) => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      if (clientWidth === 0 || clientHeight === 0) return;

      const activeLayout = customLayout || layout;
      const target = activeLayout.nodes.find((n) => n.id === nodeId);
      if (!target) return;

      const branchNodes: PositionedNode[] = [target];
      const queue = [...target.children];
      while (queue.length > 0) {
        const item = queue.shift()!;
        branchNodes.push(item);
        if (item.children) queue.push(...item.children);
      }

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const n of branchNodes) {
        if (n.x < minX) minX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.x + n.width > maxX) maxX = n.x + n.width;
        if (n.y + n.height > maxY) maxY = n.y + n.height;
      }

      const branchW = Math.max(maxX - minX, 160);
      const branchH = Math.max(maxY - minY, 90);

      const padX = 70;
      const padY = 90;
      const scaleX = (clientWidth - padX) / branchW;
      const scaleY = (clientHeight - padY) / branchH;

      let targetZoom: number;
      if (branchNodes.length > 1) {
        const fitScale = Math.min(scaleX, scaleY);
        targetZoom = Math.min(zoom, Math.max(Math.min(fitScale, 1.05), 0.4));
      } else {
        targetZoom = Math.min(Math.max(zoom, 0.75), 1.05);
      }

      const branchCenterX = minX + branchW / 2;
      const branchCenterY = minY + branchH / 2;

      const targetPanX = clientWidth / 2 - branchCenterX * targetZoom;
      const targetPanY = clientHeight / 2 - branchCenterY * targetZoom;

      setZoom(targetZoom);
      setPan({ x: targetPanX, y: targetPanY });
    },
    [layout, zoom]
  );

  const handleToggleCollapse = useCallback(
    (nodeId: string, e?: React.MouseEvent | React.TouchEvent) => {
      if (e) e.stopPropagation();
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        const isCurrentlyCollapsed = next.has(nodeId);
        if (isCurrentlyCollapsed) {
          next.delete(nodeId);

          // Ensure direct children with sub-children remain collapsed so they open one level at a time ("satu persatu")
          const findNode = (n: MindMapNode): MindMapNode | null => {
            if (n.id === nodeId) return n;
            if (n.children) {
              for (const c of n.children) {
                const found = findNode(c);
                if (found) return found;
              }
            }
            return null;
          };
          const targetNode = findNode(data.root);
          if (targetNode && targetNode.children) {
            for (const child of targetNode.children) {
              if (child.children && child.children.length > 0) {
                next.add(child.id);
              }
            }
          }
        } else {
          next.add(nodeId);
        }

        const prospectiveLayout = computeTreeLayout(data.root, next);
        setTimeout(() => {
          focusNodeOrBranch(nodeId, prospectiveLayout);
        }, 20);

        return next;
      });
    },
    [data.root, focusNodeOrBranch]
  );

  // Touch handlers for mobile pan & focal pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && e.touches[0]) {
      setIsPanning(true);
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      panStartRef.current = { ...pan };
      pinchStartDistRef.current = null;
    } else if (e.touches.length === 2 && e.touches[0] && e.touches[1] && containerRef.current) {
      setIsPanning(false);
      const rect = containerRef.current.getBoundingClientRect();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDistRef.current = Math.hypot(dx, dy);
      zoomStartRef.current = zoom;
      panStartRef.current = { ...pan };

      // Calculate midpoint relative to container
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

      // Lock world coordinates of pinch midpoint
      pinchWorldCenterRef.current = {
        x: (midX - pan.x) / zoom,
        y: (midY - pan.y) / zoom,
      };
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
    } else if (
      e.touches.length === 2 &&
      pinchStartDistRef.current !== null &&
      e.touches[0] &&
      e.touches[1] &&
      containerRef.current
    ) {
      const rect = containerRef.current.getBoundingClientRect();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const scale = dist / pinchStartDistRef.current;
      const nextZoom = Math.min(Math.max(zoomStartRef.current * scale, 0.25), 2.2);

      // Current midpoint
      const currMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const currMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

      // Adjust pan so world point stays locked right under midpoint
      const nextPanX = currMidX - pinchWorldCenterRef.current.x * nextZoom;
      const nextPanY = currMidY - pinchWorldCenterRef.current.y * nextZoom;

      setZoom(nextZoom);
      setPan({ x: nextPanX, y: nextPanY });
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
      let out = `${indent}- **${n.label}**`;
      if (n.description) {
        out += `: ${n.description}`;
      }
      out += "\n";
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
    toast.success("Mind Map diekspor sebagai Markdown");
  };

  const handleCopyNodeText = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setIsCopied(true);
      toast.success("Teks konsep disalin!");
      setTimeout(() => setIsCopied(false), 2000);
    }
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
            "p-2.5 rounded-xl border flex items-start justify-between gap-2 transition-colors",
            depth === 0
              ? "bg-card border-border text-foreground font-semibold text-xs"
              : depth === 1
              ? "bg-secondary/70 border-border text-foreground font-medium text-xs"
              : "bg-secondary/40 border-border text-foreground text-[11.5px]",
            hasChildren && "cursor-pointer active:bg-secondary"
          )}
        >
          <div className="flex items-start gap-2 min-w-0">
            {depth === 0 ? (
              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1" />
            ) : depth === 1 ? (
              <span className="w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0 mt-1" />
            ) : (
              <span className="w-1 h-1 rounded-full bg-muted-foreground shrink-0 mt-1" />
            )}
            <div className="min-w-0">
              <div className="break-words leading-snug">{node.label}</div>
              {node.description && (
                <div className="text-[10.5px] text-muted-foreground mt-1 leading-relaxed">
                  {node.description}
                </div>
              )}
            </div>
          </div>

          {hasChildren && (
            <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground pt-0.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary font-mono">
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
          <div className="border-l border-border pl-2 space-y-1.5 mt-1">
            {node.children?.map((c) => renderOutlineNode(c, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const sourceCount = data.sourceCount || (data.sourceIds ? data.sourceIds.length : 1);

  return (
    <div className="fixed inset-0 z-50 bg-background text-foreground flex flex-col font-sans select-none overflow-hidden animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="h-14 px-3.5 border-b border-border bg-card flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors -ml-1 shrink-0 active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-semibold text-foreground tracking-tight truncate">
              {data.title}
            </h2>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
              <span>{t("toolsMindMap") || "Peta Pikiran"}</span>
              <span>•</span>
              <span>{sourceCount} sumber</span>
            </div>
          </div>
        </div>

        {/* Header Right: Dual-Mode Switcher [Kanvas | Outline] */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-secondary/60 p-0.5 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setViewMode("canvas")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer",
                viewMode === "canvas" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="w-3 h-3" />
              <span>{t("viewCanvas") || "Kanvas"}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("outline")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer",
                viewMode === "outline" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ListTree className="w-3 h-3" />
              <span>{t("viewOutline") || "Outline"}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportMarkdown}
            className="h-8 w-8 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            title="Ekspor Markdown"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 w-full min-h-0 relative overflow-hidden bg-background">
        {viewMode === "canvas" ? (
          /* Mode A: Interactive Touch Canvas */
          <div
            ref={containerRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="w-full h-full relative overflow-hidden bg-background"
          >
            {/* Floating Mobile Controls Toolbar (Bottom-Right) */}
            <div className="absolute bottom-5 right-4 z-20 flex items-center bg-card/90 backdrop-blur-md rounded-2xl border border-border p-1 shadow-lg space-x-1">
              <button
                type="button"
                onClick={handleFitToView}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                title="Pusatkan"
                aria-label="Pusatkan"
              >
                <Maximize className="w-3.5 h-3.5" />
              </button>

              <div className="w-[1px] h-4 bg-border" />

              {/* Expand All / Collapse All Toggle Button (Icon only) */}
              <button
                type="button"
                onClick={handleToggleExpandAll}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                title={isAllExpanded ? "Ciutkan Semua Cabang" : "Buka Semua Cabang"}
                aria-label={isAllExpanded ? "Ciutkan Semua Cabang" : "Buka Semua Cabang"}
              >
                {isAllExpanded ? <FoldHorizontal className="w-3.5 h-3.5" /> : <UnfoldHorizontal className="w-3.5 h-3.5" />}
              </button>

              <div className="w-[1px] h-4 bg-border" />

              <button
                type="button"
                onClick={() => zoomToCenter(1.22)}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                title="Perbesar"
                aria-label="Perbesar"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => zoomToCenter(1 / 1.22)}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                title="Perkecil"
                aria-label="Perkecil"
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
                  transition: isPanning ? "none" : "transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                {layout.curves.map((curve) => (
                  <path
                    key={curve.id}
                    d={curve.path}
                    fill="none"
                    stroke={curve.colorHex}
                    strokeWidth="2"
                    strokeLinecap="round"
                    opacity="0.85"
                    className="transition-all duration-300"
                  />
                ))}

                {layout.nodes.map((posNode) => {
                  const isRoot = posNode.isRoot;
                  const hasChildren = posNode.hasChildren;
                  const isCollapsed = posNode.isCollapsed;
                  const isSelected = selectedNodeId === posNode.id;
                  const theme = posNode.branchTheme;

                  return (
                    <g
                      key={posNode.id}
                      transform={`translate(${posNode.x}, ${posNode.y})`}
                      style={{
                        transform: `translate(${posNode.x}px, ${posNode.y}px)`,
                        transition: isPanning
                          ? "none"
                          : "transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease-out",
                      }}
                      className="pointer-events-auto cursor-pointer animate-in fade-in zoom-in-95 duration-300"
                      onClick={() => setSelectedNodeId(posNode.id)}
                    >
                      {/* Pill Shape */}
                      <rect
                        x="0"
                        y="0"
                        width={posNode.width}
                        height={posNode.height}
                        rx="16"
                        ry="16"
                        fill="hsl(var(--card))"
                        stroke={isSelected ? "#2563eb" : theme.borderHex}
                        strokeWidth={isSelected ? "2.2" : isRoot ? "1.8" : "1.2"}
                        className="transition-colors active:opacity-85"
                      />

                      {/* Subtle branch tint */}
                      <rect
                        x="0"
                        y="0"
                        width={posNode.width}
                        height={posNode.height}
                        rx="16"
                        ry="16"
                        fill={theme.bgHex}
                        style={{ pointerEvents: "none" }}
                      />

                      {/* Branch Pip */}
                      {!isRoot && (
                        <circle
                          cx="13"
                          cy={posNode.height / 2}
                          r="3"
                          fill={theme.curveHex}
                          style={{ pointerEvents: "none" }}
                        />
                      )}

                      {/* Node Label Text (1 or 2 lines) */}
                      {posNode.lines.length === 1 ? (
                        <text
                          x={isRoot ? 20 : 22}
                          y={posNode.height / 2 + 4}
                          fill="currentColor"
                          className="text-foreground"
                          fontSize={isRoot ? "12.5px" : "11.5px"}
                          fontWeight={isRoot ? "600" : "500"}
                          fontFamily="Inter, -apple-system, sans-serif"
                          style={{ pointerEvents: "none" }}
                        >
                          {posNode.lines[0]}
                        </text>
                      ) : (
                        <text
                          x={isRoot ? 20 : 22}
                          y={posNode.height / 2 - 3}
                          fill="currentColor"
                          className="text-foreground"
                          fontSize={isRoot ? "12px" : "11px"}
                          fontWeight={isRoot ? "600" : "500"}
                          fontFamily="Inter, -apple-system, sans-serif"
                          style={{ pointerEvents: "none" }}
                        >
                          <tspan x={isRoot ? 20 : 22} dy="0">
                            {posNode.lines[0]}
                          </tspan>
                          <tspan x={isRoot ? 20 : 22} dy="14">
                            {posNode.lines[1]}
                          </tspan>
                        </text>
                      )}

                      {/* Collapse / Expand Toggle Button with Large Hit Area for Mobile Fingers */}
                      {hasChildren && (
                        <g
                          transform={`translate(${posNode.width - 24}, ${(posNode.height - 20) / 2})`}
                          onClick={(e) => handleToggleCollapse(posNode.id, e)}
                          className="cursor-pointer"
                        >
                          {/* Invisible expanded hit-target */}
                          <rect
                            x="-10"
                            y="-8"
                            width="38"
                            height="36"
                            fill="transparent"
                          />
                          {/* Visual toggle pill */}
                          <rect
                            x="0"
                            y="0"
                            width="18"
                            height="20"
                            rx="9"
                            ry="9"
                            fill={theme.badgeBgHex}
                          />
                          {/* Smoothly animated rotating chevron */}
                          <g
                            style={{
                              transformOrigin: "9px 10px",
                              transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)",
                              transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                            }}
                          >
                            <path
                              d="M 7.5 7 L 11 10 L 7.5 13"
                              fill="none"
                              stroke={theme.badgeTextHex}
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </g>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Mobile Bottom Sheet Node Inspector */}
            {selectedNode && (
              <div className="absolute inset-x-0 bottom-0 z-40 bg-card/95 backdrop-blur-md border-t border-border rounded-t-3xl p-4 shadow-2xl animate-in slide-in-from-bottom duration-200">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mx-auto mb-3" />
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1 truncate">
                      {selectedBreadcrumbs.map((crumb, idx) => (
                        <React.Fragment key={idx}>
                          {idx > 0 && <span className="opacity-50">&gt;</span>}
                          <span className={idx === selectedBreadcrumbs.length - 1 ? "text-foreground font-medium" : ""}>
                            {crumb}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                    <h3 className="text-sm font-semibold text-foreground tracking-tight break-words">
                      {selectedNode.label}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedNodeId(null)}
                    className="p-1.5 hover:bg-secondary rounded-full text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {selectedNode.node.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3 bg-secondary/50 p-2.5 rounded-xl">
                    {selectedNode.node.description}
                  </p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        focusNodeOrBranch(selectedNode.id);
                        setSelectedNodeId(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium active:scale-95 transition-transform"
                    >
                      <Target className="w-3.5 h-3.5" />
                      <span>Pusatkan</span>
                    </button>

                    {selectedNode.hasChildren && (
                      <button
                        type="button"
                        onClick={() => handleToggleCollapse(selectedNode.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium active:scale-95 transition-transform"
                      >
                        <span>{selectedNode.isCollapsed ? "Buka Cabang" : "Ciutkan Cabang"}</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyNodeText(selectedNode.label)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-secondary text-xs text-muted-foreground active:scale-95 transition-transform"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopied ? "Disalin" : "Salin"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Mode B: Hierarchical Outline Accordion List */
          <div className="w-full h-full overflow-y-auto p-4 space-y-2">
            <div className="text-[11px] text-muted-foreground px-1 mb-2">
              Daftar struktur hierarki materi (ketuk untuk ciutkan/mekarkan cabang):
            </div>
            {renderOutlineNode(data.root, 0)}
          </div>
        )}
      </div>

      {/* Footer with Thumbs Up/Down */}
      <div className="px-4 py-2 border-t border-border bg-card flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleFeedback("good")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer",
              feedback === "good" ? "bg-primary/20 text-primary" : "text-muted-foreground"
            )}
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            <span>{t("goodContent") || "Konten bagus"}</span>
          </button>

          <button
            type="button"
            onClick={() => handleFeedback("bad")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer",
              feedback === "bad" ? "bg-destructive/20 text-destructive" : "text-muted-foreground"
            )}
          >
            <ThumbsDown className="w-3.5 h-3.5" />
            <span>{t("badContent") || "Konten buruk"}</span>
          </button>
        </div>

        <div className="text-[10px] text-muted-foreground">
          Const Learn Mobile
        </div>
      </div>
    </div>
  );
}

