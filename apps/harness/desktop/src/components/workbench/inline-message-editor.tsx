import React, { useState, useRef, useEffect } from "react";
import { Plus, X, ArrowUp, FileText, Image as ImageIcon, Video, Code, FileCode } from "lucide-react";
import { ScrollArea, cn } from "@const/ui";
import { parseUploadedFiles, type AttachedFile } from "./chat-card";
import { useTranslation } from "../../lib/i18n";

export interface InlineMessageEditorProps {
  initialContent: string;
  initialAttachments?: AttachedFile[];
  onSubmit: (newContent: string, attachments?: AttachedFile[]) => void;
  onCancel: () => void;
  userBubbleWidthClass?: string;
}

export function InlineMessageEditor({
  initialContent,
  initialAttachments = [],
  onSubmit,
  onCancel,
  userBubbleWidthClass = "max-w-[85%] sm:max-w-[78%] md:max-w-[72%]",
}: InlineMessageEditorProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState(initialContent);
  const [attachments, setAttachments] = useState<AttachedFile[]>(initialAttachments);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Focus textarea and set cursor at the end on mount, auto-resize height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
      adjustHeight();
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      const savedScrollTop = viewportRef.current?.scrollTop;
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.max(48, textareaRef.current.scrollHeight)}px`;
      if (viewportRef.current && savedScrollTop !== undefined) {
        viewportRef.current.scrollTop = savedScrollTop;
      }
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    adjustHeight();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleFinalSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const handleFinalSubmit = () => {
    if (!content.trim() && attachments.length === 0) return;
    onSubmit(content.trim(), attachments);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      const newAttached = await parseUploadedFiles(files);
      setAttachments((prev) => [...prev, ...newAttached]);
    } catch {}
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => {
      const item = prev.find((a) => a.id === id);
      if (item?.url && item.url.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(item.url);
        } catch {}
      }
      return prev.filter((a) => a.id !== id);
    });
  };

  return (
    <div
      className={cn(
        "w-full rounded-2xl bg-[#f0f0f0] dark:bg-[#1f1f1f] border border-[#d5d5d9] dark:border-[#383838] p-3 text-[14px] shadow-sm flex flex-col gap-2.5 transition-all duration-150 animate-in fade-in zoom-in-[0.99]",
        userBubbleWidthClass
      )}
    >
      {/* Attached Media List (if any) */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-1">
          {attachments.map((att) => {
            const isImg = att.type === "image" && (att.url || att.base64);
            return (
              <div
                key={att.id}
                className="relative group flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs text-[#262626] dark:text-[#d4d4d4]"
              >
                {isImg ? (
                  <img
                    src={att.url || att.base64}
                    alt={att.name}
                    className="w-5 h-5 object-cover rounded"
                  />
                ) : att.type === "video" ? (
                  <Video className="w-3.5 h-3.5 text-blue-500" />
                ) : att.type === "code" ? (
                  <Code className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-neutral-400" />
                )}
                <span className="max-w-[120px] truncate">{att.name}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(att.id)}
                  className="p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-[#777777] dark:text-[#888888] hover:text-red-500 transition-colors cursor-pointer"
                  title="Remove attachment"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Scrollable Textarea with ScrollArea */}
      <ScrollArea
        viewportRef={viewportRef}
        className="w-full max-h-[280px] sm:max-h-[340px]"
        viewportClassName="[&>div[style]]:!block"
      >
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          placeholder={t("workbench.editPromptPlaceholder")}
          rows={1}
          className="w-full bg-transparent resize-none outline-none border-0 text-[#262626] dark:text-[#ececec] text-[14px] leading-relaxed placeholder-[#888888] dark:placeholder-[#666666] min-h-[48px] overflow-hidden pr-2"
        />
      </ScrollArea>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Bottom Action Bar */}
      <div className="flex items-center justify-between select-none">
        {/* Left: Add Attachment */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-1.5 rounded-lg text-[#777777] dark:text-[#888888] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center"
          title={t("workbench.addAttachment")}
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Right: Cancel & Submit Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-[#777777] dark:text-[#888888] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center"
            title={`${t("common.cancel")} (Esc)`}
          >
            <X className="w-4 h-4" />
          </button>

          <button
            type="button"
            disabled={!content.trim() && attachments.length === 0}
            onClick={handleFinalSubmit}
            className="w-7 h-7 rounded-lg bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
            title={t("workbench.sendEditedPrompt")}
          >
            <ArrowUp className="w-4 h-4 stroke-[2.2]" />
          </button>
        </div>
      </div>
    </div>
  );
}
