import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Link as LinkIcon,
  Code,
  List,
  ListOrdered,
  Quote,
  Minus,
  RemoveFormatting,
  Trash2,
  BookmarkPlus,
  Copy,
  Check,
  Download,
  Wand2,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  cn,
  toast,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@const/ui";
import { marked } from "marked";
import { localDb, type LocalArtifact } from "../../lib/db";
import { useI18n } from "../../lib/i18n";

export interface MobileNoteViewerProps {
  artifact: LocalArtifact;
  onClose: () => void;
  onExplainInChat?: (prompt: string) => void;
  onDeleteArtifact?: (artId: string) => void;
  onConvertToSource?: (art: LocalArtifact) => void;
  onGenerateNote?: (art: LocalArtifact) => void;
}

/**
 * Converts Markdown string into styled HTML for rich contentEditable editor
 */
function markdownToHtml(md: string): string {
  if (!md || !md.trim()) return "";
  try {
    const raw = marked.parse(md, { gfm: true, breaks: true });
    return typeof raw === "string" ? raw : "";
  } catch {
    return md;
  }
}

function serializeTableCell(cell: HTMLElement): string {
  function serializeInline(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent || "").replace(/\|/g, "\\|");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const children = Array.from(el.childNodes).map(serializeInline).join("");
    switch (tag) {
      case "strong":
      case "b":
        return `**${children}**`;
      case "em":
      case "i":
        return `*${children}*`;
      case "code":
        return `\`${children}\``;
      case "a":
        return `[${children}](${el.getAttribute("href") || "#"})`;
      case "br":
        return " ";
      default:
        return children;
    }
  }
  return Array.from(cell.childNodes).map(serializeInline).join("").replace(/\n+/g, " ").trim();
}

function serializeTable(tableEl: HTMLElement): string {
  const rows = Array.from(tableEl.querySelectorAll("tr"));
  if (rows.length === 0) return "";

  const tableData: string[][] = [];
  let maxCols = 0;

  rows.forEach((row) => {
    const cells = Array.from(row.querySelectorAll("th, td"));
    const rowData = cells.map((cell) => serializeTableCell(cell as HTMLElement));
    if (rowData.length > maxCols) maxCols = rowData.length;
    tableData.push(rowData);
  });

  if (maxCols === 0 || tableData.length === 0 || !tableData[0]) return "";

  tableData.forEach((row) => {
    while (row.length < maxCols) row.push("");
  });

  const lines: string[] = [];
  const headerRow = tableData[0];
  if (!headerRow) return "";
  lines.push(`| ${headerRow.join(" | ")} |`);
  lines.push(`| ${headerRow.map(() => "---").join(" | ")} |`);

  for (let i = 1; i < tableData.length; i++) {
    const row = tableData[i];
    if (row) {
      lines.push(`| ${row.join(" | ")} |`);
    }
  }

  return `\n\n${lines.join("\n")}\n\n`;
}

/**
 * Converts rich contentEditable DOM nodes into clean standard Markdown
 */
function htmlToMarkdown(element: HTMLElement | null): string {
  if (!element) return "";

  const text = element.innerText || element.textContent || "";
  if (!text.trim() && !element.querySelector("img, hr, br, table")) {
    return "";
  }

  function serialize(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || "";
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const children = Array.from(el.childNodes).map(serialize).join("");

    switch (tag) {
      case "h1":
        return `\n\n# ${children.trim()}\n\n`;
      case "h2":
        return `\n\n## ${children.trim()}\n\n`;
      case "h3":
        return `\n\n### ${children.trim()}\n\n`;
      case "h4":
        return `\n\n#### ${children.trim()}\n\n`;
      case "h5":
        return `\n\n##### ${children.trim()}\n\n`;
      case "h6":
        return `\n\n###### ${children.trim()}\n\n`;
      case "p":
        return children.trim() ? `\n\n${children.trim()}\n\n` : "\n";
      case "strong":
      case "b":
        return children.trim() ? `**${children}**` : "";
      case "em":
      case "i":
        return children.trim() ? `*${children}*` : "";
      case "s":
      case "strike":
      case "del":
        return children.trim() ? `~~${children}~~` : "";
      case "code": {
        if (el.parentElement?.tagName.toLowerCase() === "pre") {
          return children;
        }
        return children.trim() ? `\`${children}\`` : "";
      }
      case "pre": {
        const codeChild = el.querySelector("code");
        let lang = "";
        if (codeChild) {
          const match = codeChild.className.match(/(?:language-|lang-)(\w+)/);
          if (match && match[1]) lang = match[1];
        }
        return `\n\n\`\`\`${lang}\n${children.trim()}\n\`\`\`\n\n`;
      }
      case "table":
        return serializeTable(el);
      case "thead":
      case "tbody":
      case "tfoot":
      case "tr":
      case "th":
      case "td":
        return el.closest("table") ? "" : children;
      case "ul": {
        const items = Array.from(el.children)
          .map((child) => `- ${serialize(child).trim()}`)
          .join("\n");
        return `\n\n${items}\n\n`;
      }
      case "ol": {
        const items = Array.from(el.children)
          .map((child, idx) => `${idx + 1}. ${serialize(child).trim()}`)
          .join("\n");
        return `\n\n${items}\n\n`;
      }
      case "li":
        return children;
      case "blockquote":
        return `\n\n> ${children.trim().replace(/\n+/g, "\n> ")}\n\n`;
      case "hr":
        return `\n\n---\n\n`;
      case "a": {
        const href = el.getAttribute("href") || "#";
        return `[${children.trim() || href}](${href})`;
      }
      case "br":
        return "\n";
      case "div":
        return children.trim() ? `\n${children}\n` : "\n";
      default:
        return children;
    }
  }

  const result = Array.from(element.childNodes).map(serialize).join("");
  return result.replace(/\n{3,}/g, "\n\n").trim();
}

export function MobileNoteViewer({
  artifact,
  onClose,
  onExplainInChat,
  onDeleteArtifact,
  onConvertToSource,
  onGenerateNote,
}: MobileNoteViewerProps) {
  const { language } = useI18n();
  const isIndo = language === "id";

  const [title, setTitle] = useState(
    artifact?.title || (isIndo ? "Catatan Baru" : "New Note")
  );
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);
  const currentArtifactIdRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const titleDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const adjustTitleHeight = () => {
    if (titleTextareaRef.current) {
      titleTextareaRef.current.style.height = "auto";
      titleTextareaRef.current.style.height = `${titleTextareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustTitleHeight();
  }, [title]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (titleDebounceTimerRef.current) clearTimeout(titleDebounceTimerRef.current);
    };
  }, []);

  // Sync content into contentEditable
  useEffect(() => {
    if (!artifact) return;
    if (editorRef.current) {
      if (!isInitializedRef.current || currentArtifactIdRef.current !== artifact.id) {
        isInitializedRef.current = true;
        currentArtifactIdRef.current = artifact.id;
        editorRef.current.innerHTML = markdownToHtml(artifact.content || "");
      } else if (
        artifact.content !== undefined &&
        (artifact.status === "generating" || artifact.status === "completed")
      ) {
        if (document.activeElement !== editorRef.current) {
          editorRef.current.innerHTML = markdownToHtml(artifact.content);
        }
      }
    }
    // Guard against overwriting title if user is actively typing in title textarea
    if (artifact.title && document.activeElement !== titleTextareaRef.current) {
      setTitle(artifact.title);
    }
  }, [artifact?.id, artifact?.title, artifact?.content, artifact?.status]);

  const isGenerating = artifact?.status === "generating";

  const handleInput = () => {
    if (!editorRef.current || !artifact) return;
    const md = htmlToMarkdown(editorRef.current);
    setIsSaving(true);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        await localDb.updateArtifact(artifact.id, { content: md });
      } catch (err) {
        console.error("Failed to save note content:", err);
      }
      setIsSaving(false);
    }, 450);
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    setIsSaving(true);

    if (titleDebounceTimerRef.current) clearTimeout(titleDebounceTimerRef.current);
    titleDebounceTimerRef.current = setTimeout(async () => {
      if (!artifact) return;
      try {
        await localDb.updateArtifact(artifact.id, {
          title: newTitle || (isIndo ? "Catatan Baru" : "New Note"),
        });
      } catch (err) {
        console.error("Failed to save note title:", err);
      }
      setIsSaving(false);
    }, 450);
  };

  const handleTitleBlur = async () => {
    if (titleDebounceTimerRef.current) {
      clearTimeout(titleDebounceTimerRef.current);
      titleDebounceTimerRef.current = null;
    }
    if (!artifact) return;
    try {
      await localDb.updateArtifact(artifact.id, {
        title: title || (isIndo ? "Catatan Baru" : "New Note"),
      });
    } catch (err) {
      console.error("Failed to save note title on blur:", err);
    }
    setIsSaving(false);
  };

  const handleConvertToSourceAction = async () => {
    if (!artifact) return;
    const md = editorRef.current ? htmlToMarkdown(editorRef.current) : (artifact.content || "");
    if (onConvertToSource) {
      onConvertToSource({ ...artifact, title, content: md });
      return;
    }
    if (artifact.learnId) {
      try {
        await localDb.createSource({
          learnId: artifact.learnId,
          title: title || (isIndo ? "Catatan" : "Note"),
          type: "text",
          content: md,
          includedInChat: true,
        });
        toast.success(
          isIndo
            ? "Catatan berhasil dijadikan sumber rujukan notebook!"
            : "Note added as notebook source successfully!"
        );
      } catch (err: any) {
        toast.error(err.message);
      }
    }
  };

  const handleCopy = () => {
    const md = editorRef.current ? htmlToMarkdown(editorRef.current) : (artifact?.content || "");
    if (navigator.clipboard) {
      navigator.clipboard.writeText(md);
      setCopied(true);
      toast.success(isIndo ? "Catatan disalin ke clipboard" : "Note copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const md = editorRef.current ? htmlToMarkdown(editorRef.current) : (artifact?.content || "");
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "Note").replace(/[/\\?%*:|"<>]/g, "_")}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(isIndo ? "Catatan diunduh (.md)" : "Note downloaded (.md)");
  };

  const handleDelete = () => {
    if (artifact?.id && onDeleteArtifact) {
      onDeleteArtifact(artifact.id);
      onClose();
    } else {
      onClose();
    }
  };

  const handleGenerate = () => {
    if (!artifact) return;
    if (onGenerateNote) {
      onGenerateNote(artifact);
    }
  };

  const applyFormat = (action: string, param?: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();

    switch (action) {
      case "undo":
        document.execCommand("undo", false);
        break;
      case "redo":
        document.execCommand("redo", false);
        break;
      case "heading": {
        if (param === "h1") {
          document.execCommand("formatBlock", false, "<h1>");
        } else if (param === "h2") {
          document.execCommand("formatBlock", false, "<h2>");
        } else if (param === "h3") {
          document.execCommand("formatBlock", false, "<h3>");
        } else {
          document.execCommand("formatBlock", false, "<p>");
        }
        break;
      }
      case "bold":
        document.execCommand("bold", false);
        break;
      case "italic":
        document.execCommand("italic", false);
        break;
      case "link": {
        const url = window.prompt(
          isIndo ? "Masukkan URL tautan:" : "Enter link URL:",
          "https://"
        );
        if (url) {
          document.execCommand("createLink", false, url);
        }
        break;
      }
      case "code": {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
          const range = selection.getRangeAt(0);
          const selectedText = range.toString();
          const codeEl = document.createElement("code");
          codeEl.textContent = selectedText;
          range.deleteContents();
          range.insertNode(codeEl);
          selection.removeAllRanges();
        } else {
          document.execCommand("formatBlock", false, "<pre>");
        }
        break;
      }
      case "bullet":
        document.execCommand("insertUnorderedList", false);
        break;
      case "ordered":
        document.execCommand("insertOrderedList", false);
        break;
      case "quote":
        document.execCommand("formatBlock", false, "<blockquote>");
        break;
      case "rule":
        document.execCommand("insertHorizontalRule", false);
        break;
      case "clear":
        document.execCommand("removeFormat", false);
        break;
      default:
        break;
    }

    handleInput();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden text-left font-sans animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="h-14 px-3 sm:px-4 border-b border-border flex items-center justify-between shrink-0 bg-card">
        {/* Left: Back Arrow & Breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title={isIndo ? "Kembali" : "Back"}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-medium text-muted-foreground">
              Studio
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
            <span className="text-xs font-semibold text-foreground truncate">
              {isIndo ? "Catatan" : "Note"}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleConvertToSourceAction}
            className="h-8 px-2.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors cursor-pointer text-xs"
            title={isIndo ? "Jadikan sumber rujukan notebook" : "Add as notebook source"}
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline font-medium">{isIndo ? "Jadikan Sumber" : "Add to Sources"}</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="h-8 w-8 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            title={isIndo ? "Salin catatan" : "Copy note"}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="h-8 w-8 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            title={isIndo ? "Unduh .md" : "Download .md"}
          >
            <Download className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="h-8 w-8 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors cursor-pointer"
            title={isIndo ? "Hapus catatan" : "Delete note"}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Note Title Input with balanced, equal top/bottom padding and zero clipping */}
      <div className="px-4 py-3 shrink-0 bg-background">
        <textarea
          ref={titleTextareaRef}
          rows={1}
          value={title}
          onChange={(e) => {
            handleTitleChange(e.target.value);
            adjustTitleHeight();
          }}
          onBlur={handleTitleBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              editorRef.current?.focus();
            }
          }}
          placeholder={isIndo ? "Catatan Baru" : "New Note"}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          className="w-full resize-none overflow-hidden text-xl sm:text-2xl font-bold tracking-tight text-foreground bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none ring-0 placeholder:text-muted-foreground/40 leading-snug py-1 block"
        />
      </div>

      {/* Rich Text Formatting Toolbar with clean border-y framing */}
      <div className="px-3 py-1.5 border-y border-border bg-card/60 flex items-center gap-0.5 overflow-x-auto no-scrollbar shrink-0 select-none">
        <button
          type="button"
          onClick={() => applyFormat("undo")}
          className="h-7 w-7 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => applyFormat("redo")}
          className="h-7 w-7 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>

        <div className="w-px h-4 bg-border mx-1 shrink-0" />

        {/* Headings Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="h-7 px-2 rounded-md hover:bg-secondary text-foreground text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0"
            >
              <span>Normal</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-36 bg-popover border-border text-popover-foreground shadow-xl"
          >
            <DropdownMenuItem
              className="text-xs cursor-pointer py-1.5"
              onClick={() => applyFormat("heading", "p")}
            >
              Normal
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-xs cursor-pointer font-bold py-1.5"
              onClick={() => applyFormat("heading", "h1")}
            >
              Heading 1
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-xs cursor-pointer font-semibold py-1.5"
              onClick={() => applyFormat("heading", "h2")}
            >
              Heading 2
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-xs cursor-pointer font-medium py-1.5"
              onClick={() => applyFormat("heading", "h3")}
            >
              Heading 3
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-px h-4 bg-border mx-1 shrink-0" />

        <button
          type="button"
          onClick={() => applyFormat("bold")}
          className="h-7 w-7 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title="Bold"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => applyFormat("italic")}
          className="h-7 w-7 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title="Italic"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => applyFormat("link")}
          className="h-7 w-7 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title="Link"
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => applyFormat("code")}
          className="h-7 w-7 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title="Code"
        >
          <Code className="h-3.5 w-3.5" />
        </button>

        <div className="w-px h-4 bg-border mx-1 shrink-0" />

        <button
          type="button"
          onClick={() => applyFormat("bullet")}
          className="h-7 w-7 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title="Bullet List"
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => applyFormat("ordered")}
          className="h-7 w-7 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title="Numbered List"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => applyFormat("quote")}
          className="h-7 w-7 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title="Quote"
        >
          <Quote className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => applyFormat("rule")}
          className="h-7 w-7 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title="Divider"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => applyFormat("clear")}
          className="h-7 w-7 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title="Clear Format"
        >
          <RemoveFormatting className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Editor Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col select-text">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          data-placeholder={
            isIndo
              ? "Tulis catatan atau tempel konten materi di sini..."
              : "Write note or paste study content here..."
          }
          style={{
            outline: "none",
            border: "none",
            boxShadow: "none",
          }}
          className={cn(
            "w-full h-full min-h-[350px] bg-transparent text-foreground text-sm font-sans leading-relaxed select-text",
            "border-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ring-0 shadow-none",
            "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/60 empty:before:pointer-events-none empty:before:block",
            "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-foreground [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:tracking-tight",
            "[&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:tracking-tight",
            "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-2.5 [&_h3]:mb-1",
            "[&_p]:mb-2 [&_p]:leading-relaxed",
            "[&_strong]:font-bold [&_strong]:text-foreground",
            "[&_b]:font-bold [&_b]:text-foreground",
            "[&_em]:italic [&_em]:text-foreground/90",
            "[&_i]:italic [&_i]:text-foreground/90",
            "[&_a]:text-primary [&_a]:underline hover:[&_a]:text-primary/80",
            "[&_code]:bg-secondary [&_code]:text-primary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono",
            "[&_pre]:bg-secondary/60 [&_pre]:border [&_pre]:border-border [&_pre]:p-3 [&_pre]:rounded-xl [&_pre]:my-2.5 [&_pre]:overflow-x-auto",
            "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ul]:space-y-1",
            "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_ol]:space-y-1",
            "[&_li]:leading-relaxed",
            "[&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-3 [&_blockquote]:py-0.5 [&_blockquote]:my-2.5 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
            "[&_hr]:border-border [&_hr]:my-4",
            "[&_table]:w-full [&_table]:my-3.5 [&_table]:border-collapse [&_table]:border [&_table]:border-border [&_table]:rounded-xl [&_table]:overflow-hidden",
            "[&_thead]:bg-secondary/60 [&_thead]:border-b [&_thead]:border-border",
            "[&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-foreground [&_th]:border-r [&_th]:border-border last:[&_th]:border-r-0",
            "[&_tbody_tr]:border-b [&_tbody_tr]:border-border/60 hover:[&_tbody_tr]:bg-secondary/30",
            "[&_td]:px-3 [&_td]:py-1.5 [&_td]:text-xs [&_td]:text-foreground/90 [&_td]:border-r [&_td]:border-border/60 last:[&_td]:border-r-0"
          )}
        />
      </div>

      {/* Footer / Generate Note Button & Save Status */}
      <div className="px-4 py-2.5 border-t border-border flex items-center justify-between bg-card shrink-0">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95",
            isGenerating
              ? "bg-secondary text-muted-foreground cursor-not-allowed opacity-75"
              : "bg-foreground text-background hover:bg-foreground/90"
          )}
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4 stroke-[2]" />
          )}
          <span>
            {isGenerating
              ? (isIndo ? "Menghasilkan..." : "Generating...")
              : "Generate"}
          </span>
        </button>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {isSaving ? (
            <span className="text-amber-500 animate-pulse font-medium">
              {isIndo ? "Menyimpan..." : "Saving..."}
            </span>
          ) : (
            <span className="text-emerald-500 flex items-center gap-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              {isIndo ? "Tersimpan otomatis" : "Auto-saved"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
