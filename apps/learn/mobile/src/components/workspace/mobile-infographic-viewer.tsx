import React, { useState, useRef } from "react";
import {
  ArrowLeft,
  Download,
  Copy,
  Sparkles,
  MessageSquare,
  BarChart3,
  Info,
  ChevronDown,
  ChevronUp,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import { cn, toast } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { LocalArtifact, InfographicData } from "../../lib/db";

export interface MobileInfographicViewerProps {
  artifact?: LocalArtifact;
  data: InfographicData;
  onClose: () => void;
  onExplainInChat?: (prompt: string) => void;
}

export function MobileInfographicViewer({
  artifact,
  data,
  onClose,
  onExplainInChat,
}: MobileInfographicViewerProps) {
  const { language } = useI18n();
  const isIndo = language === "id";

  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panPosition, setPanPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleDownload = async () => {
    if (!data.imageUrl) return;

    try {
      const safeTitle = (data.title || "infografis")
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "_")
        .slice(0, 30);

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
        isIndo ? "Mulai mengunduh infografis..." : "Downloading infographic..."
      );
    } catch {
      window.open(data.imageUrl, "_blank");
    }
  };

  const handleCopyPrompt = () => {
    const textToCopy = data.prompt || data.visualPrompt || data.title;
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    toast.success(isIndo ? "Prompt disalin!" : "Prompt copied!");
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDiscussInChat = () => {
    if (!onExplainInChat) return;
    const prompt = isIndo
      ? `Tolong jelaskan lebih dalam intisari dari infografis "${data.title}":\n\nRingkasan: ${data.summary || ""}\nPoin Kunci:\n${(data.keyPoints || []).map((p) => `- ${p}`).join("\n")}`
      : `Please analyze and elaborate on the concepts in this infographic "${data.title}":\n\nSummary: ${data.summary || ""}\nKey Points:\n${(data.keyPoints || []).map((p) => `- ${p}`).join("\n")}`;

    onExplainInChat(prompt);
  };

  const toggleZoom = () => {
    if (zoomLevel === 1) {
      setZoomLevel(2);
    } else {
      setZoomLevel(1);
      setPanPosition({ x: 0, y: 0 });
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && zoomLevel > 1) {
      touchStartRef.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
      lastPanRef.current = { ...panPosition };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && zoomLevel > 1) {
      const dx = e.touches[0]!.clientX - touchStartRef.current.x;
      const dy = e.touches[0]!.clientY - touchStartRef.current.y;
      setPanPosition({
        x: lastPanRef.current.x + dx,
        y: lastPanRef.current.y + dy,
      });
    }
  };

  const orientationBadge =
    data.orientation === "portrait"
      ? "9:16"
      : data.orientation === "square"
      ? "1:1"
      : "16:9";

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0a0b0e] text-foreground flex flex-col font-sans select-none animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      {/* Top Header */}
      <header className="h-14 px-3 border-b border-border/60 bg-card/90 backdrop-blur-md flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Kembali"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xs font-semibold text-foreground truncate">
              {data.title || (isIndo ? "Infografis AI" : "AI Infographic")}
            </h1>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 truncate">
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

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={toggleZoom}
            className="h-8 w-8 rounded-lg bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            title="Zoom"
          >
            {zoomLevel > 1 ? <RotateCcw className="h-3.5 w-3.5" /> : <ZoomIn className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={handleCopyPrompt}
            className="h-8 w-8 rounded-lg bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            title={isIndo ? "Salin Prompt" : "Copy Prompt"}
          >
            {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="h-8 px-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="text-[11px]">{isIndo ? "Unduh" : "Save"}</span>
          </button>
        </div>
      </header>

      {/* Main Touch Canvas */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onDoubleClick={toggleZoom}
        className="flex-1 relative overflow-hidden flex items-center justify-center p-3"
      >
        <div
          style={{
            transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomLevel})`,
            transition: zoomLevel === 1 ? "transform 0.2s ease-out" : "none",
          }}
          className="relative max-h-full max-w-full flex items-center justify-center rounded-xl overflow-hidden shadow-2xl"
        >
          {!imageLoaded && (
            <div className="w-72 h-72 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <div className="h-7 w-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">{isIndo ? "Memuat infografis..." : "Loading..."}</span>
            </div>
          )}

          <img
            src={data.imageUrl}
            alt={data.title}
            onLoad={() => setImageLoaded(true)}
            className={cn(
              "object-contain max-h-[76dvh] max-w-full rounded-xl transition-opacity duration-300",
              imageLoaded ? "opacity-100" : "opacity-0"
            )}
          />
        </div>
      </div>

      {/* Bottom Drawer for Summary & Keypoints */}
      <div className="border-t border-border/60 bg-card/95 backdrop-blur-md shrink-0 z-20">
        <button
          type="button"
          onClick={() => setIsDetailsOpen(!isDetailsOpen)}
          className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Info className="h-3.5 w-3.5 text-primary" />
            <span>{isIndo ? "Intisari & Poin Materi" : "Insights & Key Takeaways"}</span>
            {data.keyPoints && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-secondary text-muted-foreground font-mono">
                {data.keyPoints.length}
              </span>
            )}
          </div>
          {isDetailsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
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
                  className="w-full py-2 rounded-xl bg-secondary hover:bg-muted text-foreground flex items-center justify-center gap-2 font-medium transition-colors cursor-pointer"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                  <span>{isIndo ? "Diskusikan di Chat AI" : "Discuss in AI Chat"}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
