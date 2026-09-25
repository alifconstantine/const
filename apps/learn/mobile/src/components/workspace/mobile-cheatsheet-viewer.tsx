import React, { useState, useMemo } from "react";
import {
  X,
  FileSpreadsheet,
  Search,
  Copy,
  Check,
  Sparkles,
  Download,
  AlertCircle,
} from "lucide-react";
import { cn, toast } from "@const/ui";
import { marked } from "marked";
import { useI18n } from "../../lib/i18n";
import { MarkdownContent } from "./markdown-content";
import type { CheatSheetData, CheatSheetCard, LocalArtifact } from "../../lib/db";

export interface MobileCheatSheetViewerProps {
  artifact?: LocalArtifact;
  data: CheatSheetData;
  onClose: () => void;
  onExplainInChat?: (prompt: string) => void;
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

export function MobileCheatSheetViewer({
  artifact,
  data,
  onClose,
  onExplainInChat,
}: MobileCheatSheetViewerProps) {
  const { t, language } = useI18n();
  const isIndo = language === "id";

  const [searchQuery, setSearchQuery] = useState("");
  const [copiedCardId, setCopiedCardId] = useState<string | null>(null);

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
    onClose();
    onExplainInChat(prompt);
  };

  const handleDownloadPdf = () => {
    try {
      const htmlContent = buildCheatSheetPrintableHtml(data, isIndo);
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
    } catch (err: any) {
      console.error("PDF export error:", err);
      toast.error(isIndo ? `Gagal mengekspor PDF: ${err.message}` : `Failed to export PDF: ${err.message}`);
    }
  };

  const getBadgeStyle = (badge?: string) => {
    if (!badge) return "bg-sky-500/10 text-sky-400 border-sky-500/20";
    const b = badge.toUpperCase();
    if (
      b.includes("JEBAKAN") ||
      b.includes("PITFALL") ||
      b.includes("PERINGATAN") ||
      b.includes("WARNING")
    ) {
      return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    }
    if (
      b.includes("SINTAKS") ||
      b.includes("KODE") ||
      b.includes("SYNTAX") ||
      b.includes("CLI")
    ) {
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    }
    if (
      b.includes("TIPS") ||
      b.includes("TRIK") ||
      b.includes("MNEMONIK") ||
      b.includes("SHORTCUT")
    ) {
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    }
    if (b.includes("KOMPARASI") || b.includes("PERBANDINGAN") || b.includes("VS")) {
      return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    }
    return "bg-sky-500/10 text-sky-400 border-sky-500/20";
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-background text-foreground flex flex-col font-sans select-none animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      {/* Top Header */}
      <header className="h-14 px-3 border-b border-border bg-card flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
          <div className="h-8 w-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
            <FileSpreadsheet className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xs font-semibold text-foreground truncate">
              {data.title || artifact?.title || "CheatSheet"}
            </h1>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
              <span>{t("toolsCheatSheet")}</span>
              <span>•</span>
              <span>
                {filteredCards.length}{" "}
                {isIndo ? "kartu referensi" : "reference cards"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="h-8 px-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer shadow-xs"
            title={isIndo ? "Unduh PDF" : "Download PDF"}
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{isIndo ? "Unduh PDF" : "PDF"}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer active:scale-95 shrink-0"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="px-3.5 py-2.5 bg-card/50 border-b border-border/40 shrink-0">
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("cheatsheetSearchPlaceholder")}
            className="w-full h-9 pl-8 pr-3 rounded-xl bg-secondary/60 text-xs text-foreground outline-none border border-border focus:border-sky-500/50 transition-colors placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      {/* Cards Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {artifact?.status === "error" || (cards.length === 0 && !searchQuery.trim()) ? (
          <div className="py-12 px-4 text-center max-w-sm mx-auto space-y-3.5">
            <div className="h-12 w-12 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center mx-auto">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                {isIndo ? "Gagal Menyusun Lembar Contekan" : "Failed to Create CheatSheet"}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {artifact?.error ||
                  (isIndo
                    ? "Server AI sedang tidak dapat dijangkau (502 Bad Gateway) atau response tidak valid."
                    : "The AI server is unreachable (502 Bad Gateway) or returned invalid output.")}
              </p>
            </div>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-xs space-y-1">
            <p>{t("cheatsheetEmptyCards")}</p>
          </div>
        ) : (
          filteredCards.map((card) => {
            const isCopied = copiedCardId === card.id;
            return (
              <div
                key={card.id}
                className="rounded-2xl bg-card border border-border/70 p-4 transition-all duration-150 relative group"
              >
                {/* Header: Title + Badge */}
                <div className="flex items-start justify-between gap-2.5 mb-2.5">
                  <h3 className="text-xs font-semibold text-foreground tracking-tight leading-snug">
                    {card.title}
                  </h3>
                  {card.badge && (
                    <span
                      className={cn(
                        "text-[9.5px] uppercase font-sans tracking-wider px-2 py-0.5 rounded-full border shrink-0 font-medium",
                        getBadgeStyle(card.badge)
                      )}
                    >
                      {card.badge}
                    </span>
                  )}
                </div>

                {/* Body Content with KaTeX & Code */}
                <div className="text-xs text-foreground/90 leading-relaxed overflow-x-auto touch-pan-x">
                  <MarkdownContent content={card.content} />
                </div>

                {/* Footer Action Strip */}
                <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground/60 font-sans tabular-nums">
                    #{card.id}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCopyCard(card)}
                      className="px-2.5 py-1 rounded-lg bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer active:scale-95"
                      title={t("cheatsheetCopySuccess")}
                    >
                      {isCopied ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      <span>
                        {isCopied
                          ? isIndo
                            ? "Tersalin"
                            : "Copied"
                          : isIndo
                          ? "Salin"
                          : "Copy"}
                      </span>
                    </button>

                    {onExplainInChat && (
                      <button
                        type="button"
                        onClick={() => handleAskTutor(card)}
                        className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer active:scale-95"
                        title={t("cheatsheetAskTutor")}
                      >
                        <Sparkles className="h-3 w-3 text-sky-400" />
                        <span>{t("cheatsheetAskTutor")}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
