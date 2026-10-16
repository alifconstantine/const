import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, FileText } from "lucide-react";
import { useTranslation } from "../../lib/i18n";

export interface ImageLightboxProps {
  src: string;
  alt: string;
  type?: "image" | "video" | "pdf" | "markdown" | "code" | "document" | "other";
  fileSize?: number;
  onClose: () => void;
}

export function ImageLightbox({
  src,
  alt,
  type = "image",
  onClose,
}: ImageLightboxProps) {
  const { t } = useTranslation();
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const isVideo = type === "video";
  const isImage = type === "image";

  useEffect(() => {
    closeBtnRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 sm:p-6 animate-in fade-in duration-150 select-none"
      role="dialog"
      aria-modal="true"
      aria-label={alt || t("workbench.mediaPreview")}
      onClick={onClose}
    >
      {/* Pop-up Media Container with only top-right X button */}
      <div
        className="relative max-w-[85vw] max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex items-center justify-center bg-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top-right X button */}
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          className="absolute top-2.5 right-2.5 z-30 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white/90 hover:text-white flex items-center justify-center transition-colors shadow-lg cursor-pointer border border-white/10"
          title={t("workbench.closeEsc")}
          aria-label={t("common.close")}
        >
          <X className="w-4 h-4 stroke-[2.5]" />
        </button>

        {isImage ? (
          <img
            src={src}
            alt={alt}
            className="max-w-[85vw] max-h-[85vh] object-contain rounded-2xl shadow-2xl block border border-white/10"
          />
        ) : isVideo ? (
          <div className="max-w-[85vw] max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl bg-black border border-white/10">
            <video
              src={src}
              controls
              autoPlay
              playsInline
              className="max-w-[85vw] max-h-[85vh] object-contain rounded-2xl"
            />
          </div>
        ) : (
          <div className="bg-[#1e1e1e] border border-[#383838] rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#2a2a2a] flex items-center justify-center text-[#ff7a00]">
              <FileText className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-white truncate max-w-[240px]" title={alt}>
              {alt}
            </span>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
