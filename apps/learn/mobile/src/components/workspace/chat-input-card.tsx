import React, { useRef, useEffect, useState, useMemo } from "react";
import {
  ArrowUp,
  Square,
  Plus,
  FolderOpen,
  X,
  FileText,
  Video,
  Mic,
  PencilSparkles,
} from "lucide-react";
import { ScrollArea, cn, toast, VoiceInput } from "@const/ui";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../lib/db";
import { useVoiceRecognition } from "../../lib/voice";
import { useI18n } from "../../lib/i18n";

export const MAX_ATTACHMENTS = 5;

export interface AttachedMedia {
  id: string;
  name: string;
  size: number;
  type: "image" | "video" | "document" | "other";
  url?: string;
  base64?: string;
  imageIndex?: number;
  file?: File;
}

interface ChatInputCardProps {
  inputMessage: string;
  onChangeInput: (val: string) => void;
  onSend: (customPrompt?: string, attachments?: AttachedMedia[]) => void;
  onStop: () => void;
  isStreaming: boolean;
  selectedModelName: string;
  sourcesCount?: number;
  onOpenSources?: () => void;
  attachments?: AttachedMedia[];
  onAttachmentsChange?: (attachments: AttachedMedia[]) => void;
  onPreviewMedia?: (media: {
    src: string;
    alt: string;
    type?: AttachedMedia["type"];
    fileSize?: number;
  }) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ChatInputCard({
  inputMessage,
  onChangeInput,
  onSend,
  onStop,
  isStreaming,
  selectedModelName,
  sourcesCount = 0,
  onOpenSources,
  attachments: externalAttachments,
  onAttachmentsChange,
  onPreviewMedia,
}: ChatInputCardProps) {
  const { t, language } = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local attachments fallback if not controlled externally
  const [internalAttachments, setInternalAttachments] = useState<AttachedMedia[]>([]);
  const attachments = externalAttachments ?? internalAttachments;
  const [isMultiline, setIsMultiline] = useState(false);

  // Real-time Voice Input via Const Router Whisper API
  const {
    isListening: isVoiceListening,
    isTranscribing: isVoiceTranscribing,
    startListening: startVoiceListening,
    stopListening: stopVoiceListening,
  } = useVoiceRecognition({
    language: language || "id",
    onTranscript: (liveTranscript) => {
      onChangeInput(liveTranscript);
      if (liveTranscript.length > 40 || liveTranscript.includes("\n")) {
        setIsMultiline(true);
      }
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    },
  });

  // Skills live query for mobile slash command suggestions
  const allSkills = useLiveQuery(() => db.skills.toArray(), []) || [];

  const activeSlashQuery = useMemo(() => {
    const match = /(?:^|\s)\/([a-zA-Z0-9_-]*)$/.exec(inputMessage);
    if (!match) return null;
    return match[1] || "";
  }, [inputMessage]);

  const slashSkills = useMemo(() => {
    if (activeSlashQuery === null) return [];
    const query = activeSlashQuery.toLowerCase();
    const enabled = allSkills.filter((s) => s.isEnabled);
    if (!query) return enabled;
    return enabled.filter(
      (s) =>
        s.slug.toLowerCase().includes(query) ||
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query)
    );
  }, [activeSlashQuery, allSkills]);

  const handleSelectSlashSkill = (slug: string) => {
    const current = inputMessage;
    const match = /(?:^|\s)(\/[a-zA-Z0-9_-]*)$/.exec(current);
    let nextText = `/${slug} `;
    if (match && match[1]) {
      const startIdx = current.length - match[1].length;
      nextText = current.slice(0, startIdx) + `/${slug} `;
    }
    onChangeInput(nextText);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  const SINGLE_LINE_HEIGHT = 28;
  const MIN_MULTILINE_HEIGHT = 44;
  const MAX_MULTILINE_HEIGHT = 140;

  const updateAttachments = (next: AttachedMedia[]) => {
    if (onAttachmentsChange) {
      onAttachmentsChange(next);
    } else {
      setInternalAttachments(next);
    }
  };

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (!isMultiline && attachments.length === 0) {
      const singlePx = `${SINGLE_LINE_HEIGHT}px`;
      if (textarea.style.height !== singlePx) {
        textarea.style.height = singlePx;
      }
      return;
    }

    textarea.style.height = "auto";
    const nextHeight = Math.min(
      Math.max(MIN_MULTILINE_HEIGHT, textarea.scrollHeight),
      MAX_MULTILINE_HEIGHT
    );
    const nextPx = `${nextHeight}px`;
    if (textarea.style.height !== nextPx) {
      textarea.style.height = nextPx;
    }
  };

  const handleInputChange = (val: string) => {
    onChangeInput(val);

    if (attachments.length > 0) {
      if (!isMultiline) setIsMultiline(true);
      return;
    }

    if (!val.trim()) {
      if (isMultiline) setIsMultiline(false);
      if (textareaRef.current && textareaRef.current.style.height !== `${SINGLE_LINE_HEIGHT}px`) {
        textareaRef.current.style.height = `${SINGLE_LINE_HEIGHT}px`;
      }
      return;
    }

    if (val.includes("\n")) {
      if (!isMultiline) setIsMultiline(true);
      return;
    }

    // In single-line mode, only check scrollHeight if text is long enough to potentially wrap (> 35 chars)
    const textarea = textareaRef.current;
    if (textarea && !isMultiline) {
      if (val.length > 35 && textarea.scrollHeight > SINGLE_LINE_HEIGHT + 4) {
        setIsMultiline(true);
        return;
      }
    }

    // Collapse back if user deletes back to a short string (<= 30 chars) without newlines
    if (isMultiline && val.length <= 30 && !val.includes("\n") && attachments.length === 0) {
      setIsMultiline(false);
      if (textarea && textarea.style.height !== `${SINGLE_LINE_HEIGHT}px`) {
        textarea.style.height = `${SINGLE_LINE_HEIGHT}px`;
      }
      return;
    }
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (attachments.length > 0) {
      if (!isMultiline) setIsMultiline(true);
    } else if (!inputMessage.trim()) {
      if (isMultiline) setIsMultiline(false);
      if (textarea.style.height !== `${SINGLE_LINE_HEIGHT}px`) {
        textarea.style.height = `${SINGLE_LINE_HEIGHT}px`;
      }
      return;
    } else if (inputMessage.includes("\n")) {
      if (!isMultiline) setIsMultiline(true);
    } else if (!isMultiline && inputMessage.length > 35 && textarea.scrollHeight > SINGLE_LINE_HEIGHT + 4) {
      setIsMultiline(true);
    }

    adjustHeight();
  }, [inputMessage, attachments.length, isMultiline]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && (inputMessage.trim() || attachments.length > 0)) {
        onSend(inputMessage, attachments);
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = MAX_ATTACHMENTS - attachments.length;
    if (remainingSlots <= 0) {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    const readBase64 = (file: File): Promise<string> =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
      });

    const newItems: AttachedMedia[] = [];
    for (const file of filesToProcess) {
      if (!file) continue;

      let type: AttachedMedia["type"] = "other";
      if (file.type.startsWith("image/")) type = "image";
      else if (file.type.startsWith("video/")) type = "video";
      else if (
        file.type.includes("pdf") ||
        file.type.includes("document") ||
        file.type.includes("text") ||
        file.name.endsWith(".md") ||
        file.name.endsWith(".txt")
      ) {
        type = "document";
      }

      const url =
        type === "image" || type === "video" ? URL.createObjectURL(file) : undefined;
      const base64 = type === "image" ? await readBase64(file) : undefined;

      newItems.push({
        id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: file.name,
        size: file.size,
        type,
        url,
        base64,
        file,
      });
    }

    updateAttachments([...attachments, ...newItems]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveAttachment = (id: string) => {
    const item = attachments.find((a) => a.id === id);
    if (item?.url) {
      URL.revokeObjectURL(item.url);
    }
    updateAttachments(attachments.filter((a) => a.id !== id));
  };

  const isMaxReached = attachments.length >= MAX_ATTACHMENTS;
  const canSend = inputMessage.trim().length > 0 || attachments.length > 0;

  // Render file input for attachments
  const renderFileInput = () => (
    <input
      ref={fileInputRef}
      type="file"
      multiple
      disabled={isMaxReached}
      onChange={handleFileChange}
      accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.md"
      className="hidden"
    />
  );

  // Render source badge (icon and number only, muted color, no "sumber" text)
  const renderSourceBadge = () => {
    if (!sourcesCount || sourcesCount <= 0) return null;
    return (
      <button
        type="button"
        onClick={onOpenSources}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer select-none"
        title={t("learningSources")}
        aria-label={t("learningSources")}
      >
        <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="font-sans text-[11px] text-muted-foreground font-medium">{sourcesCount}</span>
      </button>
    );
  };

  // Render send or stop action button (ChatGPT mobile layout)
  const renderSendButton = () => {
    if (isStreaming) {
      return (
        <button
          type="button"
          onClick={onStop}
          className="w-8 h-8 rounded-full bg-secondary hover:bg-secondary/80 text-destructive hover:text-destructive flex items-center justify-center transition-colors cursor-pointer border border-border shrink-0 active:scale-95"
          title={t("stopGenerating")}
          aria-label={t("stopGenerating")}
        >
          <Square className="w-3 h-3 fill-current" />
        </button>
      );
    }

    // 0. If actively transcribing audio via Const Router Whisper: show loading pill
    if (isVoiceTranscribing) {
      return (
        <VoiceInput
          loading={true}
          className="shrink-0"
        />
      );
    }

    // 1. If actively recording speech: show expanded VoiceInput pill
    if (isVoiceListening) {
      return (
        <VoiceInput
          listening={true}
          onToggle={stopVoiceListening}
          className="shrink-0"
        />
      );
    }

    if (!canSend) {
      // In empty mode and not listening, display VoiceInput and ChatGPT voice waveform button
      return (
        <div className="flex items-center gap-1 shrink-0">
          <VoiceInput
            listening={false}
            onToggle={() => startVoiceListening(inputMessage)}
            className="shrink-0"
          />
          <button
            type="button"
            onClick={() => toast.info(t("voiceModeNotAvailable"))}
            className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center transition-transform active:scale-95 cursor-pointer shrink-0 shadow-xs"
            title="Mode Suara"
            aria-label="Mode Suara"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 3v18" />
              <path d="M8 7v10" />
              <path d="M4 10v4" />
              <path d="M16 7v10" />
              <path d="M20 10v4" />
            </svg>
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => {
            if (isVoiceListening) stopVoiceListening();
            onSend(inputMessage, attachments);
          }}
          className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0 shadow-xs"
          title={t("sendMessage")}
          aria-label={t("sendMessage")}
        >
          <ArrowUp className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>
    );
  };

  const renderPlusButton = () => (
    <button
      type="button"
      disabled={isMaxReached}
      onClick={() => {
        if (!isMaxReached) {
          fileInputRef.current?.click();
        }
      }}
      className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0",
        isMaxReached
          ? "opacity-35 cursor-not-allowed text-muted-foreground/40"
          : "hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer active:scale-95"
      )}
      title={
        isMaxReached
          ? t("maxAttachmentsReached", { count: MAX_ATTACHMENTS })
          : t("addMediaOrDoc")
      }
      aria-label={t("addMediaOrDoc")}
    >
      <Plus className="w-5 h-5 stroke-[2]" />
    </button>
  );

  const renderAttachmentsShelf = () => {
    if (attachments.length === 0) return null;
    return (
      <ScrollArea orientation="horizontal" className="w-full">
        <div className="flex items-center gap-2 px-1 pt-1 pb-1 select-none w-max">
          {attachments.map((att) => {
            const ext = (att.name.split(".").pop() || "FILE").toUpperCase();
            const isImage = att.type === "image";
            const isVideo = att.type === "video";
            const isMedia = isImage || isVideo;

            return (
              <div
                key={att.id}
                title={`${att.name} (${formatFileSize(att.size)})`}
                onClick={() => {
                  if (onPreviewMedia && (att.url || att.base64)) {
                    onPreviewMedia({
                      src: att.url || att.base64 || "",
                      alt: att.name,
                      type: att.type,
                      fileSize: att.size,
                    });
                  }
                }}
                className={cn(
                  "relative group shrink-0 rounded-xl border border-border bg-secondary/50 shadow-xs select-none",
                  isMedia
                    ? "w-16 h-16 sm:w-20 sm:h-20 cursor-pointer active:scale-95 transition-transform"
                    : "w-32 sm:w-36 h-16 sm:h-20"
                )}
              >
                {isImage && (att.url || att.base64) ? (
                  <div className="w-full h-full rounded-xl overflow-hidden relative">
                    <img
                      src={att.url || att.base64}
                      alt={att.name}
                      className="w-full h-full object-cover block"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-[8.5px] text-white font-medium truncate leading-tight px-0.5">
                        {att.name}
                      </p>
                    </div>
                  </div>
                ) : isVideo && att.url ? (
                  <div className="w-full h-full rounded-xl overflow-hidden bg-black relative flex items-center justify-center">
                    <Video className="w-5 h-5 text-muted-foreground" />
                    <span className="absolute bottom-1 right-1 text-[7px] font-sans bg-black/70 text-white px-1 rounded uppercase font-bold">
                      VID
                    </span>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-[8.5px] text-white font-medium truncate leading-tight px-0.5">
                        {att.name}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full p-1.5 flex flex-col justify-between rounded-xl bg-secondary/80 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-bold text-muted-foreground font-sans uppercase">
                        {ext}
                      </span>
                      <FileText className="w-3 h-3 text-foreground shrink-0" />
                    </div>
                    <div className="w-full flex-1 my-0.5 min-h-0 overflow-hidden">
                      <ScrollArea className="w-full h-full max-h-[30px] sm:max-h-[36px]">
                        <span className="text-[9.5px] font-medium text-foreground leading-tight break-words block pr-1">
                          {att.name}
                        </span>
                      </ScrollArea>
                    </div>
                    <span className="text-[7.5px] text-muted-foreground font-sans tabular-nums block truncate">
                      {formatFileSize(att.size)}
                    </span>
                  </div>
                )}

                {/* Hover tooltip tag showing filename */}
                <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 z-30 px-2 py-0.5 bg-popover text-popover-foreground text-[9.5px] font-sans rounded-md shadow-lg border border-border opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap max-w-[180px] truncate">
                  {att.name}
                </div>

                {/* Remove attachment button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveAttachment(att.id);
                  }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-secondary hover:bg-destructive border border-border text-muted-foreground hover:text-destructive-foreground flex items-center justify-center transition-all cursor-pointer shadow-sm z-20"
                  title={t("removeAttachment")}
                  aria-label={t("removeAttachment")}
                >
                  <X className="w-2.5 h-2.5 stroke-[2.5]" />
                </button>
              </div>
            );
          })}

          {attachments.length < MAX_ATTACHMENTS && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-xl border border-dashed border-border hover:border-foreground/40 text-muted-foreground hover:text-foreground flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer text-[10px] select-none"
              title={t("addMediaWithCount", { count: attachments.length, max: MAX_ATTACHMENTS })}
            >
              <Plus className="w-4 h-4 text-muted-foreground" />
              <span className="font-sans tabular-nums text-[8px] text-muted-foreground">
                {attachments.length}/{MAX_ATTACHMENTS}
              </span>
            </button>
          )}
        </div>
      </ScrollArea>
    );
  };

  return (
    <div className="w-full select-none font-sans">
      {renderFileInput()}

      {/* Active Slash Skills Suggestion Bar on Mobile */}
      {slashSkills.length > 0 && (
        <div className="mb-2 w-full overflow-hidden">
          <ScrollArea orientation="horizontal" className="w-full">
            <div className="flex items-center gap-1.5 px-0.5 py-1 w-max">
              {slashSkills.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelectSlashSkill(s.slug)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-xs text-foreground cursor-pointer active:scale-95 transition-all shadow-2xs"
                >
                  <PencilSparkles className="w-3 h-3 text-primary shrink-0" />
                  <span className="font-semibold font-mono text-[11px]">/{s.slug}</span>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                    {s.name}
                  </span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      <div
        className={cn(
          "w-full bg-card border border-border transition-[border-color,padding] duration-150 shadow-xs rounded-[24px]",
          isMultiline
            ? "p-2.5 sm:p-3"
            : "px-2.5 py-1.5 min-h-[48px]"
        )}
        style={{
          display: "grid",
          gridTemplateAreas: attachments.length > 0
            ? '"shelf shelf shelf" "input input input" "plus . actions"'
            : isMultiline
            ? '"input input input" "plus . actions"'
            : '"plus input actions"',
          gridTemplateColumns: "auto 1fr auto",
          alignItems: isMultiline ? "stretch" : "center",
          rowGap: isMultiline ? "0.5rem" : "0",
          columnGap: "0.5rem",
        }}
      >
        {/* Attachments Shelf */}
        {attachments.length > 0 && (
          <div style={{ gridArea: "shelf" }} className="w-full overflow-hidden">
            {renderAttachmentsShelf()}
          </div>
        )}

        {/* Textarea - Persistent across single-line & multi-line modes (NEVER UNMOUNTED) */}
        <div style={{ gridArea: "input" }} className="min-w-0 w-full flex items-center">
          <textarea
            ref={textareaRef}
            rows={isMultiline ? 2 : 1}
            value={inputMessage}
            onChange={(e) => handleInputChange(e.target.value)}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (text.includes("\n") || text.length > 60) {
                setIsMultiline(true);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              isStreaming
                ? t("waitingResponse")
                : t("askModel", { model: selectedModelName || "Const" })
            }
            className={cn(
              "w-full bg-transparent text-[15px] sm:text-[15px] text-foreground placeholder:text-muted-foreground outline-none focus:outline-none focus:ring-0 resize-none font-sans block transition-[height] duration-200 ease-out",
              isMultiline
                ? "leading-5 py-1 min-h-[44px] max-h-36 overflow-y-auto px-1"
                : "leading-6 py-0.5 h-[28px] max-h-[28px] overflow-hidden px-1.5"
            )}
            style={{
              height: isMultiline ? undefined : `${SINGLE_LINE_HEIGHT}px`,
            }}
          />
        </div>

        {/* Plus Button */}
        <div style={{ gridArea: "plus" }} className="shrink-0 self-center flex items-center">
          {renderPlusButton()}
        </div>

        {/* Right Action Items: Source count & Send button */}
        <div style={{ gridArea: "actions" }} className="flex items-center gap-1.5 shrink-0 justify-self-end self-center">
          {renderSourceBadge()}
          {renderSendButton()}
        </div>
      </div>
    </div>
  );
}
