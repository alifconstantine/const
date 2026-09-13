import React, { useRef, useEffect, useState } from "react";
import {
  ArrowUp,
  Square,
  Plus,
  Layers,
  X,
  FileText,
  Video,
} from "lucide-react";
import { ScrollArea, cn } from "@const/ui";
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
  const { t } = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local attachments fallback if not controlled externally
  const [internalAttachments, setInternalAttachments] = useState<AttachedMedia[]>([]);
  const attachments = externalAttachments ?? internalAttachments;
  const [isMultiline, setIsMultiline] = useState(false);
  const [textareaHeight, setTextareaHeight] = useState<number>(24);

  const updateAttachments = (next: AttachedMedia[]) => {
    if (onAttachmentsChange) {
      onAttachmentsChange(next);
    } else {
      setInternalAttachments(next);
    }
  };

  // Determine if input should be single-line pill (Image 2) or multiline card (Image 3)
  useEffect(() => {
    if (attachments.length > 0) {
      setIsMultiline(true);
      return;
    }

    if (!inputMessage) {
      setIsMultiline(false);
      setTextareaHeight(24);
      return;
    }

    const hasNewline = inputMessage.includes("\n");
    const textarea = textareaRef.current;

    if (hasNewline) {
      setIsMultiline(true);
      if (textarea) {
        textarea.style.height = "auto";
        const nextHeight = Math.min(textarea.scrollHeight, 140);
        setTextareaHeight(nextHeight);
        textarea.style.height = `${nextHeight}px`;
      }
      return;
    }

    if (!textarea) return;

    // Measure scrollHeight
    textarea.style.height = "auto";
    const scHeight = textarea.scrollHeight;

    if (scHeight > 34) {
      setIsMultiline(true);
      const nextHeight = Math.min(scHeight, 140);
      setTextareaHeight(nextHeight);
      textarea.style.height = `${nextHeight}px`;
    } else {
      setIsMultiline(false);
      setTextareaHeight(24);
      textarea.style.height = "24px";
    }
  }, [inputMessage, attachments.length]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && (inputMessage.trim() || attachments.length > 0)) {
        onSend(undefined, attachments);
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
  const renderSourceBadge = () => (
    <button
      type="button"
      onClick={onOpenSources}
      className="inline-flex items-center gap-1 px-1.5 py-1 rounded-full text-xs text-[#888888] hover:text-[#d4d4d4] transition-colors cursor-pointer select-none"
      title={t("learningSources")}
      aria-label={t("learningSources")}
    >
      <Layers className="w-3.5 h-3.5 text-[#888888]" />
      <span className="font-mono text-[11px] text-[#888888]">{sourcesCount}</span>
    </button>
  );

  // Render send or stop action button
  const renderSendButton = () => {
    if (isStreaming) {
      return (
        <button
          type="button"
          onClick={onStop}
          className="w-8 h-8 rounded-full bg-[#383838] hover:bg-[#48484e] text-[#f87171] hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-[#48484e] shrink-0"
          title={t("stopGenerating")}
          aria-label={t("stopGenerating")}
        >
          <Square className="w-3 h-3 fill-current" />
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => onSend(undefined, attachments)}
        disabled={!canSend}
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-150 shrink-0 select-none",
          canSend
            ? "bg-[#d4d4d4] text-[#161616] hover:bg-white cursor-pointer active:scale-95 shadow-sm"
            : "bg-[#2b2b2b] text-[#555555] cursor-not-allowed border border-[#383838]"
        )}
        title={t("sendMessage")}
        aria-label={t("sendMessage")}
      >
        <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
      </button>
    );
  };

  return (
    <div className="w-full select-none font-sans">
      {renderFileInput()}

      {!isMultiline ? (
        /* STATE 1: Sleek Single-Line Pill (Matches Image 2) - No morphing animation */
        <div className="w-full bg-[#1e1e1e] rounded-full border border-[#333333] px-2.5 py-1.5 flex items-center gap-2 transition-colors duration-150 focus-within:border-[#555555] shadow-xs">
          {/* Left Plus icon button */}
          <button
            type="button"
            disabled={isMaxReached}
            onClick={() => {
              if (!isMaxReached) {
                fileInputRef.current?.click();
              }
            }}
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center transition-colors shrink-0",
              isMaxReached
                ? "opacity-35 cursor-not-allowed text-[#666666]"
                : "hover:bg-[#2b2b2b] text-[#888888] hover:text-[#e0e0e0] cursor-pointer"
            )}
            title={
              isMaxReached
                ? t("maxAttachmentsReached", { count: MAX_ATTACHMENTS })
                : t("addMediaOrDoc")
            }
            aria-label={t("addMediaOrDoc")}
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* 1-Line Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputMessage}
            onChange={(e) => onChangeInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isStreaming
                ? t("waitingResponse")
                : t("askModel", { model: selectedModelName || "Const" })
            }
            className="flex-1 bg-transparent text-[14px] leading-5 text-[#ececec] placeholder:text-[#666666] outline-none resize-none py-1 px-1 font-sans max-h-7 overflow-hidden block"
          />

          {/* Right Action Items: Source count & Send button */}
          <div className="flex items-center gap-2 shrink-0">
            {renderSourceBadge()}
            {renderSendButton()}
          </div>
        </div>
      ) : (
        /* STATE 2: Expanded Multiline Card with ScrollArea (Matches Image 3) - No morphing animation */
        <div className="w-full bg-[#1e1e1e] rounded-[24px] border border-[#333333] p-2.5 sm:p-3 flex flex-col gap-2 transition-colors duration-150 focus-within:border-[#555555] shadow-xs">
          {/* Attachments Shelf */}
          {attachments.length > 0 && (
            <ScrollArea orientation="horizontal" className="w-full">
              <div className="flex items-center gap-2 px-2 pt-2.5 pb-2 select-none w-max">
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
                        "relative group shrink-0 rounded-xl border border-[#383838] bg-[#1a1917] shadow-xs select-none",
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
                          <Video className="w-5 h-5 text-[#969696]" />
                          <span className="absolute bottom-1 right-1 text-[7px] font-mono bg-black/70 text-white px-1 rounded uppercase font-bold">
                            VID
                          </span>
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-[8.5px] text-white font-medium truncate leading-tight px-0.5">
                              {att.name}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full p-1.5 flex flex-col justify-between rounded-xl bg-[#262626]/80 text-left">
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-bold text-[#888888] font-mono uppercase">
                              {ext}
                            </span>
                            <FileText className="w-3 h-3 text-[#0066ff] shrink-0" />
                          </div>
                          <div className="w-full flex-1 my-0.5 min-h-0 overflow-hidden">
                            <ScrollArea className="w-full h-full max-h-[30px] sm:max-h-[36px]">
                              <span className="text-[9.5px] font-medium text-[#d4d4d4] leading-tight break-words block pr-1">
                                {att.name}
                              </span>
                            </ScrollArea>
                          </div>
                          <span className="text-[7.5px] text-[#777777] font-mono block truncate">
                            {formatFileSize(att.size)}
                          </span>
                        </div>
                      )}

                      {/* Hover tooltip tag showing filename */}
                      <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 z-30 px-2 py-0.5 bg-[#2a2a2a] text-[#ededed] text-[9.5px] font-sans rounded-md shadow-lg border border-[#444444] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap max-w-[180px] truncate">
                        {att.name}
                      </div>

                      {/* Remove attachment button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveAttachment(att.id);
                        }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#2b2b2b] hover:bg-[#e11d48] border border-[#444444] text-[#a9a9a9] hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-sm z-20"
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
                    className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-xl border border-dashed border-[#383838] hover:border-[#666666] text-[#888888] hover:text-[#d4d4d4] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer text-[10px] select-none"
                    title={t("addMediaWithCount", { count: attachments.length, max: MAX_ATTACHMENTS })}
                  >
                    <Plus className="w-4 h-4 text-[#888888]" />
                    <span className="font-mono text-[8px] text-[#777777]">
                      {attachments.length}/{MAX_ATTACHMENTS}
                    </span>
                  </button>
                )}
              </div>
            </ScrollArea>
          )}

          {/* Auto-growing Textarea bounded by ScrollArea */}
          <ScrollArea className="w-full max-h-36 [&>div>div[style]]:!block px-1">
            <textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={(e) => onChangeInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder={
                isStreaming
                  ? t("waitingResponse")
                  : t("askModel", { model: selectedModelName || "Const" })
              }
              className="w-full bg-transparent text-[14px] leading-5 text-[#ececec] placeholder:text-[#666666] outline-none resize-none py-1 px-0.5 font-sans overflow-hidden block"
              style={{ height: `${Math.max(textareaHeight, 44)}px` }}
            />
          </ScrollArea>

          {/* Bottom Action Row: Plus on Left, Sources & Send on Right */}
          <div className="flex items-center justify-between pt-0.5 px-0.5 min-w-0">
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
                  ? "opacity-35 cursor-not-allowed text-[#666666]"
                  : "hover:bg-[#2b2b2b] text-[#888888] hover:text-[#e0e0e0] cursor-pointer"
              )}
              title={
                isMaxReached
                  ? t("maxAttachmentsReached", { count: MAX_ATTACHMENTS })
                  : t("addMediaOrDoc")
              }
              aria-label={t("addMediaOrDoc")}
            >
              <Plus className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 shrink-0">
              {renderSourceBadge()}
              {renderSendButton()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
