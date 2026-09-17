import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Maximize,
  Plus,
  Minus,
  Download,
  Check,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Share2,
  FileCode,
  FileDown,
  Image as ImageIcon,
  Search,
  X,
  Copy,
  Sparkles,
  Target,
  ExternalLink,
  UnfoldHorizontal,
  FoldHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  toast,
  cn,
} from "@const/ui";
import { useI18n } from "../../../lib/i18n";
import {
  type MindMapNode,
  type TreeLayoutResult,
  type PositionedNode,
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

  // Default collapsed: collapse Level 2+ branches initially so user starts with clean overview
  const initialCollapsed = useMemo(() => {
    const collapsed = new Set<string>();
    if (root?.children) {
      for (const level1 of root.children) {
        if (level1.children && level1.children.length > 0) {
          collapsed.add(level1.id);
        }
      }
    }
    return collapsed;
  }, [root]);

  // Set of node IDs that are collapsed
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(initialCollapsed);

  // Sync initial collapsed state on root change
  useEffect(() => {
    setCollapsedIds(initialCollapsed);
  }, [root.id, initialCollapsed]);

  // Pan and Zoom transform state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Node selection & detail inspector state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);

  // Copied label state
  const [isCopied, setIsCopied] = useState(false);

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
    const padding = 70;
    const scaleX = (clientWidth - padding) / bounds.width;
    const scaleY = (clientHeight - padding) / bounds.height;
    const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.45), 1.2);

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

  // All node IDs with children for Expand All / Collapse All
  const allExpandableIds = useMemo(() => {
    const ids: string[] = [];
    const walk = (n: MindMapNode) => {
      if (n.children && n.children.length > 0) {
        ids.push(n.id);
        n.children.forEach(walk);
      }
    };
    walk(root);
    return ids;
  }, [root]);

  const isAllExpanded = useMemo(() => {
    if (allExpandableIds.length === 0) return false;
    return allExpandableIds.every((id) => !collapsedIds.has(id));
  }, [allExpandableIds, collapsedIds]);

  // Toggle expand all / collapse all
  const handleToggleExpandAll = useCallback(() => {
    if (isAllExpanded) {
      // Collapse back to Level 1 branches
      const nextCollapsed = new Set<string>();
      if (root?.children) {
        for (const level1 of root.children) {
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
      // Expand all nodes
      setCollapsedIds(new Set());
      toast.success("Semua cabang dimekarkan");
      setTimeout(() => {
        handleFitToView();
      }, 50);
    }
  }, [isAllExpanded, root, handleFitToView]);

  // Selected node reference
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return layout.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [layout.nodes, selectedNodeId]);

  // Breadcrumb path for selected node
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

  // Filtered search matches
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return layout.nodes.filter(
      (n) =>
        n.label.toLowerCase().includes(q) ||
        (n.node.description && n.node.description.toLowerCase().includes(q))
    );
  }, [layout.nodes, searchQuery]);

  // ---------------------------------------------------------------------------
  // Focal-Point Zoom Engine
  // ---------------------------------------------------------------------------
  const zoomToPoint = useCallback((focalX: number, focalY: number, factor: number) => {
    setZoom((prevZoom) => {
      const nextZoom = Math.min(Math.max(prevZoom * factor, 0.25), 2.5);
      if (Math.abs(nextZoom - prevZoom) < 0.001) return prevZoom;

      setPan((prevPan) => {
        // World coordinates of focal point before zoom
        const worldX = (focalX - prevPan.x) / prevZoom;
        const worldY = (focalY - prevPan.y) / prevZoom;

        // Position new pan so world point stays locked under focal point
        const nextPanX = focalX - worldX * nextZoom;
        const nextPanY = focalY - worldY * nextZoom;
        return { x: nextPanX, y: nextPanY };
      });

      return nextZoom;
    });
  }, []);

  // Zoom in / out anchored to viewport center
  const handleZoomIn = () => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    zoomToPoint(clientWidth / 2, clientHeight / 2, 1.2);
  };

  const handleZoomOut = () => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    zoomToPoint(clientWidth / 2, clientHeight / 2, 1 / 1.2);
  };

  // ---------------------------------------------------------------------------
  // Smart Branch Focus & Camera Auto-Framing
  // ---------------------------------------------------------------------------
  const focusNodeOrBranch = useCallback(
    (nodeId: string, customLayout?: TreeLayoutResult) => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      if (clientWidth === 0 || clientHeight === 0) return;

      const activeLayout = customLayout || layout;
      const target = activeLayout.nodes.find((n) => n.id === nodeId);
      if (!target) return;

      // Collect all descendants of target currently in layout
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

      const branchW = Math.max(maxX - minX, 180);
      const branchH = Math.max(maxY - minY, 100);

      // Desired margins
      const padX = 140;
      const padY = 110;
      const scaleX = (clientWidth - padX) / branchW;
      const scaleY = (clientHeight - padY) / branchH;

      let targetZoom: number;
      if (branchNodes.length > 1) {
        // Multi-node branch: zoom out if needed so entire branch comfortably fits
        const fitScale = Math.min(scaleX, scaleY);
        targetZoom = Math.min(zoom, Math.max(Math.min(fitScale, 1.15), 0.45));
      } else {
        // Single node: keep clean reading scale
        targetZoom = Math.min(Math.max(zoom, 0.85), 1.15);
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

  // Toggle collapsed state with progressive 1-by-1 level expansion
  const handleToggleCollapse = useCallback(
    (nodeId: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        const isCurrentlyCollapsed = next.has(nodeId);
        if (isCurrentlyCollapsed) {
          next.delete(nodeId); // Expand this node

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
          const targetNode = findNode(root);
          if (targetNode && targetNode.children) {
            for (const child of targetNode.children) {
              if (child.children && child.children.length > 0) {
                next.add(child.id);
              }
            }
          }
        } else {
          next.add(nodeId); // Collapse this node
        }

        // Calculate prospective layout to frame immediately
        const prospectiveLayout = computeTreeLayout(root, next);
        setTimeout(() => {
          focusNodeOrBranch(nodeId, prospectiveLayout);
        }, 20);

        return next;
      });
    },
    [root, focusNodeOrBranch]
  );

  // Mouse drag pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    if ((e.target as HTMLElement).closest("button, input")) return;

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

  // Wheel zoom handler: anchored to mouse pointer
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const focalX = e.clientX - rect.left;
    const focalY = e.clientY - rect.top;

    if (e.ctrlKey || Math.abs(e.deltaY) > 20) {
      const zoomFactor = e.deltaY > 0 ? 0.91 : 1.09;
      zoomToPoint(focalX, focalY, zoomFactor);
    } else {
      // Pan via 2-finger scroll
      setPan((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  // Double click on canvas background fits to view
  const handleDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("g[data-node='true']")) return;
    handleFitToView();
  };

  // Search jump helpers
  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = (searchMatchIndex + 1) % searchMatches.length;
    setSearchMatchIndex(nextIdx);
    const target = searchMatches[nextIdx];
    if (target) {
      setSelectedNodeId(target.id);
      focusNodeOrBranch(target.id);
    }
  };

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIdx = (searchMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setSearchMatchIndex(prevIdx);
    const target = searchMatches[prevIdx];
    if (target) {
      setSelectedNodeId(target.id);
      focusNodeOrBranch(target.id);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;

      if (e.key === "+" || e.key === "=") {
        handleZoomIn();
      } else if (e.key === "-") {
        handleZoomOut();
      } else if (e.key === "0" || e.key.toLowerCase() === "f") {
        handleFitToView();
      } else if (e.key === "Escape") {
        setSelectedNodeId(null);
        setIsSearchOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFitToView]);

  // Export handlers
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
    toast.success("Mind Map diekspor sebagai Markdown");
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
    toast.success("Mind Map diekspor sebagai SVG");
  };

  const handleExportPng = () => {
    const svgEl = containerRef.current?.querySelector("svg");
    if (!svgEl) return;
    const { bounds } = layout;

    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgEl);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = 2; // high-resolution export
      canvas.width = Math.max(bounds.width * scale, 1200);
      canvas.height = Math.max(bounds.height * scale, 800);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Clean background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.scale(scale, scale);
      ctx.drawImage(img, -bounds.minX + 40, -bounds.minY + 40);

      URL.revokeObjectURL(url);
      const pngUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `${title.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Mind Map diekspor sebagai PNG");
    };

    img.src = url;
  };

  const handleCopyNodeText = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setIsCopied(true);
      toast.success("Teks konsep disalin!");
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      className={cn(
        "w-full h-full relative overflow-hidden bg-background select-none font-sans",
        isPanning ? "cursor-grabbing" : "cursor-grab"
      )}
    >
      {/* Floating Canvas Controls Toolbar (Left Edge) */}
      <div className="absolute top-6 left-5 z-20 flex flex-col items-center bg-card/90 backdrop-blur-md rounded-2xl border border-border p-1 shadow-md space-y-1">
        <button
          type="button"
          onClick={handleFitToView}
          className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          title={t("fitToView") || "Pusatkan (F)"}
          aria-label={t("fitToView") || "Pusatkan"}
        >
          <Maximize className="h-4 w-4" />
        </button>

        <div className="w-5 h-[1px] bg-border" />

        <button
          type="button"
          onClick={handleZoomIn}
          className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          title={t("zoomIn") || "Perbesar (+)"}
          aria-label={t("zoomIn") || "Perbesar"}
        >
          <Plus className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={handleZoomOut}
          className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          title={t("zoomOut") || "Perkecil (-)"}
          aria-label={t("zoomOut") || "Perkecil"}
        >
          <Minus className="h-4 w-4" />
        </button>

        <div className="w-5 h-[1px] bg-border" />

        {/* Expand All / Collapse All Toggle Button (Icon only) */}
        <button
          type="button"
          onClick={handleToggleExpandAll}
          className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          title={isAllExpanded ? "Ciutkan Semua Cabang" : "Buka Semua Cabang"}
          aria-label={isAllExpanded ? "Ciutkan Semua Cabang" : "Buka Semua Cabang"}
        >
          {isAllExpanded ? <FoldHorizontal className="h-4 w-4" /> : <UnfoldHorizontal className="h-4 w-4" />}
        </button>

        <div className="w-5 h-[1px] bg-border" />

        {/* Search Toggle Button */}
        <button
          type="button"
          onClick={() => setIsSearchOpen((prev) => !prev)}
          className={cn(
            "h-8 w-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer",
            isSearchOpen
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
          title="Cari Simpul"
          aria-label="Cari Simpul"
        >
          <Search className="h-4 w-4" />
        </button>

        <div className="w-5 h-[1px] bg-border" />

        {/* Export Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title={t("downloadMindMap") || "Ekspor Peta Pikiran"}
              aria-label={t("downloadMindMap") || "Ekspor Peta Pikiran"}
            >
              <Download className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right" className="w-48 bg-popover border-border text-popover-foreground">
            <DropdownMenuItem
              onClick={handleExportPng}
              className="cursor-pointer text-xs flex items-center gap-2 hover:bg-muted"
            >
              <ImageIcon className="h-3.5 w-3.5 text-primary" />
              <span>Ekspor Gambar PNG</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleExportSvg}
              className="cursor-pointer text-xs flex items-center gap-2 hover:bg-muted"
            >
              <FileDown className="h-3.5 w-3.5 text-emerald-500" />
              <span>Ekspor Gambar SVG</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleExportMarkdown}
              className="cursor-pointer text-xs flex items-center gap-2 hover:bg-muted"
            >
              <FileCode className="h-3.5 w-3.5 text-sky-500" />
              <span>Ekspor Markdown</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Floating Search Bar (Top-Right or next to toolbar) */}
      {isSearchOpen && (
        <div className="absolute top-6 left-16 z-20 flex items-center bg-card/95 backdrop-blur-md rounded-2xl border border-border px-3 py-1.5 shadow-lg gap-2 animate-in fade-in slide-in-from-left-2 duration-150">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchMatchIndex(0);
            }}
            placeholder="Cari konsep dalam peta..."
            className="w-48 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
          />

          {searchMatches.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0 border-l border-border pl-2">
              <span>
                {searchMatchIndex + 1}/{searchMatches.length}
              </span>
              <button
                type="button"
                onClick={handlePrevMatch}
                className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                title="Sebelumnya"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleNextMatch}
                className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                title="Berikutnya"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setIsSearchOpen(false);
              setSearchQuery("");
            }}
            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground ml-1"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Canvas SVG Layer with Smooth Camera Pan & Zoom Transform */}
      <svg
        className="w-full h-full absolute inset-0 pointer-events-none"
        style={{ overflow: "visible" }}
      >
        <g
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            transition: isPanning ? "none" : "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Connector Bezier Curves */}
          {layout.curves.map((curve) => (
            <path
              key={curve.id}
              d={curve.path}
              fill="none"
              stroke={curve.colorHex}
              strokeWidth="2.2"
              strokeLinecap="round"
              opacity="0.85"
              className="transition-all duration-300"
            />
          ))}

          {/* Interactive Mind Map Nodes */}
          {layout.nodes.map((posNode) => {
            const isRoot = posNode.isRoot;
            const hasChildren = posNode.hasChildren;
            const isCollapsed = posNode.isCollapsed;
            const isSelected = selectedNodeId === posNode.id;
            const isMatched = searchMatches.some((m) => m.id === posNode.id);
            const theme = posNode.branchTheme;

            return (
              <g
                key={posNode.id}
                data-node="true"
                transform={`translate(${posNode.x}, ${posNode.y})`}
                style={{
                  transform: `translate(${posNode.x}px, ${posNode.y}px)`,
                  transition: isPanning
                    ? "none"
                    : "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease-out",
                }}
                className="pointer-events-auto cursor-pointer animate-in fade-in zoom-in-95 duration-300"
                onClick={() => setSelectedNodeId(posNode.id)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  focusNodeOrBranch(posNode.id);
                }}
              >
                {/* Highlight Glow for Search Matches */}
                {isMatched && (
                  <rect
                    x="-3"
                    y="-3"
                    width={posNode.width + 6}
                    height={posNode.height + 6}
                    rx="22"
                    ry="22"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="3"
                    className="animate-pulse"
                    opacity="0.9"
                  />
                )}

                {/* Node Pill Shape */}
                <rect
                  x="0"
                  y="0"
                  width={posNode.width}
                  height={posNode.height}
                  rx="18"
                  ry="18"
                  fill="hsl(var(--card))"
                  stroke={isSelected ? "#2563eb" : theme.borderHex}
                  strokeWidth={isSelected ? "2.5" : isRoot ? "2" : "1.4"}
                  className={cn(
                    "transition-all duration-200 filter drop-shadow-xs",
                    isSelected && "ring-2 ring-primary/40"
                  )}
                />

                {/* Branch Color Tint Background Overlay */}
                <rect
                  x="0"
                  y="0"
                  width={posNode.width}
                  height={posNode.height}
                  rx="18"
                  ry="18"
                  fill={theme.bgHex}
                  style={{ pointerEvents: "none" }}
                />

                {/* Branch Accent Indicator Pip */}
                {!isRoot && (
                  <circle
                    cx="14"
                    cy={posNode.height / 2}
                    r="3.5"
                    fill={theme.curveHex}
                    style={{ pointerEvents: "none" }}
                  />
                )}

                {/* Node Label Text (Adaptive 1 or 2 lines) */}
                {posNode.lines.length === 1 ? (
                  <text
                    x={isRoot ? 22 : 24}
                    y={posNode.height / 2 + 4.5}
                    fontSize={isRoot ? "13.5px" : "12.5px"}
                    fontWeight={isRoot ? "600" : "500"}
                    fontFamily="Inter, -apple-system, sans-serif"
                    className="fill-foreground"
                    style={{ pointerEvents: "none" }}
                  >
                    {posNode.lines[0]}
                  </text>
                ) : (
                  <text
                    x={isRoot ? 22 : 24}
                    y={posNode.height / 2 - 3.5}
                    fontSize={isRoot ? "13px" : "12px"}
                    fontWeight={isRoot ? "600" : "500"}
                    fontFamily="Inter, -apple-system, sans-serif"
                    className="fill-foreground"
                    style={{ pointerEvents: "none" }}
                  >
                    <tspan x={isRoot ? 22 : 24} dy="0">
                      {posNode.lines[0]}
                    </tspan>
                    <tspan x={isRoot ? 22 : 24} dy="15">
                      {posNode.lines[1]}
                    </tspan>
                  </text>
                )}

                {/* Collapse / Expand Toggle Button on nodes with children */}
                {hasChildren && (
                  <g
                    transform={`translate(${posNode.width - 26}, ${(posNode.height - 22) / 2})`}
                    onClick={(e) => handleToggleCollapse(posNode.id, e)}
                    className="cursor-pointer group"
                  >
                    {/* Toggle button background pill */}
                    <rect
                      x="0"
                      y="0"
                      width="20"
                      height="22"
                      rx="10"
                      ry="10"
                      fill={theme.badgeBgHex}
                      className="group-hover:opacity-80 transition-opacity"
                    />

                    {/* Smooth rotating chevron icon */}
                    <g
                      style={{
                        transformOrigin: "10px 11px",
                        transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)",
                        transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                      }}
                    >
                      <path
                        d="M 8 7.5 L 12 11 L 8 14.5"
                        fill="none"
                        stroke={theme.badgeTextHex}
                        strokeWidth="2"
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

      {/* Floating Node Detail Inspector Card (Bottom-Center / Bottom-Left) */}
      {selectedNode && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-[90%] max-w-md bg-card/95 backdrop-blur-md rounded-2xl border border-border p-4 shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              {/* Breadcrumb path */}
              <div className="text-[10.5px] text-muted-foreground flex items-center gap-1 mb-1 truncate">
                {selectedBreadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <span className="opacity-50">&gt;</span>}
                    <span className={idx === selectedBreadcrumbs.length - 1 ? "text-foreground font-medium" : ""}>
                      {crumb}
                    </span>
                  </React.Fragment>
                ))}
              </div>

              {/* Full Title without truncation */}
              <h3 className="text-sm font-semibold text-foreground tracking-tight break-words">
                {selectedNode.label}
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setSelectedNodeId(null)}
              className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground shrink-0"
              title="Tutup Detail"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Node Description if available */}
          {selectedNode.node.description && (
            <p className="text-xs text-muted-foreground leading-relaxed mb-3 bg-secondary/50 p-2 rounded-xl">
              {selectedNode.node.description}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-1 border-t border-border gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => focusNodeOrBranch(selectedNode.id)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-secondary hover:bg-secondary/80 text-[11px] font-medium text-foreground transition-colors cursor-pointer"
                title="Pusatkan dan sesuaikan zoom ke cabang ini"
              >
                <Target className="h-3.5 w-3.5 text-primary" />
                <span>Pusatkan Cabang</span>
              </button>

              {selectedNode.hasChildren && (
                <button
                  type="button"
                  onClick={() => handleToggleCollapse(selectedNode.id)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-secondary hover:bg-secondary/80 text-[11px] font-medium text-foreground transition-colors cursor-pointer"
                >
                  <span>{selectedNode.isCollapsed ? "Buka Cabang" : "Ciutkan Cabang"}</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleCopyNodeText(selectedNode.label)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl hover:bg-muted text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Salin Teks"
            >
              {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{isCopied ? "Tersalin" : "Salin"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

