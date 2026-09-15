import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  toast,
} from "@const/ui";
import {
  X,
  Search,
  Globe,
  Upload,
  BookOpen,
  Clipboard,
  ClipboardPaste,
  ChevronDown,
  Link2,
  Video,
  ArrowLeft,
  Loader2,
  Plus,
  Check,
  FileText,
  AlertCircle,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { localDb } from "../../lib/db";
import { searchWebSources, type SearchSourceResult } from "../../lib/sources/search-service";
import { fetchWebContent } from "../../lib/sources/web-fetcher";
import { fetchYouTubeTranscript, isYouTubeUrl } from "../../lib/sources/youtube-service";
import { parseUploadedFile } from "../../lib/sources/document-parser";
import { YouTubeSvgIcon } from "./source-icon";

interface AddSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  learnId?: string;
  onSelectSource?: (sourceType: string) => void;
  onSourceAdded?: (sourceId: string) => void;
}

type ModalMode = "main" | "url" | "youtube" | "paste";

export function AddSourceDialog({
  open,
  onOpenChange,
  learnId,
  onSelectSource,
  onSourceAdded,
}: AddSourceDialogProps) {
  const { t } = useI18n();

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [webScope, setWebScope] = useState<"web" | "journal">("web");
  const [researchSpeed, setResearchSpeed] = useState<"fast" | "deep">("fast");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchSourceResult[]>([]);
  const [addedUrls, setAddedUrls] = useState<Set<string>>(new Set());

  // Ingestion Sub-views
  const [mode, setMode] = useState<ModalMode>("main");
  const [urlInput, setUrlInput] = useState("");
  const [crawlDocs, setCrawlDocs] = useState(false);
  const [maxPages, setMaxPages] = useState(10);
  const [youtubeInput, setYoutubeInput] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteContent, setPasteContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const resetState = () => {
    setMode("main");
    setSearchQuery("");
    setSearchResults([]);
    setUrlInput("");
    setCrawlDocs(false);
    setYoutubeInput("");
    setPasteTitle("");
    setPasteContent("");
    setIsLoading(false);
    setStatusMessage("");
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  // 1. Search Web Sources via Const Router (Exa AI)
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await searchWebSources(searchQuery, {
        mode: researchSpeed,
        category: webScope,
        numResults: researchSpeed === "deep" ? 10 : 5,
      });
      setSearchResults(results);
      if (results.length === 0) {
        toast.info("No results found for your query.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to search web sources.");
    } finally {
      setIsSearching(false);
    }
  };

  // 2. Add Search Result to Sources
  const handleAddSearchResult = async (item: SearchSourceResult) => {
    if (!learnId) return;
    try {
      const sourceId = await localDb.createSource({
        learnId,
        title: item.title,
        type: "url",
        url: item.url,
        content: item.content || item.snippet,
        size: new Blob([item.content || item.snippet]).size,
        includedInChat: true,
      });
      setAddedUrls((prev) => new Set(prev).add(item.url));
      onSourceAdded?.(sourceId);
      toast.success(`Added source: ${item.title.slice(0, 35)}...`);
    } catch (err: any) {
      toast.error(err.message || "Failed to add source.");
    }
  };

  // 3. Ingest Web URL / Documentation Suite
  const handleIngestUrl = async () => {
    if (!learnId || !urlInput.trim()) return;
    setIsLoading(true);
    setStatusMessage(
      crawlDocs
        ? "Crawling documentation pages & extracting clean markdown..."
        : "Fetching and cleaning webpage content..."
    );

    try {
      const result = await fetchWebContent(urlInput, {
        crawlSubpages: crawlDocs,
        maxPages,
      });

      const sourceId = await localDb.createSource({
        learnId,
        title: result.title,
        type: crawlDocs ? "docs" : "url",
        url: result.url,
        content: result.content,
        size: new Blob([result.content]).size,
        subpagesCount: result.subpagesCount,
        includedInChat: true,
      });

      onSourceAdded?.(sourceId);
      toast.success(
        crawlDocs
          ? `Successfully crawled ${result.subpagesCount} documentation sections!`
          : "Web source successfully added!"
      );
      handleClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch web content.");
    } finally {
      setIsLoading(false);
      setStatusMessage("");
    }
  };

  // 4. Ingest YouTube Transcript
  const handleIngestYouTube = async () => {
    if (!learnId || !youtubeInput.trim()) return;
    setIsLoading(true);
    setStatusMessage("Extracting YouTube time-coded transcript...");

    try {
      const result = await fetchYouTubeTranscript(youtubeInput);
      const sourceId = await localDb.createSource({
        learnId,
        title: result.title,
        type: "youtube",
        url: result.url,
        content: result.transcript,
        size: new Blob([result.transcript]).size,
        includedInChat: true,
      });

      onSourceAdded?.(sourceId);
      toast.success(`Extracted ${result.lineCount} caption lines from YouTube!`);
      handleClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to extract YouTube transcript.");
    } finally {
      setIsLoading(false);
      setStatusMessage("");
    }
  };

  // 5. Ingest Uploaded Files (PDF, DOCX, TXT, MD)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!learnId || !files || files.length === 0) return;

    setIsLoading(true);
    setStatusMessage("Parsing document text (PDF/Word/Text)...");

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        const parsed = await parseUploadedFile(file);

        const sourceId = await localDb.createSource({
          learnId,
          title: parsed.title,
          type: "file",
          content: parsed.content,
          size: parsed.size,
          includedInChat: true,
        });
        onSourceAdded?.(sourceId);
      }
      toast.success(`Successfully parsed ${files.length} document(s)!`);
      handleClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to parse uploaded document.");
    } finally {
      setIsLoading(false);
      setStatusMessage("");
      if (e.target) e.target.value = "";
    }
  };

  // 6. Ingest Copied Text
  const handleIngestPaste = async () => {
    if (!learnId || !pasteContent.trim()) return;
    try {
      const title = pasteTitle.trim() || `Pasted text (${new Date().toLocaleTimeString()})`;
      const sourceId = await localDb.createSource({
        learnId,
        title,
        type: "text",
        content: pasteContent.trim(),
        size: new Blob([pasteContent]).size,
        includedInChat: true,
      });

      onSourceAdded?.(sourceId);
      toast.success("Text source added!");
      handleClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save text.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[94vw] max-w-[620px] p-0 overflow-hidden rounded-3xl border border-border bg-card text-card-foreground [&>button]:hidden">
        <DialogTitle className="sr-only">{t("addSource")}</DialogTitle>

        <div className="relative p-5 sm:p-7 flex flex-col items-center text-center max-h-[85vh] overflow-y-auto">
          {/* Close button */}
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            aria-label={t("close")}
          >
            <X className="h-4 w-4" />
          </button>

          {/* Subview Back Header */}
          {mode !== "main" && (
            <div className="w-full flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => setMode("main")}
                className="h-8 w-8 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                title="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-foreground capitalize">
                {mode === "url" && "Web URL & Documentation Suite"}
                {mode === "youtube" && "YouTube Video Transcript"}
                {mode === "paste" && "Paste Custom Text"}
              </span>
            </div>
          )}

          {/* Title on Main View */}
          {mode === "main" && (
            <div className="mt-2 mb-5 max-w-[340px]">
              <h2 className="text-lg sm:text-xl font-medium tracking-tight text-foreground leading-snug">
                {t("addSourceDialogTitle")}{" "}
                <span className="text-[#34d399] font-medium">{t("addSourceDialogHighlight")}</span>
              </h2>
            </div>
          )}

          {/* VIEW: MAIN (Exa Search + Options) */}
          {mode === "main" && (
            <>
              {/* Search Box with Exa AI backend */}
              <div className="w-full bg-secondary/70 rounded-2xl p-3 border border-border/60 focus-within:border-foreground/30 transition-all text-left mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch();
                  }}
                  placeholder={t("searchWebSources") || "Search web, papers, or documentation via Exa AI..."}
                  className="w-full bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/60 outline-none px-1 py-1"
                />
                <div className="flex items-center justify-between mt-2.5 pt-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setWebScope(webScope === "web" ? "journal" : "web")}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-background/80 hover:bg-background border border-border/50 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      <Globe className="h-3 w-3 text-muted-foreground" />
                      <span>{webScope === "web" ? t("webScopeWeb") || "Web" : t("webScopeJournal") || "Journal"}</span>
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setResearchSpeed(researchSpeed === "fast" ? "deep" : "fast")}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-background/80 hover:bg-background border border-border/50 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      <Search className="h-3 w-3 text-muted-foreground" />
                      <span>{researchSpeed === "fast" ? t("speedFast") || "Fast Search" : t("speedDeep") || "Deep Research"}</span>
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSearch}
                    disabled={isSearching || !searchQuery.trim()}
                    className="h-7 px-3 rounded-full bg-primary text-primary-foreground flex items-center justify-center gap-1 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                    <span>{t("search") || "Search"}</span>
                  </button>
                </div>
              </div>

              {/* Live Search Results View */}
              {searchResults.length > 0 && (
                <div className="w-full mb-4 text-left max-h-[200px] overflow-y-auto space-y-2 pr-1">
                  <p className="text-[11px] font-medium text-muted-foreground px-1 mb-1">
                    Found {searchResults.length} verified web sources:
                  </p>
                  {searchResults.map((res, i) => {
                    const isAdded = addedUrls.has(res.url);
                    return (
                      <div
                        key={i}
                        className="p-2.5 rounded-xl border border-border/50 bg-secondary/40 hover:bg-secondary/70 transition-all flex items-center justify-between gap-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground truncate">{res.title}</p>
                          <p className="text-[10.5px] text-muted-foreground/80 line-clamp-2 mt-0.5">{res.snippet}</p>
                          <p className="text-[10px] text-primary/70 font-mono mt-1 truncate">{res.url}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddSearchResult(res)}
                          disabled={isAdded}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1 shrink-0 transition-colors ${
                            isAdded
                              ? "bg-muted text-muted-foreground cursor-default"
                              : "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                          }`}
                        >
                          {isAdded ? (
                            <>
                              <Check className="h-3 w-3" />
                              <span>Added</span>
                            </>
                          ) : (
                            <>
                              <Plus className="h-3 w-3" />
                              <span>Add</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Quick Actions Dropzone */}
              <div className="w-full border border-dashed border-border/80 rounded-2xl p-5 sm:p-6 bg-secondary/30 flex flex-col items-center justify-center">
                <p className="text-xs sm:text-sm font-medium text-foreground">{t("orDropFiles") || "Or choose a source format"}</p>
                <p className="text-[11px] text-muted-foreground mt-1 mb-4">
                  Supported: PDF, DOCX, TXT, Markdown, Web Docs, YouTube
                </p>

                {/* 4 Rich Source Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/80 hover:bg-secondary border border-border/40 text-xs font-normal text-foreground transition-colors cursor-pointer active:scale-95">
                    <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Upload File</span>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.docx,.txt,.md,.markdown,.json,.csv,.py,.ts,.js"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => setMode("url")}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/80 hover:bg-secondary border border-border/40 text-xs font-normal text-foreground transition-colors cursor-pointer active:scale-95"
                  >
                    <Link2 className="h-3.5 w-3.5 text-blue-400" />
                    <span>Web & Docs</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("youtube")}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/80 hover:bg-secondary border border-border/40 text-xs font-normal text-foreground transition-colors cursor-pointer active:scale-95"
                  >
                    <YouTubeSvgIcon className="h-3.5 w-3.5" />
                    <span>YouTube</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("paste")}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/80 hover:bg-secondary border border-border/40 text-xs font-normal text-foreground transition-colors cursor-pointer active:scale-95"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5 text-purple-400" />
                    <span>Paste Text</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* VIEW: WEB URL & DOCS CRAWL */}
          {mode === "url" && (
            <div className="w-full text-left space-y-3.5">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Web Page or Documentation URL
                </label>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://docs.example.com/quickstart"
                  className="w-full bg-secondary/60 rounded-xl px-3 py-2 text-xs sm:text-sm border border-border/60 outline-none focus:border-primary transition-all text-foreground"
                />
              </div>

              {/* Recursive Docs Crawling Toggle */}
              <div className="p-3 rounded-2xl bg-secondary/40 border border-border/50 flex flex-col gap-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={crawlDocs}
                    onChange={(e) => setCrawlDocs(e.target.checked)}
                    className="mt-0.5 rounded border-border text-primary focus:ring-0"
                  />
                  <div>
                    <span className="text-xs font-semibold text-foreground block">
                      Crawl Full Documentation Suite (/quickstart, etc.)
                    </span>
                    <span className="text-[10.5px] text-muted-foreground leading-relaxed block mt-0.5">
                      Extracts sub-pages under this documentation path into a structured source.
                    </span>
                  </div>
                </label>

                {crawlDocs && (
                  <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs text-muted-foreground mt-1">
                    <span>Max Pages:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={3}
                        max={25}
                        value={maxPages}
                        onChange={(e) => setMaxPages(parseInt(e.target.value, 10))}
                        className="w-24 accent-primary"
                      />
                      <span className="font-mono text-xs font-semibold text-foreground">{maxPages}</span>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleIngestUrl}
                disabled={isLoading || !urlInput.trim()}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                <span>{crawlDocs ? "Crawl Documentation" : "Fetch Web Content"}</span>
              </button>
            </div>
          )}

          {/* VIEW: YOUTUBE VIDEO */}
          {mode === "youtube" && (
            <div className="w-full text-left space-y-3.5">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  YouTube Video Link
                </label>
                <input
                  type="url"
                  value={youtubeInput}
                  onChange={(e) => setYoutubeInput(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full bg-secondary/60 rounded-xl px-3 py-2 text-xs sm:text-sm border border-border/60 outline-none focus:border-primary transition-all text-foreground"
                />
                <p className="text-[10.5px] text-muted-foreground mt-1">
                  Extracts complete time-coded captions for video learning.
                </p>
              </div>

              <button
                type="button"
                onClick={handleIngestYouTube}
                disabled={isLoading || !youtubeInput.trim()}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <YouTubeSvgIcon className="h-4 w-4" />}
                <span>Extract Transcript</span>
              </button>
            </div>
          )}

          {/* VIEW: PASTE TEXT */}
          {mode === "paste" && (
            <div className="w-full text-left space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Source Title (Optional)
                </label>
                <input
                  type="text"
                  value={pasteTitle}
                  onChange={(e) => setPasteTitle(e.target.value)}
                  placeholder="e.g. Lecture Notes"
                  className="w-full bg-secondary/60 rounded-xl px-3 py-2 text-xs border border-border/60 outline-none focus:border-primary transition-all text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Content
                </label>
                <textarea
                  rows={5}
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  placeholder="Paste text or syllabus here..."
                  className="w-full bg-secondary/60 rounded-xl p-3 text-xs border border-border/60 outline-none focus:border-primary transition-all text-foreground resize-none"
                />
              </div>

              <button
                type="button"
                onClick={handleIngestPaste}
                disabled={!pasteContent.trim()}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <ClipboardPaste className="h-4 w-4" />
                <span>Add Text Source</span>
              </button>
            </div>
          )}

          {/* Loading Overlay */}
          {isLoading && (
            <div className="mt-4 p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-2.5 text-xs text-primary w-full">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>{statusMessage || "Processing source..."}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
