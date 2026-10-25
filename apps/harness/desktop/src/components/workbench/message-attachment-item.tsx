import React, { useState } from "react";
import { Play } from "lucide-react";
import { FileIcon } from "./file-icon";
import { formatFileSize, type AttachedFile } from "./chat-card";

export interface MessageAttachmentItemProps {
  att: AttachedFile;
  onPreview?: (att: AttachedFile) => void;
}

export function MessageAttachmentItem({ att, onPreview }: MessageAttachmentItemProps) {
  const getInitialSrc = (): string => {
    if (att.path) {
      return `const-file://${att.path.replace(/\\/g, "/")}`;
    }
    if (att.url && !att.url.startsWith("blob:")) {
      return att.url;
    }
    if (att.base64) {
      return att.base64;
    }
    return att.url || "";
  };

  const [src, setSrc] = useState<string>(getInitialSrc);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (att.base64 && src !== att.base64) {
      setSrc(att.base64);
    } else if (att.path && window.electron?.readAsDataUrl) {
      window.electron
        .readAsDataUrl(att.path)
        .then((res) => {
          if (res.success && res.dataUrl) {
            setSrc(res.dataUrl);
          } else {
            setHasError(true);
          }
        })
        .catch(() => setHasError(true));
    } else {
      setHasError(true);
    }
  };

  if (att.type === "image" && !hasError && src) {
    return (
      <div
        key={att.id}
        onClick={() => onPreview?.(att)}
        className="group relative rounded-xl overflow-hidden border border-[#e2e2e4] dark:border-[#383838] hover:border-black/30 dark:hover:border-white/30 bg-[#f4f4f6] dark:bg-black/40 max-w-sm max-h-72 shadow-md cursor-pointer transition-all select-none"
      >
        <img
          src={src}
          alt={att.name}
          onError={handleError}
          className="w-full h-full object-contain max-h-72"
        />
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-white pointer-events-none">
          <p className="truncate font-medium">{att.name}</p>
          <span className="text-[10px] text-[#a0a0a0] font-sans tabular-nums">
            {formatFileSize(att.size)}
          </span>
        </div>
      </div>
    );
  }

  if (att.type === "video" && (att.url || att.path)) {
    const videoSrc = att.path ? `const-file://${att.path.replace(/\\/g, "/")}` : att.url;
    return (
      <div
        key={att.id}
        onClick={() => onPreview?.(att)}
        className="group relative rounded-xl overflow-hidden border border-[#e2e2e4] dark:border-[#383838] hover:border-black/30 dark:hover:border-white/30 bg-black max-w-sm max-h-72 shadow-md cursor-pointer transition-all select-none"
      >
        <video
          src={videoSrc}
          className="w-full h-full max-h-72 rounded-xl pointer-events-none"
        />
        <div className="absolute inset-0 bg-black/25 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white">
            <Play className="w-5 h-5 fill-white ml-0.5" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      key={att.id}
      onClick={() => onPreview?.(att)}
      className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white dark:bg-[#1e1e1e] hover:bg-[#f4f4f6] dark:hover:bg-[#252525] border border-[#e2e2e4] dark:border-[#383838] hover:border-black/20 dark:hover:border-white/20 text-xs text-[#262626] dark:text-[#d4d4d4] shadow-sm cursor-pointer transition-all select-none"
    >
      <FileIcon filename={att.name} className="w-4 h-4 shrink-0" />
      <div className="flex flex-col min-w-0">
        <span className="font-medium truncate max-w-[200px]" title={att.name}>
          {att.name}
        </span>
        <span className="text-[10px] text-[#a9a9a9] dark:text-[#777777] font-sans tabular-nums">
          {formatFileSize(att.size)}
        </span>
      </div>
    </div>
  );
}
