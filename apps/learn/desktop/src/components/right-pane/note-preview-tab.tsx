import React, { useState, useEffect, useRef } from "react";
import {
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
  PanelRight,
  ChevronRight,
  ChevronDown,
  Wand2,
  Loader2,
} from "lucide-react";
import {
  cn,
  toast,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  ScrollArea,
} from "@const/ui";
import { marked } from "marked";
import { localDb, type LocalArtifact } from "../../lib/db";
import { useI18n } from "../../lib/i18n";
import type { RightPaneTab } from "./types";

export interface NotePreviewTabProps {
  tab?: RightPaneTab;
  artifact?: LocalArtifact;
  onClose?: () => void;
  onDeleteArtifact?: (artId: string) => void;
  onConvertToSource?: (art: LocalArtifact) => void;
  onGenerateNote?: (art: LocalArtifact) => void;
  onToggleCollapse?: () => void;
  onUpdateTab?: (tabId: string, updates: Partial<RightPaneTab>) => void;
  onDownloadArtifact?: (art: any) => void;
}

/**
 * Converts Markdown string into styled HTML for the rich contentEditable editor
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
  return result
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function NotePreviewTab({
  tab,
  artifact: propArtifact,
  onClose,
  onDeleteArtifact,
  onConvertToSource,
  onGenerateNote,
  onToggleCollapse,
  onUpdateTab,
}: NotePreviewTabProps) {
  const { t, language } = useI18n();
  const artifact: LocalArtifact | undefined = propArtifact || tab?.artifact;

  const [title, setTitle] = useState<string>(
    artifact?.title || tab?.title || (language === "id" ? "Catatan Baru" : "New Note")
  );
  const [isSaving, setIsSaving] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);
  const currentArtifactIdRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize and synchronize HTML content into contentEditable without cursor jumps
  useEffect(() => {
    const artId = artifact?.id || tab?.artifactId || "temp";
    if (editorRef.current) {
      if (!isInitializedRef.current || currentArtifactIdRef.current !== artId) {
        isInitializedRef.current = true;
        currentArtifactIdRef.current = artId;
        const initialMd = artifact?.content || tab?.newContent || "";
        editorRef.current.innerHTML = markdownToHtml(initialMd);
      } else if (
        artifact?.content !== undefined &&
        (artifact?.status === "generating" || artifact?.status === "completed")
      ) {
        if (document.activeElement !== editorRef.current) {
          editorRef.current.innerHTML = markdownToHtml(artifact.content);
        }
      }
    }
    if (artifact?.title) {
      setTitle(artifact.title);
    }
  }, [artifact?.id, artifact?.title, artifact?.content, artifact?.status, tab?.artifactId]);

  const isGenerating = artifact?.status === "generating";

  const handleGenerate = () => {
    if (!artifact) return;
    if (onGenerateNote) {
      onGenerateNote(artifact);
    }
  };

  const handleInput = () => {
    if (!editorRef.current) return;
    const md = htmlToMarkdown(editorRef.current);
    setIsSaving(true);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      const artId = artifact?.id || tab?.artifactId;
      if (artId) {
        try {
          await localDb.updateArtifact(artId, { content: md });
        } catch (err) {
          console.error("Failed to save note content:", err);
        }
      }
      if (tab && onUpdateTab) {
        onUpdateTab(tab.id, {
          newContent: md,
          artifact: artifact ? { ...artifact, content: md } : undefined,
        });
      }
      setIsSaving(false);
    }, 450);
  };

  const handleTitleChange = async (newTitle: string) => {
    setTitle(newTitle);
    const artId = artifact?.id || tab?.artifactId;
    if (artId) {
      try {
        await localDb.updateArtifact(artId, {
          title: newTitle || (language === "id" ? "Catatan Baru" : "New Note"),
        });
      } catch (err) {
        console.error("Failed to save note title:", err);
      }
    }
    if (tab && onUpdateTab) {
      onUpdateTab(tab.id, {
        title: newTitle,
        artifact: artifact ? { ...artifact, title: newTitle } : undefined,
      });
    }
  };

  const handleConvertToSource = async () => {
    const md = editorRef.current ? htmlToMarkdown(editorRef.current) : (artifact?.content || "");
    if (!artifact) return;
    if (onConvertToSource) {
      onConvertToSource({ ...artifact, title, content: md });
      return;
    }
    if (artifact.learnId) {
      try {
        await localDb.createSource({
          learnId: artifact.learnId,
          title: title || (language === "id" ? "Catatan" : "Note"),
          type: "text",
          content: md,
          includedInChat: true,
        });
        toast.success(
          language === "id"
            ? "Catatan berhasil dikonversikan menjadi sumber!"
            : "Note converted to source successfully!"
        );
      } catch (err: any) {
        toast.error(err.message);
      }
    }
  };

  const handleDelete = () => {
    const artId = artifact?.id || tab?.artifactId;
    if (artId && onDeleteArtifact) {
      onDeleteArtifact(artId);
    } else if (onClose) {
      onClose();
    }
  };

  /**
   * Applies formatting directly to contentEditable DOM so it renders live immediately
   */
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
          language === "id" ? "Masukkan URL tautan:" : "Enter link URL:",
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
    <div className="flex-1 w-full h-full flex flex-col overflow-hidden bg-background select-none font-sans">
      {/* Top Breadcrumb Header (Image 3: Studio > Catatan) */}
      <div className="h-11 px-4 border-b border-border flex items-center justify-between shrink-0 bg-card text-xs">
        {/* Left: Studio > Catatan */}
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            {t("studio") || "Studio"}
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          <span className="text-xs font-medium text-foreground truncate">
            {language === "id" ? "Catatan" : "Note"}
          </span>
        </div>

        {/* Right: Trash / Delete icon & Collapse */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleDelete}
            className="h-7 w-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors cursor-pointer"
            title={language === "id" ? "Hapus catatan" : "Delete note"}
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="h-7 w-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
              title={t("hidePanel") || "Collapse panel"}
            >
              <PanelRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Note Title Input (Image 3: Seamless borderless) */}
      <div className="px-5 pt-4 pb-1 shrink-0">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder={language === "id" ? "Catatan Baru" : "New Note"}
          style={{ outline: "none", border: "none", boxShadow: "none" }}
          className="text-xl sm:text-2xl font-bold text-foreground bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none ring-0 w-full placeholder:text-muted-foreground/50 tracking-tight"
        />
      </div>

      {/* Rich Text Formatting Toolbar (Image 3) */}
      <div className="px-4 py-1.5 flex items-center gap-0.5 border-b border-border text-muted-foreground flex-wrap shrink-0 select-none bg-card">
        {/* Undo */}
        <button
          type="button"
          onClick={() => applyFormat("undo")}
          className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        {/* Redo */}
        <button
          type="button"
          onClick={() => applyFormat("redo")}
          className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>

        <div className="h-4 w-[1px] bg-border mx-1" />

        {/* Style Dropdown (Normal ▾ / Headings) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="h-7 px-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
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
              onClick={() => applyFormat("heading", "normal")}
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

        <div className="h-4 w-[1px] bg-border mx-1" />

        {/* Bold */}
        <button
          type="button"
          onClick={() => applyFormat("bold")}
          className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        {/* Italic */}
        <button
          type="button"
          onClick={() => applyFormat("italic")}
          className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        {/* Link */}
        <button
          type="button"
          onClick={() => applyFormat("link")}
          className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
          title="Insert Link"
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </button>
        {/* Code */}
        <button
          type="button"
          onClick={() => applyFormat("code")}
          className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
          title="Code"
        >
          <Code className="h-3.5 w-3.5" />
        </button>

        <div className="h-4 w-[1px] bg-border mx-1" />

        {/* Bullet List */}
        <button
          type="button"
          onClick={() => applyFormat("bullet")}
          className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
          title="Bullet List"
        >
          <List className="h-3.5 w-3.5" />
        </button>
        {/* Ordered List */}
        <button
          type="button"
          onClick={() => applyFormat("ordered")}
          className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
          title="Numbered List"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>
        {/* Quote */}
        <button
          type="button"
          onClick={() => applyFormat("quote")}
          className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
          title="Quote"
        >
          <Quote className="h-3.5 w-3.5" />
        </button>
        {/* Divider */}
        <button
          type="button"
          onClick={() => applyFormat("rule")}
          className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
          title="Horizontal Rule"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        {/* Clear Format */}
        <button
          type="button"
          onClick={() => applyFormat("clear")}
          className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
          title="Clear formatting"
        >
          <RemoveFormatting className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Clean, Borderless WYSIWYG Editor Area (Live rendered markdown, no yellow block!) */}
      <ScrollArea className="flex-1 min-h-0 w-full select-text" viewportClassName="px-5 py-4 flex flex-col">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          data-placeholder={
            language === "id"
              ? "Tulis catatan atau rangkuman materi di sini..."
              : "Start writing your note here..."
          }
          style={{
            outline: "none",
            border: "none",
            boxShadow: "none",
          }}
          className={cn(
            "w-full flex-1 min-h-[400px] bg-transparent text-foreground text-sm leading-relaxed font-sans",
            "border-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ring-0 shadow-none",
            "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/50 empty:before:pointer-events-none empty:before:block",
            "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-foreground [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:tracking-tight",
            "[&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:tracking-tight",
            "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-2.5 [&_h3]:mb-1",
            "[&_p]:mb-2 [&_p]:leading-relaxed",
            "[&_strong]:font-bold [&_strong]:text-foreground",
            "[&_b]:font-bold [&_b]:text-foreground",
            "[&_em]:italic [&_em]:text-foreground/90",
            "[&_i]:italic [&_i]:text-foreground/90",
            "[&_a]:text-primary [&_a]:underline hover:[&_a]:text-primary/80",
            "[&_code]:bg-muted [&_code]:text-primary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono",
            "[&_pre]:bg-muted/70 [&_pre]:border [&_pre]:border-border [&_pre]:p-3 [&_pre]:rounded-xl [&_pre]:my-2.5 [&_pre]:overflow-x-auto",
            "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ul]:space-y-1",
            "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_ol]:space-y-1",
            "[&_li]:leading-relaxed",
            "[&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-3 [&_blockquote]:py-0.5 [&_blockquote]:my-2.5 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
            "[&_hr]:border-border [&_hr]:my-4",
            "[&_table]:w-full [&_table]:my-3.5 [&_table]:border-collapse [&_table]:border [&_table]:border-border [&_table]:rounded-xl [&_table]:overflow-hidden",
            "[&_thead]:bg-muted/60 [&_thead]:border-b [&_thead]:border-border",
            "[&_th]:px-3.5 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-foreground [&_th]:border-r [&_th]:border-border last:[&_th]:border-r-0",
            "[&_tbody_tr]:border-b [&_tbody_tr]:border-border/60 hover:[&_tbody_tr]:bg-muted/30",
            "[&_td]:px-3.5 [&_td]:py-2 [&_td]:text-xs [&_td]:text-foreground/90 [&_td]:border-r [&_td]:border-border/60 last:[&_td]:border-r-0"
          )}
        />
      </ScrollArea>

      {/* Bottom Bar: Generate Note Action */}
      <div className="h-12 px-5 border-t border-border bg-card flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className={cn(
            "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95",
            isGenerating
              ? "bg-secondary text-muted-foreground cursor-not-allowed opacity-75"
              : "bg-foreground text-background hover:bg-foreground/90"
          )}
        >
          {isGenerating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Wand2 className="h-3.5 w-3.5" />
          )}
          <span>
            {isGenerating
              ? (language === "id" ? "Menghasilkan..." : "Generating...")
              : "Generate"}
          </span>
        </button>

        {isSaving && (
          <span className="text-[11px] text-muted-foreground animate-pulse">
            {language === "id" ? "Menyimpan..." : "Saving..."}
          </span>
        )}
      </div>
    </div>
  );
}
