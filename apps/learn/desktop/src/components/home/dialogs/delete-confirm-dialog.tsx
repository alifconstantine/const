import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from "@const/ui";
import { AlertTriangle, Trash2, RotateCw, FileText } from "lucide-react";
import { useI18n } from "../../../lib/i18n";
import { LearnIcon } from "../learn-icon";

export interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onConfirm: () => Promise<void>;
  itemPreview?: {
    title: string;
    description?: string;
    emoji?: string;
    sourcesCount?: number;
    badge?: string;
  };
  warningText?: string;
  confirmButtonText?: string;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  itemPreview,
  warningText,
  confirmButtonText,
}: DeleteConfirmDialogProps) {
  const { t } = useI18n();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to delete item:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[420px] p-5 sm:p-6 rounded-2xl border border-[#383838] bg-[#222222] text-[#d4d4d4] shadow-none overflow-hidden outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0">
        <DialogHeader className="pb-1 text-left">
          <div className="flex items-center gap-3.5 mb-1">
            <div className="h-10 w-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shrink-0">
              <Trash2 className="w-5 h-5 stroke-[1.8]" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="font-sans text-base font-medium tracking-tight text-white">
                {title}
              </DialogTitle>
              {description && !warningText && (
                <DialogDescription className="text-xs text-[#969696] pt-0.5 leading-relaxed font-sans">
                  {description}
                </DialogDescription>
              )}
              {warningText && (
                <DialogDescription className="sr-only">
                  {warningText}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        {itemPreview && (
          <div className="my-2 p-3 rounded-xl bg-[#2b2b2b] border border-[#383838] flex items-center gap-3 select-none">
            <div className="h-9 w-9 rounded-xl bg-[#222222] border border-[#383838] flex items-center justify-center text-white shrink-0 shadow-2xs">
              <LearnIcon icon={itemPreview.emoji || "book"} className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-medium text-white truncate font-sans">
                {itemPreview.title}
              </h4>
              {itemPreview.description ? (
                <p className="text-[11px] text-[#969696] truncate font-sans mt-0.5">
                  {itemPreview.description}
                </p>
              ) : typeof itemPreview.sourcesCount === "number" ? (
                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[#969696] font-sans">
                  <FileText className="w-3 h-3 text-[#969696]" />
                  <span>
                    {itemPreview.sourcesCount === 1
                      ? t("sourcesCountSingle")
                      : t("sourcesCount", { count: itemPreview.sourcesCount })}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {warningText && (
          <div className="my-2 px-3 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-rose-400 select-none">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <p className="text-[11px] text-rose-300/90 leading-relaxed font-sans">
              {warningText}
            </p>
          </div>
        )}

        <DialogFooter className="pt-3 gap-2 sm:gap-2 flex sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="rounded-xl cursor-pointer h-9 px-4 text-xs font-sans font-medium border-[#383838] bg-[#2b2b2b] text-[#d4d4d4] hover:text-white hover:bg-[#383838] transition-colors"
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="rounded-xl cursor-pointer h-9 px-4 text-xs font-medium font-sans bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 shadow-none transition-colors"
          >
            {isDeleting ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>{t("deleting")}</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>{confirmButtonText || t("delete")}</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
