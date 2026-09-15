import React, { useState } from "react";
import {
  Globe,
  FileText,
  FileSpreadsheet,
  FileCode,
  BookOpen,
  HardDrive,
  ClipboardPaste,
} from "lucide-react";
import { cn } from "@const/ui";

export interface SourceIconProps {
  source: {
    type?: string;
    url?: string;
    title?: string;
    path?: string;
  };
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * YouTube Icon rendered using exact SVG provided by user
 */
export function YouTubeSvgIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 180"
      preserveAspectRatio="xMidYMid"
      className={className}
    >
      <path
        fill="#FF0000"
        d="M250.346 28.075A32.18 32.18 0 0 0 227.69 5.418C207.824 0 127.87 0 127.87 0S47.912.164 28.046 5.582A32.18 32.18 0 0 0 5.39 28.24c-6.009 35.298-8.34 89.084.165 122.97a32.18 32.18 0 0 0 22.656 22.657c19.866 5.418 99.822 5.418 99.822 5.418s79.955 0 99.82-5.418a32.18 32.18 0 0 0 22.657-22.657c6.338-35.348 8.291-89.1-.164-123.134Z"
      />
      <path fill="#FFF" d="m102.421 128.06 66.328-38.418-66.328-38.418z" />
    </svg>
  );
}

/**
 * Extract clean hostname from a given URL
 */
export function getDomainFromUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const raw = url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
    const parsed = new URL(raw);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Check if a URL or source is YouTube
 */
export function isYouTubeSource(type?: string, url?: string): boolean {
  if (type === "youtube") return true;
  if (!url) return false;
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i.test(url);
}

/**
 * Detect document classification based on filename / path extension
 */
export function getDocumentClassification(title: string = "", path: string = ""): {
  kind: "pdf" | "word" | "sheet" | "code" | "markdown" | "other";
  label: string;
} {
  const name = (path || title).toLowerCase();
  const ext = name.split(".").pop() || "";

  if (ext === "pdf") return { kind: "pdf", label: "PDF" };
  if (["doc", "docx", "odt", "rtf"].includes(ext)) return { kind: "word", label: "Word" };
  if (["xls", "xlsx", "csv", "tsv"].includes(ext)) return { kind: "sheet", label: "Sheet" };
  if (["js", "jsx", "ts", "tsx", "py", "html", "css", "json", "sql", "sh", "rs", "cpp", "c", "java"].includes(ext)) {
    return { kind: "code", label: ext.toUpperCase() };
  }
  if (["md", "markdown"].includes(ext)) return { kind: "markdown", label: "Markdown" };
  return { kind: "other", label: "File" };
}

/**
 * Get human-readable source label/category for list subtitles
 */
export function getSourceCategoryLabel(source: {
  type?: string;
  url?: string;
  title?: string;
  path?: string;
}): string {
  if (isYouTubeSource(source.type, source.url)) return "YouTube";
  if (source.type === "text") return "Pasted text";
  if (source.type === "book") return "Book";
  if (source.type === "drive") return "Drive";

  if (source.url) {
    const domain = getDomainFromUrl(source.url);
    if (domain) return domain;
  }

  if (source.type === "file" || (!source.url && source.title)) {
    return getDocumentClassification(source.title, source.path).label;
  }

  return source.type || "Source";
}

export function SourceIcon({ source, size = "md", className }: SourceIconProps) {
  const [faviconError, setFaviconError] = useState(false);

  const containerSizes = {
    sm: "h-6 w-6 rounded-lg",
    md: "h-7 w-7 rounded-lg",
    lg: "h-8 w-8 rounded-xl",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  };

  const imageSizes = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-4.5 w-4.5",
  };

  const cSize = containerSizes[size];
  const iSize = iconSizes[size];
  const imgSize = imageSizes[size];

  // 1. YouTube Source
  if (isYouTubeSource(source.type, source.url)) {
    return (
      <div
        className={cn(
          cSize,
          "bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center shrink-0",
          className
        )}
      >
        <YouTubeSvgIcon className={cn(iSize, "shrink-0")} />
      </div>
    );
  }

  // 2. Pasted Text Source
  if (source.type === "text") {
    return (
      <div
        className={cn(
          cSize,
          "bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0",
          className
        )}
      >
        <ClipboardPaste className={cn(iSize, "shrink-0")} />
      </div>
    );
  }

  // 3. Web URL or Docs with domain -> Fetch Favicon with fallback
  if (source.url || source.type === "url" || source.type === "docs") {
    const domain = getDomainFromUrl(source.url);

    if (domain && !faviconError) {
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
      return (
        <div
          className={cn(
            cSize,
            "bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 overflow-hidden",
            className
          )}
        >
          <img
            src={faviconUrl}
            alt={domain}
            className={cn(imgSize, "object-contain rounded-xs")}
            onError={() => setFaviconError(true)}
            loading="lazy"
          />
        </div>
      );
    }

    // Callback fallback when favicon doesn't exist / fails
    return (
      <div
        className={cn(
          cSize,
          source.type === "docs"
            ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-400"
            : "bg-blue-500/10 border border-blue-500/20 text-blue-400",
          "flex items-center justify-center shrink-0",
          className
        )}
      >
        <Globe className={cn(iSize, "shrink-0")} />
      </div>
    );
  }

  // 4. Book
  if (source.type === "book") {
    return (
      <div
        className={cn(
          cSize,
          "bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0",
          className
        )}
      >
        <BookOpen className={cn(iSize, "shrink-0")} />
      </div>
    );
  }

  // 5. Cloud Drive
  if (source.type === "drive") {
    return (
      <div
        className={cn(
          cSize,
          "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0",
          className
        )}
      >
        <HardDrive className={cn(iSize, "shrink-0")} />
      </div>
    );
  }

  // 6. Documents depending on document type (PDF, Word, Sheet, Code, Markdown, etc.)
  const docInfo = getDocumentClassification(source.title, source.path);

  switch (docInfo.kind) {
    case "pdf":
      return (
        <div
          className={cn(
            cSize,
            "bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shrink-0",
            className
          )}
          title="PDF Document"
        >
          <FileText className={cn(iSize, "text-rose-500 shrink-0")} />
        </div>
      );
    case "word":
      return (
        <div
          className={cn(
            cSize,
            "bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0",
            className
          )}
          title="Word Document"
        >
          <FileText className={cn(iSize, "text-blue-400 shrink-0")} />
        </div>
      );
    case "sheet":
      return (
        <div
          className={cn(
            cSize,
            "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0",
            className
          )}
          title="Spreadsheet Document"
        >
          <FileSpreadsheet className={cn(iSize, "text-emerald-400 shrink-0")} />
        </div>
      );
    case "code":
      return (
        <div
          className={cn(
            cSize,
            "bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0",
            className
          )}
          title="Source Code File"
        >
          <FileCode className={cn(iSize, "text-indigo-400 shrink-0")} />
        </div>
      );
    case "markdown":
      return (
        <div
          className={cn(
            cSize,
            "bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0",
            className
          )}
          title="Markdown Document"
        >
          <FileText className={cn(iSize, "text-sky-400 shrink-0")} />
        </div>
      );
    default:
      return (
        <div
          className={cn(
            cSize,
            "bg-muted border border-border/50 text-muted-foreground flex items-center justify-center shrink-0",
            className
          )}
        >
          <FileText className={cn(iSize, "shrink-0")} />
        </div>
      );
  }
}
