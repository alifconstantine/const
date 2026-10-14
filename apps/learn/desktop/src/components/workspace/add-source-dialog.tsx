import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  cn,
  toast,
  Checkbox,
} from "@const/ui";
import {
  X,
  Search,
  Globe,
  Upload,
  BookOpen,
  ClipboardPaste,
  ChevronDown,
  Link2,
  ArrowLeft,
  Loader2,
  Plus,
  Check,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useI18n } from "../../lib/i18n";
import { localDb, db } from "../../lib/db";
import { searchWebSources, type SearchSourceResult } from "../../lib/sources/search-service";
import { fetchWebContent } from "../../lib/sources/web-fetcher";
import { fetchYouTubeTranscript } from "../../lib/sources/youtube-service";
import { parseUploadedFile } from "../../lib/sources/document-parser";
import { YouTubeSvgIcon } from "./source-icon";

const MAX_SOURCES = 100;

export interface InitialSearchConfig {
  query: string;
  scope?: "web" | "journal";
  speed?: "fast" | "deep";
  autoSearch?: boolean;
}

interface AddSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  learnId?: string;
  initialSearch?: InitialSearchConfig;
  onSelectSource?: (sourceType: string) => void;
  onSourceAdded?: (sourceId: string) => void;
}

type ModalMode = "main" | "url" | "youtube" | "paste";

export function AddSourceDialog({
  open,
  onOpenChange,
  learnId,
  initialSearch,
  onSelectSource,
  onSourceAdded,
}: AddSourceDialogProps) {
  const { t } = useI18n();

  // Source count & limit from Dexie live query
  const currentSourcesCount = useLiveQuery(
    () => (learnId ? db.sources.where("learnId").equals(learnId).count() : 0),
    [learnId]
  ) ?? 0;
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [webScope, setWebScope] = useState<"web" | "journal">("web");
  const [researchSpeed, setResearchSpeed] = useState<"fast" | "deep">("fast");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchSourceResult[]>([]);
  const [addedUrls, setAddedUrls] = useState<Set<string>>(new Set());

  // Handle external search query passed from sidebar/parent
  useEffect(() => {
    if (open && initialSearch?.query) {
      setSearchQuery(initialSearch.query);
      if (initialSearch.scope) setWebScope(initialSearch.scope);
      if (initialSearch.speed) setResearchSpeed(initialSearch.speed);

      const targetQuery = initialSearch.query.trim();
      const targetScope = initialSearch.scope || "web";
      const targetSpeed = initialSearch.speed || "fast";

      if (targetQuery) {
        setIsSearching(true);
        searchWebSources(targetQuery, {
          mode: targetSpeed,
          category: targetScope,
          numResults: targetSpeed === "deep" ? 10 : 5,
        })
          .then((results) => {
            setSearchResults(results);
            if (results.length === 0) {
              toast.info("No results found for your query.");
            }
          })
          .catch((err: any) => {
            toast.error(err.message || t("failedSearchWebSources"));
          })
          .finally(() => {
            setIsSearching(false);
          });
      }
    }
  }, [open, initialSearch]);

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
    setIsDraggingOver(false);
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
      toast.error(err.message || t("failedSearchWebSources"));
    } finally {
      setIsSearching(false);
    }
  };

  // 2. Add Search Result to Sources
  const handleAddSearchResult = async (item: SearchSourceResult) => {
    if (!learnId) return;
    if (currentSourcesCount >= MAX_SOURCES) {
      toast.error(t("maxSourcesReached", { count: MAX_SOURCES }));
      return;
    }
    try {
      const content =
        typeof item.content === "string"
          ? item.content
          : typeof item.snippet === "string"
          ? item.snippet
          : "";
      const sourceId = await localDb.createSource({
        learnId,
        title: item.title,
        type: "url",
        url: item.url,
        content,
        size: new Blob([content]).size,
        includedInChat: true,
      });
      setAddedUrls((prev) => new Set(prev).add(item.url));
      onSourceAdded?.(sourceId);
      toast.success(`Added source: ${item.title.slice(0, 35)}...`);
    } catch (err: any) {
      toast.error(err.message || t("failedAddSource"));
    }
  };

  // 3. Ingest Web URL / Documentation Suite
  const handleIngestUrl = async () => {
    if (!learnId || !urlInput.trim()) return;
    if (currentSourcesCount >= MAX_SOURCES) {
      toast.error(t("maxSourcesReached", { count: MAX_SOURCES }));
      return;
    }
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
      toast.error(err.message || t("failedFetchWebContent"));
    } finally {
      setIsLoading(false);
      setStatusMessage("");
    }
  };

  // 4. Ingest YouTube Transcript
  const handleIngestYouTube = async () => {
    if (!learnId || !youtubeInput.trim()) return;
    if (currentSourcesCount >= MAX_SOURCES) {
      toast.error(t("maxSourcesReached", { count: MAX_SOURCES }));
      return;
    }
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
      toast.error(err.message || t("failedExtractYouTube"));
    } finally {
      setIsLoading(false);
      setStatusMessage("");
    }
  };

  // 5. Ingest Uploaded Files (PDF, PPTX, DOCX, TXT, MD)
  const processFiles = async (files: FileList | File[]) => {
    if (!learnId || !files || files.length === 0) return;

    const remainingSlots = MAX_SOURCES - currentSourcesCount;
    if (remainingSlots <= 0) {
      toast.error(t("maxSourcesReachedFiles", { count: MAX_SOURCES }));
      return;
    }

    const filesArray = Array.from(files);
    const filesToUpload = filesArray.slice(0, remainingSlots);
    if (filesArray.length > remainingSlots) {
      toast.warning(`Hanya ${remainingSlots} dari ${filesArray.length} berkas yang diproses karena batas limit ${MAX_SOURCES} sumber.`);
    }

    setIsLoading(true);
    setStatusMessage("Parsing document text (PDF/PPTX/Word/Text)...");

    try {
      let addedCount = 0;
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i]!;
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
        addedCount++;
      }
      toast.success(`Successfully parsed ${addedCount} document(s)!`);
      handleClose();
    } catch (err: any) {
      toast.error(err.message || t("failedParseDocument"));
    } finally {
      setIsLoading(false);
      setStatusMessage("");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
    if (e.target) e.target.value = "";
  };

  // 6. Ingest Copied Text
  const handleIngestPaste = async () => {
    if (!learnId || !pasteContent.trim()) return;
    if (currentSourcesCount >= MAX_SOURCES) {
      toast.error(t("maxSourcesReachedText", { count: MAX_SOURCES }));
      return;
    }
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
      toast.error(err.message || t("failedSaveText"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[94vw] max-w-[620px] p-0 overflow-hidden rounded-3xl border border-border bg-card text-card-foreground [&>button]:hidden">
        <DialogTitle className="sr-only">{t("addSource")}</DialogTitle>

        <div className="relative p-6 sm:p-8 flex flex-col items-center text-center max-h-[85vh] overflow-y-auto">
          {/* Close button */}
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-5 right-5 h-8 w-8 rounded-full bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
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
            <div className="mt-1 mb-5 max-w-full px-2">
              <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground leading-snug">
                {t("addSourceDialogTitle")}{" "}
                <span className="text-blue-500 font-semibold">{t("addSourceDialogHighlight")}</span>
              </h2>
            </div>
          )}

          {/* VIEW: MAIN (Const Search + Options) */}
          {mode === "main" && (
            <>
              {/* Search Box with Const Search backend */}
              <div className="w-full bg-secondary/50 rounded-2xl p-3 sm:p-3.5 border border-border/60 focus-within:border-foreground/30 transition-all text-left mb-3.5 shadow-2xs">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch();
                  }}
                  placeholder={t("searchWebSources") || "Search web, papers, or documentation via Const Search..."}
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none px-1.5 py-1"
                />
                <div className="flex items-center justify-between mt-3 px-0.5">
                  <div className="flex items-center gap-2">
                    {/* Web Scope Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/80 hover:bg-background border border-border/50 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer shadow-2xs"
                        >
                          {webScope === "journal" ? (
                            <BookOpen className="h-3 w-3 text-amber-400" />
                          ) : (
                            <Globe className="h-3 w-3 text-blue-400" />
                          )}
                          <span>
                            {webScope === "web"
                              ? t("webScopeWeb") || "Web"
                              : t("webScopeJournal") || "Journal"}
                          </span>
                          <ChevronDown className="h-3 w-3 opacity-60" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56 p-1.5 text-xs shadow-lg">
                        <DropdownMenuItem
                          onClick={() => setWebScope("web")}
                          className="flex items-center justify-between text-xs cursor-pointer py-2 px-2.5 rounded-lg"
                        >
                          <div className="flex items-start gap-2">
                            <Globe className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
                            <div>
                              <p className="font-medium text-foreground">{t("webScopeWeb") || "Web Search"}</p>
                              <p className="text-[10.5px] text-muted-foreground">Telusuri web & artikel terbuka</p>
                            </div>
                          </div>
                          {webScope === "web" && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setWebScope("journal")}
                          className="flex items-center justify-between text-xs cursor-pointer py-2 px-2.5 rounded-lg"
                        >
                          <div className="flex items-start gap-2">
                            <BookOpen className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                            <div>
                              <p className="font-medium text-foreground">{t("webScopeJournal") || "Jurnal Akademik"}</p>
                              <p className="text-[10.5px] text-muted-foreground">Paper riset & jurnal ilmiah (Const Search)</p>
                            </div>
                          </div>
                          {webScope === "journal" && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Research Speed / Mode Dropdown (NO ICON on trigger button) */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/80 hover:bg-background border border-border/50 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer shadow-2xs"
                        >
                          <span>
                            {researchSpeed === "fast"
                              ? t("speedFast") || "Fast Research"
                              : t("speedDeep") || "Deep Research"}
                          </span>
                          <ChevronDown className="h-3 w-3 opacity-60" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56 p-1.5 text-xs shadow-lg">
                        <DropdownMenuItem
                          onClick={() => setResearchSpeed("fast")}
                          className="flex items-center justify-between text-xs cursor-pointer py-2 px-2.5 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-foreground">{t("speedFast") || "Fast Research"}</p>
                            <p className="text-[10.5px] text-muted-foreground">Pencarian cepat, 5 sumber instan</p>
                          </div>
                          {researchSpeed === "fast" && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setResearchSpeed("deep")}
                          className="flex items-center justify-between text-xs cursor-pointer py-2 px-2.5 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-foreground">{t("speedDeep") || "Deep Research"}</p>
                            <p className="text-[10.5px] text-muted-foreground">Riset mendalam & crawling teks, 10 sumber</p>
                          </div>
                          {researchSpeed === "deep" && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Circular Search Button */}
                  <button
                    type="button"
                    onClick={handleSearch}
                    disabled={isSearching || !searchQuery.trim()}
                    aria-label={t("search") || "Search"}
                    className="h-8 w-8 rounded-full bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    {isSearching ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Search className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Live Search Results View */}
              {searchResults.length > 0 && (
                <div className="w-full mb-3.5 text-left max-h-[200px] overflow-y-auto space-y-2 pr-1">
                  <p className="text-xs font-medium text-muted-foreground px-1 mb-1">
                    Found {searchResults.length} verified web sources:
                  </p>
                  {searchResults.map((res, i) => {
                    const isAdded = addedUrls.has(res.url);
                    const isCapped = currentSourcesCount >= MAX_SOURCES;
                    return (
                      <div
                        key={i}
                        className="p-2.5 rounded-xl border border-border/50 bg-secondary/40 hover:bg-secondary/70 transition-all flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground truncate">{res.title}</p>
                          <p className="text-[11px] text-muted-foreground/80 line-clamp-2 mt-0.5">{res.snippet}</p>
                          <p className="text-[10px] text-primary/70 font-sans mt-1 truncate">{res.url}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddSearchResult(res)}
                          disabled={isAdded || isCapped}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 shrink-0 transition-colors ${
                            isAdded
                              ? "bg-muted text-muted-foreground cursor-default"
                              : isCapped
                              ? "bg-muted text-muted-foreground/50 cursor-not-allowed"
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

              {/* Horizontal Pill Action Buttons Row */}
              <div className="flex items-center gap-2 w-full overflow-x-auto pb-1 mb-3.5 scrollbar-none justify-start sm:justify-center">
                {/* 1. File Upload Pill */}
                <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-secondary/70 hover:bg-secondary border border-border/50 text-xs font-normal text-foreground transition-all cursor-pointer shrink-0 active:scale-95 shadow-2xs">
                  <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{t("uploadFile") || "Upload file"}</span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.pptx,.docx,.txt,.md,.markdown,.json,.csv,.py,.ts,.js"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                {/* 2. Web & Docs / Situs Pill */}
                <button
                  type="button"
                  onClick={() => setMode("url")}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-secondary/70 hover:bg-secondary border border-border/50 text-xs font-normal text-foreground transition-all cursor-pointer shrink-0 active:scale-95 shadow-2xs"
                >
                  <Link2 className="h-3.5 w-3.5 text-blue-400" />
                  <span>{t("website") || "Situs"}</span>
                </button>

                {/* 3. YouTube Pill */}
                <button
                  type="button"
                  onClick={() => setMode("youtube")}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-secondary/70 hover:bg-secondary border border-border/50 text-xs font-normal text-foreground transition-all cursor-pointer shrink-0 active:scale-95 shadow-2xs"
                >
                  <YouTubeSvgIcon className="h-3.5 w-3.5" />
                  <span>YouTube</span>
                </button>

                {/* 4. Copied Text Pill */}
                <button
                  type="button"
                  onClick={() => setMode("paste")}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-secondary/70 hover:bg-secondary border border-border/50 text-xs font-normal text-foreground transition-all cursor-pointer shrink-0 active:scale-95 shadow-2xs"
                >
                  <ClipboardPaste className="h-3.5 w-3.5 text-purple-400" />
                  <span>{t("copiedText") || "Teks yang disalin"}</span>
                </button>
              </div>

              {/* Dashed Drag & Drop File Zone */}
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingOver(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingOver(false);
                  if (e.dataTransfer.files) {
                    processFiles(e.dataTransfer.files);
                  }
                }}
                className={cn(
                  "w-full border border-dashed rounded-2xl py-7 px-5 flex flex-col items-center justify-center text-center cursor-pointer mb-3.5 group transition-all",
                  isDraggingOver
                    ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                    : "border-border/70 bg-secondary/15 hover:bg-secondary/30"
                )}
              >
                <Upload className="h-6 w-6 text-muted-foreground group-hover:text-foreground transition-colors mb-2 stroke-[1.75]" />
                <p className="text-xs text-muted-foreground max-w-[380px] leading-relaxed select-none">
                  {t("dropFilesHere") || "Tarik lalu lepas file untuk menguploadnya."}{" "}
                  {t("supportedFormats") || "Jenis file yang didukung: pdf, gambar, dokumen, audio, dan banyak lagi."}
                </p>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.pptx,.docx,.txt,.md,.markdown,.json,.csv,.py,.ts,.js"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {/* Limit Progress Bar (up to 100 Sources) */}
              <div className="w-full flex items-center gap-3 pt-1 mt-auto">
                <div className="flex-1 h-2 bg-secondary/80 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      currentSourcesCount >= MAX_SOURCES ? "bg-amber-500" : "bg-muted-foreground/40"
                    }`}
                    style={{
                      width: `${Math.min(100, (currentSourcesCount / MAX_SOURCES) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-muted-foreground font-mono font-medium shrink-0 tabular-nums">
                  {currentSourcesCount}/{MAX_SOURCES}
                </span>
              </div>
            </>
          )}

          {/* VIEW: WEB URL & DOCS CRAWL */}
          {mode === "url" && (
            <div className="w-full text-left space-y-4">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1.5">
                  Web Page or Documentation URL
                </label>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://docs.example.com/quickstart"
                  className="w-full bg-secondary/60 rounded-xl px-3.5 py-2.5 text-sm border border-border/60 outline-none focus:border-primary transition-all text-foreground"
                />
              </div>

              {/* Recursive Docs Crawling Toggle */}
              <div className="p-3 rounded-2xl bg-secondary/40 border border-border/50 flex flex-col gap-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <Checkbox
                    checked={crawlDocs}
                    onCheckedChange={(checked) => setCrawlDocs(!!checked)}
                    className="mt-0.5 rounded-[4px] border-border/80 data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground"
                  />
                  <div>
                    <span className="text-xs font-semibold text-foreground block">
                      Crawl Full Documentation Suite (/quickstart, /api, etc.)
                    </span>
                    <span className="text-[11px] text-muted-foreground leading-relaxed block mt-0.5">
                      Automatically discovers and extracts all sub-pages under this documentation path into a unified, structured study guide.
                    </span>
                  </div>
                </label>

                {crawlDocs && (
                  <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs text-muted-foreground mt-1">
                    <span>Max Pages to Crawl:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={3}
                        max={25}
                        value={maxPages}
                        onChange={(e) => setMaxPages(parseInt(e.target.value, 10))}
                        className="w-28 accent-primary"
                      />
                      <span className="font-sans tabular-nums text-xs font-semibold text-foreground">{maxPages}</span>
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
                <span>{crawlDocs ? "Crawl & Ingest Documentation" : "Fetch Web Content"}</span>
              </button>
            </div>
          )}

          {/* VIEW: YOUTUBE VIDEO */}
          {mode === "youtube" && (
            <div className="w-full text-left space-y-4">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1.5">
                  YouTube Video Link
                </label>
                <input
                  type="url"
                  value={youtubeInput}
                  onChange={(e) => setYoutubeInput(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... or youtu.be/..."
                  className="w-full bg-secondary/60 rounded-xl px-3.5 py-2.5 text-sm border border-border/60 outline-none focus:border-primary transition-all text-foreground"
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Extracts complete time-coded captions for video-guided learning.
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
                  placeholder="e.g. Lecture Notes on Thermodynamics"
                  className="w-full bg-secondary/60 rounded-xl px-3 py-2 text-xs border border-border/60 outline-none focus:border-primary transition-all text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Content
                </label>
                <textarea
                  rows={6}
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  placeholder="Paste article text, excerpts, or syllabus details here..."
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

          {/* Loading Indicator Overlay */}
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
