import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  FileSpreadsheet,
  Search,
  Download,
  SquarePen,
  Copy,
  Check,
  HelpCircle,
  Maximize2,
  Minimize2,
  X,
  AlertCircle,
  Layers,
} from "lucide-react";
import { cn, ScrollArea, toast } from "@const/ui";
import { marked } from "marked";
import { useI18n } from "../../lib/i18n";
import { MarkdownContent } from "../workspace/markdown-content";
import type { CheatSheetData, CheatSheetCard, LocalArtifact } from "../../lib/db";

export interface CheatSheetViewerProps {
  artifact?: LocalArtifact;
  data: CheatSheetData;
  onExplainInChat?: (prompt: string) => void;
  onExportAsNote?: (data: CheatSheetData) => void;
  onToggleExpand?: () => void;
  isExpanded?: boolean;
  onRetry?: () => void;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getBadgePrintClass(badge?: string): string {
  if (!badge) return "badge-sky";
  const b = badge.toUpperCase();
  if (b.includes("JEBAKAN") || b.includes("PITFALL") || b.includes("PERINGATAN") || b.includes("WARNING")) return "badge-rose";
  if (b.includes("SINTAKS") || b.includes("KODE") || b.includes("SYNTAX") || b.includes("CLI")) return "badge-emerald";
  if (b.includes("TIPS") || b.includes("TRIK") || b.includes("MNEMONIK") || b.includes("SHORTCUT")) return "badge-amber";
  if (b.includes("KOMPARASI") || b.includes("PERBANDINGAN") || b.includes("VS")) return "badge-purple";
  return "badge-sky";
}

function buildCheatSheetPrintableHtml(data: CheatSheetData, isIndo: boolean): string {
  const cardsHtml = (data.cards || [])
    .map((card) => {
      let contentHtml = "";
      try {
        contentHtml = marked.parse(card.content || "") as string;
      } catch {
        contentHtml = `<pre>${escapeHtml(card.content || "")}</pre>`;
      }

      return `
      <div class="card ${card.span === "wide" ? "wide" : ""}">
        <div class="card-header">
          <h3 class="card-title">${escapeHtml(card.title)}</h3>
          ${card.badge ? `<span class="badge ${getBadgePrintClass(card.badge)}">${escapeHtml(card.badge)}</span>` : ""}
        </div>
        <div class="card-body">
          ${contentHtml}
        </div>
        <div class="card-footer">
          <span class="card-id">#${escapeHtml(card.id)}</span>
        </div>
      </div>
      `;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="${isIndo ? "id" : "en"}">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(data.title || "CheatSheet")}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 10mm 12mm 10mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 11px;
      line-height: 1.5;
      color: #1f2937;
      background: #ffffff;
      padding: 16px;
    }
    .header {
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .header-title {
      font-size: 18px;
      font-weight: 700;
      color: #111827;
      letter-spacing: -0.02em;
      margin-bottom: 4px;
    }
    .header-meta {
      font-size: 10px;
      color: #6b7280;
    }
    .header-brand {
      text-align: right;
      font-size: 9px;
      font-weight: 600;
      color: #0284c7;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .grid {
      column-count: 2;
      column-gap: 12px;
    }
    .card {
      break-inside: avoid;
      page-break-inside: avoid;
      margin-bottom: 12px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    .card.wide {
      column-span: all;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid #f1f5f9;
    }
    .card-title {
      font-size: 12px;
      font-weight: 600;
      color: #0f172a;
      line-height: 1.3;
    }
    .badge {
      font-size: 8.5px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-family: ui-monospace, monospace;
      white-space: nowrap;
    }
    .badge-sky { background: #e0f2fe; color: #0284c7; }
    .badge-rose { background: #ffe4e6; color: #e11d48; }
    .badge-emerald { background: #d1fae5; color: #059669; }
    .badge-amber { background: #fef3c7; color: #d97706; }
    .badge-purple { background: #f3e8ff; color: #7c3aed; }
    .card-body {
      color: #334155;
      font-size: 10.5px;
      line-height: 1.5;
    }
    .card-body p { margin-bottom: 6px; }
    .card-body p:last-child { margin-bottom: 0; }
    .card-body ul, .card-body ol {
      margin-left: 16px;
      margin-bottom: 6px;
    }
    .card-body li { margin-bottom: 2px; }
    .card-body pre {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 8px;
      overflow-x: auto;
      font-family: ui-monospace, monospace;
      font-size: 9.5px;
      margin: 6px 0;
    }
    .card-body code {
      font-family: ui-monospace, monospace;
      font-size: 9.5px;
      background: #f1f5f9;
      padding: 1px 4px;
      border-radius: 3px;
    }
    .card-body table {
      width: 100%;
      border-collapse: collapse;
      margin: 6px 0;
      font-size: 9.5px;
    }
    .card-body th, .card-body td {
      border: 1px solid #e2e8f0;
      padding: 4px 6px;
      text-align: left;
    }
    .card-body th {
      background: #f8fafc;
      font-weight: 600;
    }
    .card-footer {
      margin-top: 6px;
      display: flex;
      justify-content: flex-end;
    }
    .card-id {
      font-size: 8.5px;
      color: #94a3b8;
      font-family: ui-monospace, monospace;
    }
    .footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 9px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="header-title">${escapeHtml(data.title || "CheatSheet")}</h1>
      <div class="header-meta">
        ${data.cards?.length || 0} ${isIndo ? "Kartu Referensi Pintar" : "Smart Reference Cards"} · 
        ${data.topic ? escapeHtml(data.topic) + " · " : ""}
        ${new Date().toLocaleDateString(isIndo ? "id-ID" : "en-US", { day: "numeric", month: "short", year: "numeric" })}
      </div>
    </div>
    <div class="header-brand">Const Learn Studio</div>
  </div>

  <div class="grid">
    ${cardsHtml}
  </div>

  <div class="footer">
    ${escapeHtml(data.title || "CheatSheet")} · ${isIndo ? "Dihasilkan secara cerdas dengan Const Learn Studio" : "Generated with Const Learn Studio"}
  </div>
</body>
</html>`;
}

export function CheatSheetViewer({
  artifact,
  data,
  onExplainInChat,
  onExportAsNote,
  onToggleExpand: _onToggleExpand,
  isExpanded: _isExpanded = false,
}: CheatSheetViewerProps) {
  const { t, language } = useI18n();
  const isIndo = language === "id";

  const [searchQuery, setSearchQuery] = useState("");
  const [copiedCardId, setCopiedCardId] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Handle Escape key to exit maximized full preview
  useEffect(() => {
    if (!isMaximized) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMaximized(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMaximized]);

  const cards = data.cards || [];

  const filteredCards = useMemo(() => {
    if (!searchQuery.trim()) return cards;
    const q = searchQuery.toLowerCase().trim();
    return cards.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.badge && c.badge.toLowerCase().includes(q)) ||
        c.content.toLowerCase().includes(q)
    );
  }, [cards, searchQuery]);

  const handleCopyCard = (card: CheatSheetCard) => {
    const textToCopy = `### ${card.title}\n\n${card.content}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedCardId(card.id);
    toast.success(t("cheatsheetCopySuccess"));
    setTimeout(() => {
      setCopiedCardId(null);
    }, 2000);
  };

  const handleAskTutor = (card: CheatSheetCard) => {
    if (!onExplainInChat) return;
    const prompt = isIndo
      ? `Bantu jelaskan konsep/rumus dari kartu CheatSheet "${card.title}" berikut:\n\n${card.content}`
      : `Please explain the concept/formula from this CheatSheet card "${card.title}":\n\n${card.content}`;
    onExplainInChat(prompt);
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    toast.info(isIndo ? "Menyiapkan file PDF..." : "Preparing PDF document...");

    try {
      const htmlContent = buildCheatSheetPrintableHtml(data, isIndo);

      if ((window as any).electron?.cheatsheet?.exportPdf) {
        const res = await (window as any).electron.cheatsheet.exportPdf({
          title: data.title || "cheatsheet",
          htmlContent,
        });

        if (res?.success) {
          toast.success(
            isIndo
              ? `File PDF berhasil disimpan!`
              : `PDF saved successfully!`
          );
        } else if (!res?.canceled) {
          toast.error(res?.error || (isIndo ? "Gagal mengekspor PDF." : "Failed to export PDF."));
        }
      } else {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(htmlContent);
          printWindow.document.close();
          setTimeout(() => {
            printWindow.focus();
            printWindow.print();
          }, 500);
        } else {
          const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${(data.title || "cheatsheet").replace(/[^a-zA-Z0-9_-]/g, "_")}.html`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.info(isIndo ? "File lembar contekan siap dicetak/disimpan ke PDF." : "CheatSheet file downloaded.");
        }
      }
    } catch (err: any) {
      console.error("PDF export error:", err);
      toast.error(isIndo ? `Gagal mengekspor PDF: ${err.message}` : `Failed to export PDF: ${err.message}`);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const getBadgeStyle = (badge?: string) => {
    if (!badge) return "bg-sky-500/10 text-sky-400 border-sky-500/20";
    const b = badge.toUpperCase();
    if (b.includes("JEBAKAN") || b.includes("PITFALL") || b.includes("PERINGATAN") || b.includes("WARNING")) {
      return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    }
    if (b.includes("SINTAKS") || b.includes("KODE") || b.includes("SYNTAX") || b.includes("CLI")) {
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    }
    if (b.includes("TIPS") || b.includes("TRIK") || b.includes("MNEMONIK") || b.includes("SHORTCUT")) {
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    }
    if (b.includes("KOMPARASI") || b.includes("PERBANDINGAN") || b.includes("VS")) {
      return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    }
    return "bg-sky-500/10 text-sky-400 border-sky-500/20";
  };

  // Shared Card Renderer Component
  const renderCard = (card: CheatSheetCard, isMaximizedMode = false) => {
    const isCopied = copiedCardId === card.id;
    const isWide = card.span === "wide";

    return (
      <article
        key={card.id}
        className={cn(
          "break-inside-avoid mb-3.5 rounded-2xl border border-border/70 bg-[#202020] text-card-foreground p-3.5 sm:p-4 transition-all hover:border-border select-text flex flex-col justify-between shadow-2xs group print:bg-white print:border-gray-300 print:text-black print:shadow-none",
          isWide && (isMaximizedMode ? "md:column-span-2" : "sm:column-span-2")
        )}
      >
        <div>
          {/* Top Row: Badge & Action Controls */}
          <div className="flex items-center justify-between gap-2 mb-2 print:mb-1">
            {card.badge ? (
              <span
                className={cn(
                  "text-[9.5px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider print:border-gray-400 print:text-black",
                  getBadgeStyle(card.badge)
                )}
              >
                {card.badge}
              </span>
            ) : (
              <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">
                {isIndo ? "REFERENSI" : "REFERENCE"}
              </span>
            )}

            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity print:hidden">
              {/* Copy Card Button */}
              <button
                type="button"
                onClick={() => handleCopyCard(card)}
                className="h-6 w-6 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                title={isIndo ? "Salin isi kartu" : "Copy card text"}
              >
                {isCopied ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>

              {/* Ask Socrates Button */}
              {onExplainInChat && (
                <button
                  type="button"
                  onClick={() => handleAskTutor(card)}
                  className="h-6 w-6 rounded-md hover:bg-secondary text-muted-foreground hover:text-sky-400 flex items-center justify-center transition-colors cursor-pointer"
                  title={t("cheatsheetAskTutor")}
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Card Title */}
          <h2 className="text-xs sm:text-[13px] font-semibold text-foreground tracking-tight mb-2 leading-snug print:text-black print:font-bold">
            {card.title}
          </h2>

          {/* Card Body rendered with MarkdownContent */}
          <div className="text-[12px] leading-relaxed text-foreground/90 font-sans select-text [&_p]:text-foreground [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_li]:text-foreground [&_pre]:my-2 [&_.katex-display]:my-2 print:text-black">
            <MarkdownContent content={card.content} />
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="h-full flex flex-col bg-background text-foreground font-sans select-none overflow-hidden print:bg-white print:text-black">
      {/* Top Header Bar */}
      <div className="px-4 py-3 border-b border-border/50 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-card/60 backdrop-blur-xs print:hidden">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-semibold text-foreground tracking-tight truncate max-w-[280px] sm:max-w-md">
              {data.title}
            </h1>
            <div className="text-[10.5px] text-muted-foreground flex items-center gap-2 mt-0.5 truncate">
              <span>{filteredCards.length} {isIndo ? "kartu referensi" : "reference cards"}</span>
              {data.sourceCount ? (
                <>
                  <span>•</span>
                  <span>{data.sourceCount} {isIndo ? "sumber" : "sources"}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Live Search */}
          <div className="relative w-36 sm:w-44">
            <Search className="h-3 w-3 absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("cheatsheetSearchPlaceholder")}
              className="w-full h-8 pl-7 pr-2.5 rounded-lg bg-secondary/60 hover:bg-secondary text-[11px] text-foreground outline-none border border-border/70 focus:border-sky-500/50 transition-colors placeholder:text-muted-foreground/60"
            />
          </div>

          {/* Export to Note */}
          {onExportAsNote && (
            <button
              type="button"
              onClick={() => onExportAsNote(data)}
              className="h-8 px-2.5 rounded-lg bg-secondary/60 hover:bg-secondary border border-border/70 text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title={t("cheatsheetExportNote")}
            >
              <SquarePen className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">{t("cheatsheetExportNote")}</span>
            </button>
          )}

          {/* Download PDF (Replaces old Print button) */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="h-8 px-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
            title={isIndo ? "Unduh Lembar Contekan sebagai PDF" : "Download CheatSheet as PDF"}
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{isIndo ? "Unduh PDF" : "Download PDF"}</span>
          </button>

          {/* Fullscreen / Maximized Preview Button */}
          <button
            type="button"
            onClick={() => setIsMaximized(true)}
            className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer ml-0.5"
            title={isIndo ? "Pratinjau Penuh" : "Fullscreen Preview"}
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Content: CSS Multi-Column Masonry */}
      <ScrollArea className="flex-1 w-full min-h-0 print:overflow-visible">
        <div className="p-4 sm:p-5 print:p-0">
          {artifact?.status === "error" || (cards.length === 0 && !searchQuery.trim()) ? (
            <div className="py-16 text-center max-w-md mx-auto space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center mx-auto">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-foreground">
                  {isIndo ? "Gagal Menyusun Lembar Contekan" : "Failed to Create CheatSheet"}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {artifact?.error ||
                    (isIndo
                      ? "Server AI sedang tidak dapat dijangkau atau terjadi gangguan koneksi."
                      : "The AI server is unreachable or an error occurred during generation.")}
                </p>
              </div>
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground space-y-2">
              <Search className="h-8 w-8 mx-auto opacity-40 mb-2" />
              <p className="text-xs font-medium text-foreground">
                {isIndo ? "Tidak ada kartu yang cocok" : "No matching cards found"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {isIndo
                  ? `Tidak ada hasil untuk pencarian "${searchQuery}". Coba kata kunci lain.`
                  : `No results for "${searchQuery}". Try a different keyword.`}
              </p>
            </div>
          ) : (
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-3.5 [column-fill:_balance] print:columns-2 print:gap-4">
              {filteredCards.map((card) => renderCard(card, false))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Floating Centered Fullscreen Preview Modal (Matching Infographic / Report layout) */}
      {isMaximized &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center p-3 sm:p-5 md:p-7 select-none animate-in fade-in duration-150 font-sans"
            role="dialog"
            aria-modal="true"
            onClick={() => setIsMaximized(false)}
          >
            {/* Centered Floating Modal Card */}
            <div
              className="relative w-full max-w-[1280px] h-[90vh] max-h-[900px] bg-card border border-border rounded-3xl shadow-2xl flex flex-col overflow-hidden select-text animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Maximized Header */}
              <div className="h-14 px-5 border-b border-border flex items-center justify-between gap-3 shrink-0 bg-secondary/20">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-foreground tracking-tight truncate max-w-md">
                      {data.title}
                    </h2>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>{filteredCards.length} {isIndo ? "kartu referensi" : "reference cards"}</span>
                      {data.topic && (
                        <>
                          <span>•</span>
                          <span className="truncate">{data.topic}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative w-48 sm:w-60">
                    <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t("cheatsheetSearchPlaceholder")}
                      className="w-full h-8 pl-8 pr-3 rounded-lg bg-background text-xs text-foreground outline-none border border-border focus:border-sky-500/50 transition-colors placeholder:text-muted-foreground/60"
                    />
                  </div>

                  {onExportAsNote && (
                    <button
                      type="button"
                      onClick={() => onExportAsNote(data)}
                      className="h-8 px-2.5 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                      title={t("cheatsheetExportNote")}
                    >
                      <SquarePen className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="hidden sm:inline">{t("cheatsheetExportNote")}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={isDownloadingPdf}
                    className="h-8 px-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                    title={isIndo ? "Unduh PDF" : "Download PDF"}
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>{isIndo ? "Unduh PDF" : "Download PDF"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsMaximized(false)}
                    className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer ml-1"
                    title={isIndo ? "Kecilkan (Kembali ke panel)" : "Restore"}
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsMaximized(false)}
                    className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                    title="Close (Esc)"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Maximized Modal Body: Expansive 3 to 4 Column Masonry */}
              <ScrollArea className="flex-1 w-full min-h-0 bg-background/50">
                <div className="p-6">
                  {filteredCards.length === 0 ? (
                    <div className="py-20 text-center text-muted-foreground space-y-2">
                      <Search className="h-10 w-10 mx-auto opacity-40 mb-2" />
                      <p className="text-sm font-medium text-foreground">
                        {isIndo ? "Tidak ada kartu yang cocok" : "No matching cards found"}
                      </p>
                    </div>
                  ) : (
                    <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 [column-fill:_balance]">
                      {filteredCards.map((card) => renderCard(card, true))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
