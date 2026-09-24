import React, { useState, useRef } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Copy,
  Maximize2,
  Minimize2,
  Sparkles,
  MessageSquare,
  BarChart3,
  Layers,
  Info,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";
import { cn, toast } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { LocalArtifact, InfographicData } from "../../lib/db";

export interface InfographicViewerProps {
  artifact?: LocalArtifact;
  data: InfographicData;
  onExplainInChat?: (prompt: string) => void;
  onToggleExpand?: () => void;
  isExpanded?: boolean;
}

export function InfographicViewer({
  artifact,
  data,
  onExplainInChat,
  onToggleExpand,
  isExpanded = false,
}: InfographicViewerProps) {
  const { language } = useI18n();
  const isIndo = language === "id";

  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panPosition, setPanPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 3.5));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => {
      const next = Math.max(prev - 0.25, 0.5);
      if (next <= 1) setPanPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      setPanPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDownload = async () => {
    if (!data.imageUrl) return;

    try {
      const safeTitle = (data.title || "infografis")
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "_")
        .slice(0, 40);

      let downloadHref = data.imageUrl;
      let shouldRevoke = false;

      if (data.imageUrl.startsWith("http://") || data.imageUrl.startsWith("https://")) {
        try {
          const res = await fetch(data.imageUrl);
          if (res.ok) {
            const blob = await res.blob();
            downloadHref = URL.createObjectURL(blob);
            shouldRevoke = true;
          }
        } catch {
          // Fall back to direct link if CORS blocks blob fetch
          downloadHref = data.imageUrl;
        }
      }

      const a = document.createElement("a");
      a.href = downloadHref;
      a.download = `${safeTitle}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      if (shouldRevoke) {
        setTimeout(() => URL.revokeObjectURL(downloadHref), 2000);
      }

      toast.success(
        isIndo ? "Gambar infografis mulai diunduh!" : "Downloading infographic image!"
      );
    } catch (err) {
      window.open(data.imageUrl, "_blank");
    }
  };

  const handleCopyPrompt = () => {
    const textToCopy = data.prompt || data.visualPrompt || data.title;
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    toast.success(isIndo ? "Prompt visual disalin ke papan klip!" : "Visual prompt copied!");
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDiscussInChat = () => {
    if (!onExplainInChat) return;
    const prompt = isIndo
      ? `Tolong jelaskan lebih dalam dan diskusikan poin-poin materi dari infografis "${data.title}":\n\nRingkasan: ${data.summary || ""}\nPoin Kunci:\n${(data.keyPoints || []).map((p) => `- ${p}`).join("\n")}`
      : `Please analyze and elaborate on the concepts presented in this infographic "${data.title}":\n\nSummary: ${data.summary || ""}\nKey Points:\n${(data.keyPoints || []).map((p) => `- ${p}`).join("\n")}`;

    onExplainInChat(prompt);
  };

  const orientationBadge =
    data.orientation === "portrait"
      ? isIndo ? "Potret (9:16)" : "Portrait (9:16)"
      : data.orientation === "square"
      ? isIndo ? "Persegi (1:1)" : "Square (1:1)"
      : isIndo ? "Lanskap (16:9)" : "Landscape (16:9)";

  return (
    <div className="h-full flex flex-col bg-background text-foreground select-none overflow-hidden font-sans">
      {/* Top Header Bar */}
      <div className="h-13 px-4 border-b border-border/60 bg-card/60 backdrop-blur-sm flex items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="h-8 w-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-foreground tracking-tight truncate">
              {data.title || (isIndo ? "Infografis AI" : "AI Infographic")}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground truncate">
              <span className="capitalize">{data.styleLabel || data.style}</span>
              <span>·</span>
              <span>{orientationBadge}</span>
              {data.modelUsed && (
                <>
                  <span>·</span>
                  <span className="font-mono truncate">{data.modelUsed}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Zoom controls */}
          <div className="hidden sm:flex items-center bg-secondary/80 rounded-lg p-0.5 border border-border/60">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 0.5}
              className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center disabled:opacity-40 transition-colors cursor-pointer"
              title={isIndo ? "Perkecil" : "Zoom out"}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="text-[10px] font-mono px-1.5 text-muted-foreground min-w-10 text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 3.5}
              className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center disabled:opacity-40 transition-colors cursor-pointer"
              title={isIndo ? "Perbesar" : "Zoom in"}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            {zoomLevel !== 1 && (
              <button
                type="button"
                onClick={handleResetZoom}
                className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer border-l border-border/50 ml-0.5"
                title={isIndo ? "Reset Zoom" : "Reset zoom"}
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Copy Prompt */}
          <button
            type="button"
            onClick={handleCopyPrompt}
            className="h-8 px-2 rounded-lg bg-secondary/80 hover:bg-secondary border border-border/60 text-muted-foreground hover:text-foreground text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title={isIndo ? "Salin Prompt" : "Copy Prompt"}
          >
            {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="hidden md:inline">{isIndo ? "Salin" : "Copy"}</span>
          </button>

          {/* Download Image */}
          <button
            type="button"
            onClick={handleDownload}
            className="h-8 px-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            title={isIndo ? "Unduh Gambar (PNG)" : "Download Image"}
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{isIndo ? "Unduh" : "Download"}</span>
          </button>

          {/* Toggle Expand */}
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer ml-0.5"
              title={isExpanded ? (isIndo ? "Kecilkan Panel" : "Collapse") : (isIndo ? "Lebarkan Panel" : "Expand")}
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Main Viewport */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={cn(
          "flex-1 relative overflow-hidden bg-[#0c0d11] flex items-center justify-center p-4",
          zoomLevel > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
        )}
      >
        {/* Subtle grid backdrop */}
        <div className="absolute inset-0 bg-[radial-gradient(#272935_1px,transparent_1px)] [background-size:20px_20px] opacity-40 pointer-events-none" />

        {/* Infographic Image Container */}
        <div
          style={{
            transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomLevel})`,
            transition: isDragging ? "none" : "transform 0.15s ease-out",
          }}
          className="relative max-h-full max-w-full flex items-center justify-center shadow-2xl rounded-xl overflow-hidden border border-[#2a2d38]"
        >
          {!imageLoaded && (
            <div className="w-96 h-80 flex flex-col items-center justify-center gap-3 text-muted-foreground bg-[#13141a]">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">{isIndo ? "Memuat infografis..." : "Loading infographic..."}</span>
            </div>
          )}

          <img
            src={data.imageUrl}
            alt={data.title}
            onLoad={() => setImageLoaded(true)}
            className={cn(
              "object-contain max-h-[82vh] max-w-full transition-opacity duration-300",
              imageLoaded ? "opacity-100" : "opacity-0"
            )}
          />
        </div>
      </div>

      {/* Collapsible Bottom Summary Panel */}
      <div className="border-t border-border/60 bg-card/95 backdrop-blur-md shrink-0">
        <button
          type="button"
          onClick={() => setIsDetailsOpen(!isDetailsOpen)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Info className="h-3.5 w-3.5 text-primary" />
            <span>{isIndo ? "Intisari & Poin Materi Infografis" : "Infographic Insights & Key Takeaways"}</span>
            {data.keyPoints && data.keyPoints.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-secondary text-muted-foreground font-mono">
                {data.keyPoints.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isDetailsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </div>
        </button>

        {isDetailsOpen && (
          <div className="px-4 pb-4 pt-1 space-y-3 max-h-48 overflow-y-auto text-xs border-t border-border/40">
            {data.summary && (
              <div>
                <span className="font-semibold text-foreground block mb-0.5">
                  {isIndo ? "Ringkasan" : "Summary"}
                </span>
                <p className="text-muted-foreground leading-relaxed">{data.summary}</p>
              </div>
            )}

            {data.keyPoints && data.keyPoints.length > 0 && (
              <div>
                <span className="font-semibold text-foreground block mb-1">
                  {isIndo ? "Poin Kunci" : "Key Takeaways"}
                </span>
                <ul className="space-y-1">
                  {data.keyPoints.map((pt, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                      <span className="leading-snug">{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {onExplainInChat && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDiscussInChat}
                  className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted text-foreground flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                  <span>{isIndo ? "Tanyakan & Diskusikan di Chat AI" : "Discuss in AI Chat"}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
