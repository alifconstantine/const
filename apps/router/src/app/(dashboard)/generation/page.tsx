"use client";

import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { useQuery, useMutation } from "convex/react";
import { api } from "@const/backend/_generated/api";
import {
  Button,
  Input,
  Badge,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  ScrollArea,
  Sheet,
  SheetContent,
  SheetTitle,
  cn,
  toast,
} from "@const/ui";
import {
  PanelRightClose,
  PanelRight,
  Code2,
  Key,
  ArrowUp,
  Square,
  Paperclip,
  Plus,
  Eye,
  EyeOff,
  ChevronRight,
  X,
  FileText,
  Film,
  Music,
  Maximize2,
  Minimize2,
  Globe,
} from "lucide-react";
import {
  BUILTIN_MODELS,
  type ModelSpec,
  checkSupportsThinking,
} from "@/lib/model-specs";
import { ModelSelectorPanel } from "@/components/generation/model-selector-panel";
import { SystemInstructionPanel } from "@/components/generation/system-instruction-panel";
import { ViewCodeDialog } from "@/components/generation/view-code-dialog";
import {
  ChatMessageItem,
  type ChatMessage,
  type ChatAttachment,
  type SearchResultItem,
} from "@/components/generation/chat-message-item";

export default function GenerationPage() {
  const { token } = useRouterAuth();

  const availableCombos = useQuery(api.router.combos.listCombos, {});

  const generateUploadUrl = useMutation(api.router.chats.generateUploadUrl);
  const registerFile = useMutation(api.router.chats.registerFile);
  const activeRun = useRef<symbol | null>(null);
  const [uploading, setUploading] = useState(false);

  // Map Virtual Combos into ModelSpec list (strictly user-created custom combos only)
  const comboModels = useMemo<ModelSpec[]>(() => {
    if (!availableCombos) return [];
    return availableCombos
      .filter((c) => c.status === "active")
      .map((c) => ({
        id: `combo/${c.slug}`,
        name: c.name,
        modelId: `combo/${c.slug}`,
        provider: "combo" as const,
        providerName: "Virtual Combo",
        supportsThinking: false,
        isCombo: true,
        comboSlug: c.slug,
        modelsCount: c.models?.length || 0,
        description: c.description,
        contextLength: c.contextLength,
      }));
  }, [availableCombos]);

  // Unified Const Gateway: no external BYOK models
  const customModels: ModelSpec[] = useMemo(() => [], []);

  // Conversations stay in memory for the current page session.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [stagedAttachments, setStagedAttachments] = useState<ChatAttachment[]>(
    [],
  );
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const MIN_TEXTAREA_HEIGHT = 28;
  const MAX_TEXTAREA_HEIGHT = 260;
  const [scrollAreaHeight, setScrollAreaHeight] = useState(MIN_TEXTAREA_HEIGHT);

  // Auto-resize textarea and ScrollArea height smoothly as text grows or shrinks without unmounting
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto first to accurately calculate new scrollHeight
    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight;

    if (!inputPrompt) {
      setScrollAreaHeight(MIN_TEXTAREA_HEIGHT);
      textarea.style.height = `${MIN_TEXTAREA_HEIGHT}px`;

      return;
    }

    if (isExpanded) {
      textarea.style.height = `${Math.max(scrollHeight, 400)}px`;

      return;
    }

    const nextHeight = Math.min(
      Math.max(scrollHeight, MIN_TEXTAREA_HEIGHT),
      MAX_TEXTAREA_HEIGHT,
    );
    setScrollAreaHeight(nextHeight);
    textarea.style.height = `${scrollHeight}px`;
  }, [inputPrompt, isExpanded]);

  useLayoutEffect(() => {
    adjustTextareaHeight();
  }, [inputPrompt, isExpanded, adjustTextareaHeight]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputPrompt(e.target.value);
  };

  // Helper to format file sizes
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const processUploadedFiles = async (files: FileList | File[]) => {
    if (stagedAttachments.length + files.length > 8) {
      toast.error("Attach up to 8 files per message.");
      return;
    }
    setUploading(true);
    try {
      const attachments: ChatAttachment[] = [];
      for (const file of Array.from(files)) {
        const image = ["image/png", "image/jpeg", "image/webp"].includes(
          file.type,
        );
        const text =
          file.type.startsWith("text/") ||
          file.type === "application/json" ||
          /\.(txt|md|csv|json|js|jsx|ts|tsx|py|html|css)$/i.test(file.name);
        if (
          (!image && !text) ||
          file.size > (image ? 5 * 1024 * 1024 : 512 * 1024)
        )
          throw new Error("Use images up to 5 MB or text files up to 512 KB.");
        const contentType = image
          ? file.type
          : file.type === "application/json"
            ? "application/json"
            : "text/plain";
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": contentType },
          body: file,
        });
        if (!response.ok)
          throw new Error("Image upload failed. Retry the upload.");
        const { storageId } = await response.json();
        const saved = await registerFile({ storageId, name: file.name });
        attachments.push({
          name: file.name,
          type: saved.type,
          size: saved.size,
          url: saved.url ?? undefined,
          fileId: saved.fileId,
        });
      }
      setStagedAttachments((previous) => [...previous, ...attachments]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processUploadedFiles(e.target.files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setStagedAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      await processUploadedFiles(e.clipboardData.files);
    }
  };

  // Parameters State
  const [selectedModel, setSelectedModel] = useState<ModelSpec>(
    BUILTIN_MODELS[0]!,
  );
  const [systemInstruction, setSystemInstruction] = useState("");
  const [temperature, setTemperature] = useState<number>(1.0);
  const [thinkingLevel, setThinkingLevel] = useState<"low" | "medium" | "high">(
    "medium",
  );
  const [webSearch, setWebSearch] = useState<
    "off" | "auto" | "research" | "deep-research"
  >("off");

  // Pasted keys are held in memory; an empty value uses account authentication.
  const [customApiKey, setCustomApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  // UI Panels & Modals State
  const [isRunSettingsCollapsed, setIsRunSettingsCollapsed] = useState(false);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [isSystemInstructionOpen, setIsSystemInstructionOpen] = useState(false);
  const [isViewCodeOpen, setIsViewCodeOpen] = useState(false);

  // Check if current model supports dynamic thinking UI
  const supportsThinking = useMemo(() => {
    return checkSupportsThinking(
      selectedModel.modelId,
      customModels,
      selectedModel.name,
    );
  }, [selectedModel.modelId, selectedModel.name, customModels]);

  useEffect(
    () => () => {
      activeRun.current = null;
      abortControllerRef.current?.abort();
    },
    [],
  );

  // Auto scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Start a fresh new chat session
  const handleNewChat = () => {
    activeRun.current = null;
    if (isStreaming) {
      abortControllerRef.current?.abort();
      setIsStreaming(false);
    }
    setMessages([]);
    setInputPrompt("");
    setStagedAttachments([]);
    setIsExpanded(false);
  };

  // Stop active streaming
  const handleStopStreaming = () => {
    abortControllerRef.current?.abort();
  };

  // Send prompt and handle SSE stream
  const handleSendPrompt = async () => {
    const trimmedPrompt = inputPrompt.trim();
    if (
      (!trimmedPrompt && stagedAttachments.length === 0) ||
      isStreaming ||
      uploading
    )
      return;
    const run = Symbol("generation");
    activeRun.current = run;

    const effectiveKey = customApiKey.trim();

    const currentAttachments = [...stagedAttachments];
    setStagedAttachments([]);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmedPrompt,
      attachments:
        currentAttachments.length > 0 ? currentAttachments : undefined,
      createdAt: Date.now(),
    };

    const isSearchActive =
      webSearch !== "off" || selectedModel.modelId === "const-search";
    const activeSearchMode: "research" | "deep-research" =
      webSearch === "deep-research" ? "deep-research" : "research";

    const assistantPlaceholderId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: assistantPlaceholderId,
      role: "assistant",
      content: "",
      thinkingContent: "",
      isSearching: isSearchActive,
      searchQuery: isSearchActive ? trimmedPrompt : undefined,
      searchMode: isSearchActive ? activeSearchMode : undefined,
      createdAt: Date.now(),
    };

    const updatedMessages = [...messages, userMessage, assistantMessage];
    setMessages(updatedMessages);
    setInputPrompt("");
    setScrollAreaHeight(MIN_TEXTAREA_HEIGHT);
    setIsExpanded(false);

    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let accumulatedContent = "";
    let accumulatedThinking = "";
    let failureMessage: string | undefined;
    let activeSearchQuery: string | undefined = isSearchActive
      ? trimmedPrompt
      : undefined;
    let activeSearchResults: SearchResultItem[] | undefined = undefined;

    try {
      const response = await fetch("/api/generation/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-const-sso-token": token } : {}),
          ...(effectiveKey ? { Authorization: `Bearer ${effectiveKey}` } : {}),
        },
        body: JSON.stringify({
          messages: updatedMessages.slice(0, -1).map((m) => ({
            role: m.role,
            content: m.content,
            attachments: m.attachments,
          })),
          model: selectedModel.modelId,
          providerId: selectedModel.provider,
          providerDocId: (selectedModel as { providerDocId?: string })
            .providerDocId,
          systemInstruction,
          temperature,
          thinkingLevel: supportsThinking ? thinkingLevel : "off",
          webSearch: webSearch,
          apiKey: effectiveKey,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorMsg = `Generation failed (${response.status})`;
        try {
          const errJson = await response.json();
          if (errJson?.error?.message) {
            errorMsg = errJson.error.message;
          }
        } catch {}
        throw new Error(errorMsg);
      }

      if (!response.body) {
        throw new Error("No readable response body received.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let activeSearchQueries: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (activeRun.current !== run) return;
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith("data: ")) continue;

          const dataPayload = trimmedLine.substring(6).trim();
          if (dataPayload === "[DONE]") break;

          try {
            const parsed = JSON.parse(dataPayload);

            // Handle Web Search Tool Call Events
            if (parsed.type === "search_start") {
              if (parsed.query) {
                activeSearchQuery = parsed.query;
              }
              if (Array.isArray(parsed.queries)) {
                activeSearchQueries = parsed.queries;
              } else if (parsed.query) {
                activeSearchQueries = [parsed.query];
              }
              const mode = parsed.mode || activeSearchMode;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantPlaceholderId
                    ? {
                        ...msg,
                        isSearching: true,
                        searchQuery: activeSearchQuery,
                        searchQueries: activeSearchQueries,
                        searchMode: mode,
                      }
                    : msg,
                ),
              );
              continue;
            }

            if (parsed.type === "search_results") {
              if (parsed.query) {
                activeSearchQuery = parsed.query;
              }
              if (Array.isArray(parsed.queries)) {
                activeSearchQueries = parsed.queries;
              }
              if (Array.isArray(parsed.results)) {
                activeSearchResults = parsed.results;
              }
              const mode = parsed.mode || activeSearchMode;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantPlaceholderId
                    ? {
                        ...msg,
                        isSearching: false,
                        searchQuery: activeSearchQuery,
                        searchQueries: activeSearchQueries,
                        searchResults: activeSearchResults,
                        searchMode: mode,
                      }
                    : msg,
                ),
              );
              continue;
            }

            if (parsed.error?.message) {
              throw new Error(parsed.error.message);
            }

            const delta = parsed.choices?.[0]?.delta;
            if (!delta) continue;

            if (delta.reasoning_content) {
              accumulatedThinking += delta.reasoning_content;
            } else if (delta.reasoning) {
              accumulatedThinking += delta.reasoning;
            }

            if (delta.content) {
              accumulatedContent += delta.content;
            }

            // Update UI state reactively
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantPlaceholderId
                  ? {
                      ...msg,
                      isSearching: false,
                      searchQuery: activeSearchQuery,
                      searchResults: activeSearchResults,
                      content: accumulatedContent,
                      thinkingContent: accumulatedThinking,
                    }
                  : msg,
              ),
            );
          } catch (pErr) {
            if (
              pErr instanceof Error &&
              pErr.message &&
              !pErr.message.includes("JSON")
            ) {
              throw pErr;
            }
          }
        }
      }
    } catch (err: unknown) {
      if (activeRun.current !== run) return;
      if ((err as Error)?.name === "AbortError") {
        return;
      }
      const errorMessage =
        err instanceof Error ? err.message : "Error generating response";
      failureMessage = errorMessage;
      toast.error("Generation Error", {
        description: errorMessage,
      });

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantPlaceholderId
            ? {
                ...msg,
                content: `Error: ${errorMessage}`,
              }
            : msg,
        ),
      );
    } finally {
      controller.abort();
      const partial: ChatMessage = {
        id: assistantPlaceholderId,
        role: "assistant",
        content: accumulatedContent || failureMessage || "Generation stopped.",
        thinkingContent: accumulatedThinking || undefined,
        createdAt: Date.now(),
        isSearching: false,
        searchQuery: activeSearchQuery,
        searchResults: activeSearchResults,
      };
      const finalList = [...messages, userMessage, partial];
      if (activeRun.current === run) {
        setMessages(finalList);
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    }
  };

  // Keyboard shortcut: Enter to send (unless Shift+Enter or IME), Cmd/Ctrl+Enter always sends
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isExpanded) {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsExpanded(false);
        return;
      }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSendPrompt();
        return;
      }
      return;
    }

    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSendPrompt();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSendPrompt();
    }
  };

  const renderRunSettingsContent = (onClose: () => void) => (
    <div className="flex flex-col h-full overflow-hidden bg-card">
      {/* Header Bar */}
      <div className="p-4 flex items-center justify-between shrink-0 border-b border-border/40">
        <h2 className="font-sans text-base font-semibold text-foreground">
          Run settings
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsViewCodeOpen(true)}
            className="h-9 px-2.5 rounded-lg text-xs font-normal gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <Code2 className="h-3.5 w-3.5" />
            <span>Get code</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close run settings"
            className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
            title="Collapse settings"
          >
            <PanelRightClose className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-6 flex-1 overflow-y-auto">
        {/* 1. Model Selector Row (Clean, No Icon) */}
        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-muted-foreground">
            Model
          </span>
          <button
            type="button"
            onClick={() => setIsModelSelectorOpen(true)}
            className="w-full text-left p-3.5 rounded-xl border border-border bg-background hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className="font-sans text-sm font-medium text-foreground group-hover:text-foreground truncate">
                  {selectedModel.name}
                </span>
                {selectedModel.isCombo && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground font-mono shrink-0">
                    Combo
                  </span>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
            </div>
          </button>
        </div>

        {/* 2. System Instructions Row (No Icon, Clean Typography) */}
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setIsSystemInstructionOpen(true)}
            className="w-full text-left p-3.5 rounded-xl border border-border bg-background hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors cursor-pointer space-y-1.5 group"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                System instructions
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
            <p className="text-xs text-muted-foreground font-normal line-clamp-2 leading-relaxed">
              {systemInstruction.trim() ||
                "Optional tone and style instructions for the model"}
            </p>
          </button>
        </div>

        {/* 3. Paste API Key */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5 text-muted-foreground" />
              <span>API Key</span>
            </label>
            {customApiKey && (
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1"
              >
                {showApiKey ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
                <span>{showApiKey ? "Hide" : "Show"}</span>
              </button>
            )}
          </div>

          <Input
            type={showApiKey ? "text" : "password"}
            value={customApiKey}
            onChange={(e) => setCustomApiKey(e.target.value)}
            placeholder="Optional Const API key"
            aria-label="Optional Const API key"
            autoComplete="off"
            className="h-10 rounded-lg text-xs font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Leave empty to use your account session. Pasted keys are held only
            while this page is open.
          </p>
        </div>

        {/* 4. Temperature Slider */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">
              Temperature
            </span>
            <span className="text-xs font-mono font-medium text-foreground">
              {temperature.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            value={temperature}
            onChange={(event) => setTemperature(Number(event.target.value))}
            min={0.0}
            max={2.0}
            step={0.1}
            aria-label="Temperature"
            className="h-6 w-full cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex justify-between text-xs text-muted-foreground font-sans">
            <span>0.0 (Precise)</span>
            <span>2.0 (Creative)</span>
          </div>
        </div>

        {/* 5. Thinking Level (Conditional: Only visible if model supports thinking) */}
        {supportsThinking && (
          <div className="space-y-2.5 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">
                Thinking level
              </span>
              <Badge
                variant="secondary"
                className="text-xs px-2 py-0.5 font-sans text-foreground font-medium"
              >
                Reasoning
              </Badge>
            </div>

            <Select
              value={thinkingLevel}
              onValueChange={(val: "low" | "medium" | "high") =>
                setThinkingLevel(val)
              }
            >
              <SelectTrigger
                aria-label="Thinking level"
                className="w-full h-9 rounded-lg text-xs font-sans border-border bg-secondary/50 text-foreground"
              >
                <SelectValue placeholder="Thinking Level" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-xs font-sans">
                <SelectItem
                  value="low"
                  className="cursor-pointer text-foreground"
                >
                  Low (Fast Verification)
                </SelectItem>
                <SelectItem
                  value="medium"
                  className="cursor-pointer text-foreground"
                >
                  Medium (Balanced Reasoning)
                </SelectItem>
                <SelectItem
                  value="high"
                  className="cursor-pointer text-foreground"
                >
                  High (Deep Step-by-Step Logic)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground font-normal leading-relaxed">
              Configures reasoning effort and token allocation before producing
              output.
            </p>
          </div>
        )}

        {/* 6. Web Search: Off | Research | DeepResearch */}
        <div className="space-y-2.5 pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">
                Web search
              </span>
            </div>
            <Badge
              variant={webSearch !== "off" ? "default" : "secondary"}
              className={cn(
                "text-xs px-2 py-0.5 font-sans font-medium",
                webSearch !== "off"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground",
              )}
            >
              {webSearch === "deep-research"
                ? "DeepResearch"
                : webSearch !== "off"
                  ? "Research"
                  : "Off"}
            </Badge>
          </div>

          <Select
            value={webSearch}
            onValueChange={(
              val: "off" | "auto" | "research" | "deep-research",
            ) => setWebSearch(val)}
          >
            <SelectTrigger
              aria-label="Web search"
              className="w-full h-9 rounded-lg text-xs font-sans border-border bg-secondary/50 text-foreground"
            >
              <SelectValue placeholder="Web Search" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-xs font-sans">
              <SelectItem
                value="off"
                className="cursor-pointer text-foreground"
              >
                Off (Standard inference)
              </SelectItem>
              <SelectItem
                value="research"
                className="cursor-pointer text-foreground"
              >
                Research (Fast live search)
              </SelectItem>
              <SelectItem
                value="deep-research"
                className="cursor-pointer text-foreground"
              >
                DeepResearch (In-depth multi-source)
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground font-normal leading-relaxed">
            Grounds answers with live web research or deep multi-source
            synthesis via Const Search.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex h-full w-full bg-background text-foreground overflow-hidden">
      {/* Main Center Canvas: Full Width */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
        <header className="flex min-h-20 items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-8">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">Playground</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Test a model. Shape a response.
            </p>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewChat}
              className="h-9 gap-1.5 rounded-lg px-2.5 text-xs"
              aria-label="Clear chat and start a new session"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New session</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsViewCodeOpen(true)}
              className="h-9 gap-1.5 rounded-lg px-2.5 text-xs"
              aria-label="View request code"
            >
              <Code2 className="h-4 w-4" />
              <span className="hidden sm:inline">View code</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileSettingsOpen(true)}
              className="h-9 w-9 rounded-lg md:hidden"
              aria-label="Open run settings"
            >
              <PanelRight className="h-4 w-4" />
            </Button>
          </div>
        </header>
        {uploading && (
          <div
            role="status"
            className="px-4 py-2 text-xs text-muted-foreground"
          >
            Uploading attachments…
          </div>
        )}
        {/* Chat Thread Messages Viewport with ScrollArea */}
        <ScrollArea className="flex-1 min-h-0 h-full">
          <div className="px-3 sm:px-12 py-4 sm:py-6 space-y-4 sm:space-y-6">
            {messages.length === 0 ? (
              <div className="mx-auto flex w-full max-w-3xl flex-col justify-center py-10 sm:py-20">
                <div className="mb-9 max-w-lg">
                  <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    A place to work things out.
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Choose a model, add your instructions, and try a prompt.
                    Follow up to refine the result.
                  </p>
                </div>
                <div className="divide-y divide-border border-y border-border">
                  {[
                    [
                      "Build something",
                      "Write a TypeScript function that groups an array of objects by a given key. Explain your approach.",
                    ],
                    [
                      "Make it clearer",
                      "Help me rewrite this message to be clear, concise, and friendly:\n\n",
                    ],
                    [
                      "Explore an idea",
                      "Explain the tradeoffs between a monolith and microservices for a small engineering team.",
                    ],
                  ].map(([label, prompt]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        setInputPrompt(prompt!);
                        textareaRef.current?.focus();
                      }}
                      className="group flex w-full items-center justify-between gap-4 py-4 text-left text-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span>{label}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Active Messages Thread matching Image 1 layout */
              <div className="max-w-3xl mx-auto space-y-4 w-full">
                {messages.map((m, index) => (
                  <ChatMessageItem
                    key={m.id}
                    message={m}
                    isStreaming={isStreaming}
                    isLast={index === messages.length - 1}
                    onEditPrompt={(text) => setInputPrompt(text)}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Bottom AI Input Bar */}
        <div className="p-3 sm:px-8 sm:pb-6 pt-2 shrink-0 bg-background">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingOver(true);
            }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={async (e) => {
              e.preventDefault();
              setIsDraggingOver(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                await processUploadedFiles(e.dataTransfer.files);
              }
            }}
            className={cn(
              "max-w-3xl mx-auto relative rounded-xl border border-border bg-card transition-colors focus-within:border-primary/60 overflow-hidden",
              isDraggingOver && "bg-secondary/60 ring-2 ring-foreground/20",
            )}
          >
            {/* Hidden native file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept="image/png,image/jpeg,image/webp,text/*,.json,.csv,.ts,.tsx,.js,.jsx,.py,.html,.css,.md"
              className="hidden"
            />

            {/* Staged Attachments Preview Carousel/Row */}
            {stagedAttachments.length > 0 && (
              <div className="px-3.5 pt-3 pb-1 flex flex-wrap gap-2 items-center">
                {stagedAttachments.map((att, idx) => (
                  <div
                    key={`${att.name}-${idx}`}
                    className="group relative flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-secondary text-xs font-sans animate-in fade-in zoom-in-95 duration-150"
                  >
                    {att.type.startsWith("image/") &&
                    (att.url || att.dataUrl) ? (
                      <div className="h-9 w-9 rounded-lg overflow-hidden shrink-0 bg-background/50">
                        <img
                          src={att.url || att.dataUrl}
                          alt={att.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : att.type.startsWith("video/") ? (
                      <Film className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : att.type.startsWith("audio/") ? (
                      <Music className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}

                    <div className="flex flex-col min-w-0 pr-1">
                      <span className="truncate max-w-[130px] font-medium text-foreground text-xs leading-tight">
                        {att.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-tight">
                        {formatFileSize(att.size)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(idx)}
                      className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors"
                      title="Remove attachment"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Unified Adaptive Input: Single permanent Textarea with @const/ui ScrollArea */}
            <div
              className={cn(
                "w-full flex flex-col p-3 sm:p-3.5",
                isExpanded && "h-[min(50dvh,460px)]",
              )}
            >
              {/* Scrollable Textarea Area using @const/ui ScrollArea */}
              <ScrollArea
                className={cn("w-full", isExpanded ? "flex-1 min-h-0" : "")}
                viewportClassName="pr-3"
                style={{
                  height: isExpanded ? "100%" : `${scrollAreaHeight}px`,
                  maxHeight: isExpanded ? "none" : "260px",
                }}
              >
                <textarea
                  ref={textareaRef}
                  value={inputPrompt}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder={
                    stagedAttachments.length > 0
                      ? "Add a message or press enter to send..."
                      : "Ask a question or describe a task…"
                  }
                  aria-label="Message prompt"
                  rows={1}
                  className="w-full bg-transparent border-none p-0 focus:outline-none focus:ring-0 text-sm sm:text-base font-sans text-foreground placeholder:text-muted-foreground resize-none leading-relaxed overflow-hidden"
                />
              </ScrollArea>

              {/* Bottom Actions Toolbar (completely separated from ScrollArea to avoid overlap) */}
              <div className="flex items-center justify-between pt-2.5 shrink-0">
                {/* Left Actions: Attach File / Media */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-10 w-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer shrink-0"
                    aria-label="Attach files"
                    title="Attach files"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </div>

                {/* Right Actions: Maximize/Minimize toggle + Send / Stop button */}
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={() => {
                      setIsExpanded(!isExpanded);
                      setTimeout(() => textareaRef.current?.focus(), 50);
                    }}
                    className="h-10 w-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer shrink-0"
                    aria-label={
                      isExpanded ? "Collapse prompt" : "Expand prompt"
                    }
                    title={
                      isExpanded ? "Collapse prompt (Esc)" : "Expand prompt"
                    }
                  >
                    {isExpanded ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </Button>

                  {isStreaming ? (
                    <Button
                      onClick={handleStopStreaming}
                      size="icon"
                      variant="destructive"
                      className="rounded-lg h-10 w-10 cursor-pointer shrink-0"
                      aria-label="Stop generating"
                      title="Stop generating"
                    >
                      <Square className="h-4 w-4 fill-current" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSendPrompt}
                      disabled={
                        uploading ||
                        (!inputPrompt.trim() && stagedAttachments.length === 0)
                      }
                      size="icon"
                      className="rounded-lg h-10 w-10 cursor-pointer shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-opacity"
                      aria-label="Send message"
                      title={
                        isExpanded
                          ? "Send (Cmd+Enter / Ctrl+Enter)"
                          : "Send (Enter)"
                      }
                    >
                      <ArrowUp className="h-4 w-4 sm:h-5 sm:w-5 stroke-[2.25]" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] leading-5 text-muted-foreground">
            Conversations stay on this page. Usage logging follows your account
            settings.
          </p>
        </div>
      </div>

      {/* Desktop Right Inspector Panel (Collapsible) */}
      <div className="hidden md:flex shrink-0 h-full">
        {isRunSettingsCollapsed ? (
          <div className="shrink-0 flex flex-col items-center py-3 px-2 border-l border-border bg-card">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsRunSettingsCollapsed(false)}
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              title="Expand Run Settings"
            >
              <PanelRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="w-80 shrink-0 border-l border-border bg-card flex flex-col h-full overflow-hidden transition-all">
            {renderRunSettingsContent(() => setIsRunSettingsCollapsed(true))}
          </div>
        )}
      </div>

      {/* Mobile Slide-out Drawer (Like the Left Sidebar Drawer) */}
      <div className="md:hidden">
        <Sheet open={mobileSettingsOpen} onOpenChange={setMobileSettingsOpen}>
          <SheetContent
            side="right"
            showCloseButton={false}
            className="p-0 w-[85vw] max-w-sm border-l border-border bg-card flex flex-col h-full z-50"
          >
            <SheetTitle className="sr-only">Run settings</SheetTitle>
            {renderRunSettingsContent(() => setMobileSettingsOpen(false))}
          </SheetContent>
        </Sheet>
      </div>

      {/* Model Selector Slide-Over Panel (Virtual Combos & Standard Models) */}
      <ModelSelectorPanel
        open={isModelSelectorOpen}
        onClose={() => setIsModelSelectorOpen(false)}
        selectedModelId={selectedModel.modelId}
        onSelectModel={(model) => {
          setSelectedModel(model);
          if (model.modelId === "const-search") {
            setWebSearch("research");
          }
        }}
        customModels={customModels}
        comboModels={comboModels}
      />

      {/* System Instruction Slide-Over Panel */}
      <SystemInstructionPanel
        open={isSystemInstructionOpen}
        onClose={() => setIsSystemInstructionOpen(false)}
        systemInstruction={systemInstruction}
        onSaveInstruction={(inst) => setSystemInstruction(inst)}
      />

      {/* Get Code Slide-Over Panel */}
      <ViewCodeDialog
        open={isViewCodeOpen}
        onClose={() => setIsViewCodeOpen(false)}
        onOpenChange={setIsViewCodeOpen}
        modelId={selectedModel.modelId}
        messages={messages}
        systemInstruction={systemInstruction}
        temperature={temperature}
        thinkingLevel={supportsThinking ? thinkingLevel : undefined}
        webSearch={webSearch}
      />
    </div>
  );
}
