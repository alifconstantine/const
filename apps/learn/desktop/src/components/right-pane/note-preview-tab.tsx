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
  FilePlus,
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

/**
 * Converts rich contentEditable DOM nodes into clean standard Markdown
 */
function htmlToMarkdown(element: HTMLElement | null): string {
  if (!element) return "";

  const text = element.innerText || element.textContent || "";
  if (!text.trim() && !element.querySelector("img, hr, br")) {
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
      case "pre":
        return `\n\n\`\`\`\n${children.trim()}\n\`\`\`\n\n`;
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
    if (editorRef.current && (!isInitializedRef.current || currentArtifactIdRef.current !== artId)) {
      isInitializedRef.current = true;
      currentArtifactIdRef.current = artId;
      const initialMd = artifact?.content || tab?.newContent || "";
      editorRef.current.innerHTML = markdownToHtml(initialMd);
    }
    if (artifact?.title) {
      setTitle(artifact.title);
    }
  }, [artifact?.id, artifact?.title, tab?.artifactId]);

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
    <div className="flex-1 w-full h-full flex flex-col overflow-hidden bg-[#141414] select-none font-sans">
      {/* Top Breadcrumb Header (Image 3: Studio > Catatan) */}
      <div className="h-11 px-4 border-b border-[#282828] flex items-center justify-between shrink-0 bg-[#171719] text-xs">
        {/* Left: Studio > Catatan */}
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-[#969696] hover:text-white transition-colors cursor-pointer"
          >
            {t("studio") || "Studio"}
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-[#666666] shrink-0" />
          <span className="text-xs font-medium text-white truncate">
            {language === "id" ? "Catatan" : "Note"}
          </span>
        </div>

        {/* Right: Trash / Delete icon & Collapse */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleDelete}
            className="h-7 w-7 rounded-lg hover:bg-white/10 text-[#969696] hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer"
            title={language === "id" ? "Hapus catatan" : "Delete note"}
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="h-7 w-7 rounded-lg hover:bg-white/10 text-[#969696] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
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
          className="text-xl sm:text-2xl font-bold text-white bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none ring-0 w-full placeholder:text-[#555555] tracking-tight"
        />
      </div>

      {/* Rich Text Formatting Toolbar (Image 3) */}
      <div className="px-4 py-1.5 flex items-center gap-0.5 border-b border-[#282828] text-neutral-400 flex-wrap shrink-0 select-none bg-[#161618]">
        {/* Undo */}
        <button
          type="button"
          onClick={() => applyFormat("undo")}
          className="h-7 w-7 rounded-md hover:bg-white/10 text-[#a3a3a3] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        {/* Redo */}
        <button
          type="button"
          onClick={() => applyFormat("redo")}
          className="h-7 w-7 rounded-md hover:bg-white/10 text-[#a3a3a3] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>

        <div className="h-4 w-[1px] bg-[#333336] mx-1" />

        {/* Style Dropdown (Normal ▾ / Headings) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="h-7 px-2 rounded-md hover:bg-white/10 text-[#d4d4d4] hover:text-white text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Normal</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-36 bg-[#202024] border-[#333338] text-neutral-200 shadow-xl"
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

        <div className="h-4 w-[1px] bg-[#333336] mx-1" />

        {/* Bold */}
        <button
          type="button"
          onClick={() => applyFormat("bold")}
          className="h-7 w-7 rounded-md hover:bg-white/10 text-[#a3a3a3] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        {/* Italic */}
        <button
          type="button"
          onClick={() => applyFormat("italic")}
          className="h-7 w-7 rounded-md hover:bg-white/10 text-[#a3a3a3] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        {/* Link */}
        <button
          type="button"
          onClick={() => applyFormat("link")}
          className="h-7 w-7 rounded-md hover:bg-white/10 text-[#a3a3a3] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          title="Insert Link"
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </button>
        {/* Code */}
        <button
          type="button"
          onClick={() => applyFormat("code")}
          className="h-7 w-7 rounded-md hover:bg-white/10 text-[#a3a3a3] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          title="Code"
        >
          <Code className="h-3.5 w-3.5" />
        </button>

        <div className="h-4 w-[1px] bg-[#333336] mx-1" />

        {/* Bullet List */}
        <button
          type="button"
          onClick={() => applyFormat("bullet")}
          className="h-7 w-7 rounded-md hover:bg-white/10 text-[#a3a3a3] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          title="Bullet List"
        >
          <List className="h-3.5 w-3.5" />
        </button>
        {/* Ordered List */}
        <button
          type="button"
          onClick={() => applyFormat("ordered")}
          className="h-7 w-7 rounded-md hover:bg-white/10 text-[#a3a3a3] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          title="Numbered List"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>
        {/* Quote */}
        <button
          type="button"
          onClick={() => applyFormat("quote")}
          className="h-7 w-7 rounded-md hover:bg-white/10 text-[#a3a3a3] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          title="Quote"
        >
          <Quote className="h-3.5 w-3.5" />
        </button>
        {/* Divider */}
        <button
          type="button"
          onClick={() => applyFormat("rule")}
          className="h-7 w-7 rounded-md hover:bg-white/10 text-[#a3a3a3] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          title="Horizontal Rule"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        {/* Clear Format */}
        <button
          type="button"
          onClick={() => applyFormat("clear")}
          className="h-7 w-7 rounded-md hover:bg-white/10 text-[#a3a3a3] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
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
            "w-full flex-1 min-h-[400px] bg-transparent text-[#e2e8f0] text-sm leading-relaxed font-sans",
            "border-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ring-0 shadow-none",
            "empty:before:content-[attr(data-placeholder)] empty:before:text-[#555555] empty:before:pointer-events-none empty:before:block",
            "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-white [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:tracking-tight",
            "[&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:tracking-tight",
            "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-white [&_h3]:mt-2.5 [&_h3]:mb-1",
            "[&_p]:mb-2 [&_p]:leading-relaxed",
            "[&_strong]:font-bold [&_strong]:text-white",
            "[&_b]:font-bold [&_b]:text-white",
            "[&_em]:italic [&_em]:text-neutral-200",
            "[&_i]:italic [&_i]:text-neutral-200",
            "[&_a]:text-blue-400 [&_a]:underline hover:[&_a]:text-blue-300",
            "[&_code]:bg-[#27272a] [&_code]:text-[#93c5fd] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono",
            "[&_pre]:bg-[#18181b] [&_pre]:border [&_pre]:border-[#27272a] [&_pre]:p-3 [&_pre]:rounded-xl [&_pre]:my-2.5 [&_pre]:overflow-x-auto",
            "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ul]:space-y-1",
            "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_ol]:space-y-1",
            "[&_li]:leading-relaxed",
            "[&_blockquote]:border-l-2 [&_blockquote]:border-blue-500 [&_blockquote]:pl-3 [&_blockquote]:py-0.5 [&_blockquote]:my-2.5 [&_blockquote]:italic [&_blockquote]:text-neutral-400",
            "[&_hr]:border-[#27272a] [&_hr]:my-4"
          )}
        />
      </ScrollArea>

      {/* Bottom Bar: Konversikan menjadi sumber (Image 3) */}
      <div className="h-12 px-5 border-t border-[#282828] bg-[#161618] flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={handleConvertToSource}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#d4d4d4] hover:text-white bg-[#222226] hover:bg-[#2c2c32] border border-[#38383e] transition-all cursor-pointer shadow-xs active:scale-95"
        >
          <FilePlus className="h-3.5 w-3.5 text-blue-400" />
          <span>
            {language === "id"
              ? "Konversikan menjadi sumber"
              : "Convert to source"}
          </span>
        </button>

        {isSaving && (
          <span className="text-[11px] text-neutral-500 animate-pulse">
            {language === "id" ? "Menyimpan..." : "Saving..."}
          </span>
        )}
      </div>
    </div>
  );
}
