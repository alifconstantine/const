import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, FileText } from "lucide-react";

export interface ImageLightboxProps {
  src: string;
  alt: string;
  type?: "image" | "video" | "pdf" | "code" | "document" | "other";
  fileSize?: number;
  imageIndex?: number;
  onClose: () => void;
}

export function ImageLightbox({
  src,
  alt,
  type = "image",
  imageIndex,
  onClose,
}: ImageLightboxProps) {
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-150 select-none"
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Media preview"}
      onClick={onClose}
    >
      <div
        className="relative max-w-[90vw] max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex items-center justify-center bg-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top-left Title / Filename Badge */}
        {alt && (
          <div className="absolute top-3 left-3 z-30 flex items-center gap-2 max-w-[calc(100%-80px)] pointer-events-none">
            <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-xs text-white/90 truncate max-w-[280px] border border-white/10 shadow-md font-sans">
              {alt}
            </span>
          </div>
        )}

        {/* Top-right X button */}
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white/90 hover:text-white flex items-center justify-center transition-colors shadow-lg cursor-pointer border border-white/20"
          title="Close (Esc)"
          aria-label="Close"
        >
          <X className="w-4 h-4 stroke-[2.5]" />
        </button>

        {isImage ? (
          <img
            src={src}
            alt={alt}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-2xl shadow-2xl block border border-white/10"
          />
        ) : isVideo ? (
          <div className="max-w-[90vw] max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl bg-black border border-white/10">
            <video
              src={src}
              controls
              autoPlay
              playsInline
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-2xl"
            />
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-3 text-card-foreground">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-primary">
              <FileText className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-foreground truncate max-w-[240px]" title={alt}>
              {alt}
            </span>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
