"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { useQuery, useMutation } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { type Id } from "@const/backend/_generated/dataModel";
import {
  Button,
  Input,
  Textarea,
  Slider,
  Badge,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  ScrollArea,
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
  History,
  Pencil,
  Check,
  X,
  FileText,
  Film,
  Music,
  Maximize2,
  Minimize2,
} from "lucide-react";
import {
  BUILTIN_MODELS,
  type ModelSpec,
  checkSupportsThinking,
  isReasoningModel,
} from "@/lib/model-specs";
import { ModelSelectorPanel } from "@/components/generation/model-selector-panel";
import { HistoryPanel, type ChatSessionMeta } from "@/components/generation/history-panel";
import { SystemInstructionPanel } from "@/components/generation/system-instruction-panel";
import { ViewCodeDialog } from "@/components/generation/view-code-dialog";
import { ChatMessageItem, type ChatMessage, type ChatAttachment } from "@/components/generation/chat-message-item";

export default function GenerationPage() {
  const { isAuthenticated, token } = useRouterAuth();

  // Convex Queries & Mutations
  const userChats = useQuery(
    api.router.chats.listChats,
    isAuthenticated ? {} : "skip"
  );
  const userKeys = useQuery(
    api.router.keys.listKeys,
    isAuthenticated ? {} : "skip"
  );
  const userProviders = useQuery(
    api.router.providers.listUserProviders,
    isAuthenticated ? {} : "skip"
  );

  const createChatMutation = useMutation(api.router.chats.createChat);
  const updateChatMutation = useMutation(api.router.chats.updateChat);
  const deleteChatMutation = useMutation(api.router.chats.deleteChat);

  // Map BYOK providers into custom models list
  const customModels = useMemo<ModelSpec[]>(() => {
    if (!userProviders) return [];
    const list: ModelSpec[] = [];
    for (const p of userProviders) {
      if (p.status !== "active") continue;
      for (const m of p.importedModels) {
        if (!m.enabled) continue;
        list.push({
          id: `${p.providerId}/${m.modelId}`,
          name: m.name,
          modelId: m.modelId,
          provider: "byok",
          providerName: p.name,
          providerDocId: p._id,
          supportsThinking: isReasoningModel(m.modelId, m.capabilities, m.name),
        });
      }
    }
    return list;
  }, [userProviders]);

  // Active Session & Chat State
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatTitle, setChatTitle] = useState<string>("Untitled Chat");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("Untitled Chat");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [stagedAttachments, setStagedAttachments] = useState<ChatAttachment[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMultiLine, setIsMultiLine] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Handle textarea text changes and dynamically detect multi-line wrapping
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputPrompt(val);
    if (isExpanded) return;
    if (val.includes("\n") || val.length > 70) {
      setIsMultiLine(true);
    } else if (val.length === 0) {
      setIsMultiLine(false);
    } else {
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          setIsMultiLine(textareaRef.current.scrollHeight > 36);
        }
      });
    }
  };

  // Sync multi-line layout on input or expand toggle
  useEffect(() => {
    if (isExpanded) {
      setIsMultiLine(true);
      return;
    }
    if (!inputPrompt) {
      setIsMultiLine(false);
      return;
    }
    if (inputPrompt.includes("\n") || inputPrompt.length > 70) {
      setIsMultiLine(true);
      return;
    }
    if (textareaRef.current) {
      setIsMultiLine(textareaRef.current.scrollHeight > 36);
    }
  }, [inputPrompt, isExpanded]);

  // Helper to format file sizes
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Convert File object to base64 Data URL
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  // Process uploaded or pasted files
  const processUploadedFiles = async (files: FileList | File[]) => {
    const newAttachments: ChatAttachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;
      // Max 25MB limit per file
      if (file.size > 25 * 1024 * 1024) {
        toast.error(`File "${file.name}" is too large (max 25MB).`);
        continue;
      }
      try {
        const dataUrl = await fileToBase64(file);
        newAttachments.push({
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          dataUrl,
        });
      } catch {
        toast.error(`Failed to read "${file.name}".`);
      }
    }
    if (newAttachments.length > 0) {
      setStagedAttachments((prev) => [...prev, ...newAttachments]);
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
  const [selectedModel, setSelectedModel] = useState<ModelSpec>(BUILTIN_MODELS[0]!);
  const [systemInstruction, setSystemInstruction] = useState("");
  const [temperature, setTemperature] = useState<number>(1.0);
  const [thinkingLevel, setThinkingLevel] = useState<"low" | "medium" | "high">("medium");

  // API Key Selection & Custom Paste (defaults to logged in session)
  const [selectedKeyId, setSelectedKeyId] = useState<string>("account-session");
  const [customApiKey, setCustomApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  // UI Panels & Modals State
  const [isRunSettingsCollapsed, setIsRunSettingsCollapsed] = useState(false);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSystemInstructionOpen, setIsSystemInstructionOpen] = useState(false);
  const [isViewCodeOpen, setIsViewCodeOpen] = useState(false);

  // Load custom API key from localStorage on mount
  useEffect(() => {
    try {
      const savedKey = localStorage.getItem("const_playground_custom_api_key");
      if (savedKey) {
        setCustomApiKey(savedKey);
      }
    } catch {}
  }, []);

  // Sync active chat session from Convex when activeChatId changes
  const activeChatQuery = useQuery(
    api.router.chats.getChat,
    activeChatId ? { chatId: activeChatId as Id<"routerChats"> } : "skip"
  );

  useEffect(() => {
    if (activeChatQuery) {
      setChatTitle(activeChatQuery.title || "Untitled Chat");
      setTitleDraft(activeChatQuery.title || "Untitled Chat");
      setMessages(activeChatQuery.messages);
      setSystemInstruction(activeChatQuery.systemInstruction || "");
      setTemperature(activeChatQuery.temperature);
      if (activeChatQuery.thinkingLevel) {
        const val = activeChatQuery.thinkingLevel.toLowerCase();
        if (val === "low" || val === "high") {
          setThinkingLevel(val);
        } else {
          setThinkingLevel("medium");
        }
      }
      const matched =
        customModels.find((m) => m.modelId === activeChatQuery.modelId) ||
        BUILTIN_MODELS.find((m) => m.modelId === activeChatQuery.modelId);
      if (matched) {
        setSelectedModel(matched);
      }
    }
  }, [activeChatQuery, customModels]);

  // Check if current model supports dynamic thinking UI
  const supportsThinking = useMemo(() => {
    return checkSupportsThinking(selectedModel.modelId, customModels, selectedModel.name);
  }, [selectedModel.modelId, selectedModel.name, customModels]);

  // Auto scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Save custom key change to local storage
  const handleCustomKeyChange = (val: string) => {
    setCustomApiKey(val);
    try {
      localStorage.setItem("const_playground_custom_api_key", val.trim());
    } catch {}
  };

  // Start a fresh new chat session
  const handleNewChat = () => {
    if (isStreaming) {
      abortControllerRef.current?.abort();
      setIsStreaming(false);
    }
    setActiveChatId(null);
    setChatTitle("Untitled Chat");
    setTitleDraft("Untitled Chat");
    setMessages([]);
    setInputPrompt("");
    setStagedAttachments([]);
    setIsExpanded(false);
    setIsMultiLine(false);
    setSystemInstruction("");
  };

  // Save edited title
  const handleSaveTitle = async () => {
    const trimmed = titleDraft.trim() || "Untitled Chat";
    setChatTitle(trimmed);
    setIsEditingTitle(false);
    if (activeChatId && isAuthenticated) {
      try {
        await updateChatMutation({
          chatId: activeChatId as Id<"routerChats">,
          title: trimmed,
        });
      } catch {}
    }
  };

  // Delete a chat session
  const handleDeleteChat = async (chatId: string) => {
    try {
      await deleteChatMutation({ chatId: chatId as Id<"routerChats"> });
      if (activeChatId === chatId) {
        handleNewChat();
      }
      toast.success("Chat deleted");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete chat";
      toast.error(msg);
    }
  };

  // Stop active streaming
  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  };

  // Send prompt and handle SSE stream
  const handleSendPrompt = async () => {
    const trimmedPrompt = inputPrompt.trim();
    if ((!trimmedPrompt && stagedAttachments.length === 0) || isStreaming) return;

    // Determine effective API key
    let effectiveKey = "";
    if (selectedKeyId === "custom") {
      effectiveKey = customApiKey.trim();
    } else if (selectedKeyId !== "account-session") {
      effectiveKey = customApiKey.trim();
    }

    const currentAttachments = [...stagedAttachments];
    setStagedAttachments([]);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmedPrompt,
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
      createdAt: Date.now(),
    };

    const assistantPlaceholderId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: assistantPlaceholderId,
      role: "assistant",
      content: "",
      thinkingContent: "",
      createdAt: Date.now(),
    };

    const updatedMessages = [...messages, userMessage, assistantMessage];
    setMessages(updatedMessages);
    setInputPrompt("");
    setIsExpanded(false);
    setIsMultiLine(false);
    setIsStreaming(true);

    // Auto-generate clean title on first prompt if still untitled
    let effectiveTitle = chatTitle;
    if (chatTitle === "Untitled Chat" && messages.length === 0) {
      const autoTitle = trimmedPrompt
        ? (trimmedPrompt.length > 36 ? `${trimmedPrompt.slice(0, 36).trim()}...` : trimmedPrompt)
        : (currentAttachments[0]?.name ? `File: ${currentAttachments[0].name}` : "Untitled Chat");
      setChatTitle(autoTitle);
      setTitleDraft(autoTitle);
      effectiveTitle = autoTitle;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let accumulatedContent = "";
    let accumulatedThinking = "";

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
          providerDocId: (selectedModel as { providerDocId?: string }).providerDocId,
          systemInstruction,
          temperature,
          thinkingLevel: supportsThinking ? thinkingLevel : "off",
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

      while (true) {
        const { done, value } = await reader.read();
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
                      content: accumulatedContent,
                      thinkingContent: accumulatedThinking,
                    }
                  : msg
              )
            );
          } catch {}
        }
      }

      // Final message snapshot
      const finalAssistantMessage: ChatMessage = {
        id: assistantPlaceholderId,
        role: "assistant",
        content: accumulatedContent,
        thinkingContent: accumulatedThinking || undefined,
        createdAt: Date.now(),
      };

      const finalMessagesList = [...messages, userMessage, finalAssistantMessage];
      setMessages(finalMessagesList);

      // Persist to Convex database
      if (isAuthenticated) {
        try {
          if (!activeChatId) {
            const res = await createChatMutation({
              title: effectiveTitle,
              modelId: selectedModel.modelId,
              providerId: selectedModel.provider,
              systemInstruction,
              temperature,
              thinkingLevel: supportsThinking ? thinkingLevel : undefined,
              messages: finalMessagesList,
            });
            setActiveChatId(res.chatId);
          } else {
            await updateChatMutation({
              chatId: activeChatId as Id<"routerChats">,
              title: effectiveTitle,
              modelId: selectedModel.modelId,
              providerId: selectedModel.provider,
              systemInstruction,
              temperature,
              thinkingLevel: supportsThinking ? thinkingLevel : undefined,
              messages: finalMessagesList,
            });
          }
        } catch (dbErr) {
          console.warn("Could not sync chat to database:", dbErr);
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") {
        return;
      }
      const errorMessage = err instanceof Error ? err.message : "Error generating response";
      toast.error("Generation Error", {
        description: errorMessage,
      });

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantPlaceholderId
            ? {
                ...msg,
                content: `⚠️ Error: ${errorMessage}`,
              }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  // Keyboard shortcut: Enter to send, Shift+Enter for newline
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendPrompt();
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -m-6 md:-m-8 bg-background text-foreground overflow-hidden">
      {/* Main Center Canvas: Full Width */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
        {/* Top Chat Title Bar (Editable, Default "Untitled Chat") */}
        <div className="h-14 px-6 border-b border-border/60 flex items-center justify-between shrink-0 bg-background/95 backdrop-blur">
          <div className="flex items-center gap-2 max-w-lg">
            {isEditingTitle ? (
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") {
                    setTitleDraft(chatTitle);
                    setIsEditingTitle(false);
                  }
                }}
                className="h-8 px-2.5 text-base sm:text-lg font-sans font-medium rounded-lg bg-secondary/50 text-foreground outline-none ring-1 ring-foreground/30 w-72 transition-all"
                autoFocus
                onFocus={(e) => e.target.select()}
              />
            ) : (
              <div
                onClick={() => {
                  setTitleDraft(chatTitle);
                  setIsEditingTitle(true);
                }}
                className="group flex items-center gap-2 cursor-pointer select-none py-1 px-2 -ml-2 rounded-lg hover:bg-secondary/50 transition-colors"
                title="Click to rename chat"
              >
                <span className="font-sans text-base sm:text-lg font-medium text-foreground truncate max-w-md">
                  {chatTitle}
                </span>
                <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>
        </div>

        {/* Chat Thread Messages Viewport with ScrollArea */}
        <ScrollArea className="flex-1 h-full">
          <div className="px-4 sm:px-12 py-6 space-y-6">
            {messages.length === 0 ? null : (
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
        <div className="p-4 sm:p-6 pt-2 bg-gradient-to-t from-background via-background/90 to-transparent">
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
              "max-w-3xl mx-auto relative rounded-3xl bg-secondary/40 backdrop-blur-md shadow-sm transition-all focus-within:shadow-md overflow-hidden",
              isDraggingOver && "bg-secondary/60 ring-2 ring-foreground/20"
            )}
          >
            {/* Hidden native file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept="image/*,video/*,audio/*,application/pdf,text/*,.json,.csv,.ts,.tsx,.js,.jsx,.py,.html,.css,.md"
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
                    {att.type.startsWith("image/") && att.dataUrl ? (
                      <div className="h-7 w-7 rounded-lg overflow-hidden shrink-0 bg-background/50">
                        <img
                          src={att.dataUrl}
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
                      className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors"
                      title="Remove attachment"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Adaptive Input Layout: Expanded (Image 4), Multi-line (Image 3), Single-line (Image 2) */}
            {isExpanded ? (
              /* Expanded Mode (Image 4) */
              <div className="flex flex-col h-[55vh] min-h-[360px] max-h-[75vh]">
                {/* Textarea Area with Minimize Button */}
                <div className="relative p-4 flex-1 flex flex-col min-h-0">
                  <textarea
                    ref={textareaRef}
                    value={inputPrompt}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder={
                      stagedAttachments.length > 0
                        ? "Add a message or press enter to send..."
                        : "Start typing a prompt to see what our models can do..."
                    }
                    className="w-full flex-1 bg-transparent border-none p-0 pr-8 focus:outline-none focus:ring-0 text-sm sm:text-base font-sans text-foreground placeholder:text-muted-foreground/70 resize-none leading-relaxed overflow-y-auto"
                  />

                  {/* Minimize Button in Top-Right corner */}
                  <button
                    type="button"
                    onClick={() => setIsExpanded(false)}
                    className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
                    title="Collapse prompt"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Bottom Actions Bar */}
                <div className="flex items-center justify-between px-4 pb-3 pt-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer shrink-0"
                    title="Attach files or media"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>

                  {isStreaming ? (
                    <Button
                      onClick={handleStopStreaming}
                      size="icon"
                      variant="destructive"
                      className="rounded-full h-9 w-9 cursor-pointer shrink-0"
                      title="Stop generating"
                    >
                      <Square className="h-4 w-4 fill-current" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSendPrompt}
                      disabled={!inputPrompt.trim() && stagedAttachments.length === 0}
                      size="icon"
                      className="rounded-full h-9 w-9 cursor-pointer shrink-0 bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40"
                      title="Send (Enter)"
                    >
                      <ArrowUp className="h-5 w-5 stroke-[2.25]" />
                    </Button>
                  )}
                </div>
              </div>
            ) : isMultiLine ? (
              /* Multi-line Mode (Image 3) */
              <div className="flex flex-col">
                {/* Textarea Area with Maximize Button in Top-Right */}
                <div className="relative p-3.5 pb-2">
                  <textarea
                    ref={textareaRef}
                    value={inputPrompt}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder={
                      stagedAttachments.length > 0
                        ? "Add a message or press enter to send..."
                        : "Start typing a prompt to see what our models can do..."
                    }
                    rows={3}
                    className="w-full bg-transparent border-none p-0 pr-8 focus:outline-none focus:ring-0 text-sm sm:text-base font-sans text-foreground placeholder:text-muted-foreground/70 resize-none leading-relaxed min-h-[64px] max-h-48 overflow-y-auto"
                  />

                  {/* Maximize Button in Top-Right corner */}
                  <button
                    type="button"
                    onClick={() => setIsExpanded(true)}
                    className="absolute top-2.5 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
                    title="Expand prompt"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Bottom Actions Bar */}
                <div className="flex items-center justify-between px-3 pb-3 pt-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer shrink-0"
                    title="Attach files or media"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>

                  {isStreaming ? (
                    <Button
                      onClick={handleStopStreaming}
                      size="icon"
                      variant="destructive"
                      className="rounded-full h-9 w-9 cursor-pointer shrink-0"
                      title="Stop generating"
                    >
                      <Square className="h-4 w-4 fill-current" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSendPrompt}
                      disabled={!inputPrompt.trim() && stagedAttachments.length === 0}
                      size="icon"
                      className="rounded-full h-9 w-9 cursor-pointer shrink-0 bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40"
                      title="Send (Enter)"
                    >
                      <ArrowUp className="h-5 w-5 stroke-[2.25]" />
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              /* Single-line Centered Mode (Image 2) */
              <div className="flex items-center gap-2 px-3 py-2">
                {/* Paperclip Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer shrink-0"
                  title="Attach files or media"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>

                {/* Textarea Centered Vertically with Left and Right buttons */}
                <div className="flex-1 flex items-center min-h-[36px]">
                  <textarea
                    ref={textareaRef}
                    value={inputPrompt}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder={
                      stagedAttachments.length > 0
                        ? "Add a message or press enter to send..."
                        : "Start typing a prompt to see what our models can do..."
                    }
                    rows={1}
                    className="w-full bg-transparent border-none p-0 focus:outline-none focus:ring-0 text-sm sm:text-base font-sans text-foreground placeholder:text-muted-foreground/70 resize-none leading-normal my-auto h-6 overflow-hidden"
                  />
                </div>

                {/* Subtle Maximize button */}
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => {
                    setIsExpanded(true);
                    setIsMultiLine(true);
                  }}
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer shrink-0"
                  title="Expand prompt"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>

                {/* Arrow Up Send / Stop Button */}
                {isStreaming ? (
                  <Button
                    onClick={handleStopStreaming}
                    size="icon"
                    variant="destructive"
                    className="rounded-full h-9 w-9 cursor-pointer shrink-0"
                    title="Stop generating"
                  >
                    <Square className="h-4 w-4 fill-current" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSendPrompt}
                    disabled={!inputPrompt.trim() && stagedAttachments.length === 0}
                    size="icon"
                    className="rounded-full h-9 w-9 cursor-pointer shrink-0 bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40"
                    title="Send (Enter)"
                  >
                    <ArrowUp className="h-5 w-5 stroke-[2.25]" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Inspector Panel: "Run settings" */}
      {isRunSettingsCollapsed ? (
        <div className="shrink-0 flex flex-col items-center py-3 px-2 border-l border-border/70 bg-card/40">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsRunSettingsCollapsed(false)}
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
            title="Expand Run Settings"
          >
            <PanelRight className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="w-80 shrink-0 border-l border-border/70 bg-card/40 flex flex-col h-full overflow-y-auto select-none transition-all">
          {/* Header Bar */}
          <div className="p-4 border-b border-border/60 flex items-center justify-between">
            <h2 className="font-sans text-base font-semibold text-foreground">
              Run settings
            </h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsViewCodeOpen(true)}
                className="h-7 px-2.5 rounded-full text-xs font-normal gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <Code2 className="h-3.5 w-3.5" />
                <span>Get code</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsRunSettingsCollapsed(true)}
                className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
                title="Collapse settings"
              >
                <PanelRightClose className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="p-4 space-y-6 flex-1">
            {/* New Chat & History Row in Right Sidebar */}
            <div className="flex items-center gap-2">
              <Button
                onClick={handleNewChat}
                size="sm"
                className="flex-1 rounded-full text-xs sm:text-sm font-medium h-9 gap-1.5 cursor-pointer shadow-sm bg-foreground text-background hover:bg-foreground/90"
              >
                <Plus className="h-4 w-4" />
                <span>New chat</span>
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsHistoryOpen(true)}
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground border-border/70 cursor-pointer shrink-0 hover:bg-secondary"
                title="Chat history"
              >
                <History className="h-4 w-4" />
              </Button>
            </div>

            {/* 1. Model Selector Row (Clean, No Icon) */}
            <div className="space-y-1.5">
              <div
                onClick={() => setIsModelSelectorOpen(true)}
                className="p-3.5 rounded-2xl border border-border/70 bg-card hover:bg-secondary/40 hover:border-border transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-sans text-sm font-medium text-foreground group-hover:text-foreground">
                    {selectedModel.name}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </div>
            </div>

            {/* 2. System Instructions Row (No Icon, Clean Typography) */}
            <div className="space-y-1.5">
              <div
                onClick={() => setIsSystemInstructionOpen(true)}
                className="p-3.5 rounded-2xl border border-border/70 bg-card hover:bg-secondary/40 transition-all cursor-pointer space-y-1.5 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">System instructions</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <p className="text-xs text-muted-foreground font-normal line-clamp-2 leading-relaxed">
                  {systemInstruction.trim() || "Optional tone and style instructions for the model"}
                </p>
              </div>
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
                    {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    <span>{showApiKey ? "Hide" : "Show"}</span>
                  </button>
                )}
              </div>

              {/* Selector or custom paste */}
              {userKeys && userKeys.length > 0 ? (
                <div className="space-y-2">
                  <Select value={selectedKeyId} onValueChange={setSelectedKeyId}>
                    <SelectTrigger className="h-9 rounded-full text-xs font-sans bg-secondary/50 border-border/70 text-foreground">
                      <SelectValue placeholder="Choose Key" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border/70 text-xs font-sans">
                      <SelectItem value="account-session" className="cursor-pointer font-sans text-foreground">
                        Const Account Session (Default)
                      </SelectItem>
                      <SelectItem value="custom" className="cursor-pointer font-sans text-foreground">
                        Use Custom Pasted Key
                      </SelectItem>
                      {userKeys.map((k) => (
                        <SelectItem key={k._id} value={k._id} className="cursor-pointer text-foreground">
                          {k.name} ({k.keyPrefix})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedKeyId === "custom" && (
                    <Input
                      type={showApiKey ? "text" : "password"}
                      value={customApiKey}
                      onChange={(e) => handleCustomKeyChange(e.target.value)}
                      placeholder="Paste Gemini, OpenAI, or Const Key..."
                      className="h-9 rounded-full text-xs font-mono border-border/70 bg-background text-foreground"
                    />
                  )}
                </div>
              ) : (
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={customApiKey}
                  onChange={(e) => handleCustomKeyChange(e.target.value)}
                  placeholder="Paste Gemini, OpenAI, or Const Key..."
                  className="h-9 rounded-full text-xs font-mono border-border/70 bg-background text-foreground"
                />
              )}
              <p className="text-xs text-muted-foreground font-normal leading-relaxed">
                Key is used for direct streaming execution and saved in your local browser session.
              </p>
            </div>

            {/* 4. Temperature Slider */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Temperature</span>
                <span className="text-xs font-mono font-medium text-foreground">{temperature.toFixed(1)}</span>
              </div>
              <Slider
                value={[temperature]}
                onValueChange={(vals) => setTemperature(vals[0] ?? 1.0)}
                min={0.0}
                max={2.0}
                step={0.1}
                className="w-full cursor-pointer"
              />
              <div className="flex justify-between text-xs text-muted-foreground font-sans">
                <span>0.0 (Precise)</span>
                <span>2.0 (Creative)</span>
              </div>
            </div>

            {/* 5. Thinking Level (Conditional: Only visible if model supports thinking) */}
            {supportsThinking && (
              <div className="space-y-2.5 pt-3 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">Thinking level</span>
                  <Badge variant="secondary" className="text-xs px-2 py-0.5 font-sans text-foreground font-medium">
                    Reasoning
                  </Badge>
                </div>

                <Select
                  value={thinkingLevel}
                  onValueChange={(val: "low" | "medium" | "high") => setThinkingLevel(val)}
                >
                  <SelectTrigger className="w-full h-9 rounded-full text-xs font-sans border-border/70 bg-secondary/50 text-foreground">
                    <SelectValue placeholder="Thinking Level" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border/70 text-xs font-sans">
                    <SelectItem value="low" className="cursor-pointer text-foreground">
                      Low (Fast Verification)
                    </SelectItem>
                    <SelectItem value="medium" className="cursor-pointer text-foreground">
                      Medium (Balanced Reasoning)
                    </SelectItem>
                    <SelectItem value="high" className="cursor-pointer text-foreground">
                      High (Deep Step-by-Step Logic)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground font-normal leading-relaxed">
                  Configures reasoning effort and token allocation before producing output.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Model Selector Slide-Over Panel (No Dummy, Model Names Only) */}
      <ModelSelectorPanel
        open={isModelSelectorOpen}
        onClose={() => setIsModelSelectorOpen(false)}
        selectedModelId={selectedModel.modelId}
        onSelectModel={(model) => setSelectedModel(model)}
        customModels={customModels}
      />

      {/* History Slide-Over Panel */}
      <HistoryPanel
        open={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        sessions={(userChats as unknown as ChatSessionMeta[]) || []}
        activeChatId={activeChatId}
        onSelectChat={(id) => setActiveChatId(id)}
        onDeleteChat={handleDeleteChat}
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
      />
    </div>
  );
}
