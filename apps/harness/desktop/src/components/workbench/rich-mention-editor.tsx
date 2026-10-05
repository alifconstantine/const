import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { cn } from "@const/ui";
import { activeAtToken, type ActiveAtToken, type MentionCandidate } from "../../lib/mention-search";

export interface RichMentionEditorRef {
  focus: () => void;
  insertMention: (candidate: MentionCandidate) => void;
  drillDirectory: (candidate: MentionCandidate) => void;
  insertText: (text: string) => void;
  insertAt: () => void;
  insertCommand: (cmd: string) => void;
  clear: () => void;
  getText: () => string;
  setText: (text: string) => void;
  getElement: () => HTMLDivElement | null;
}

export interface RichMentionEditorProps {
  initialValue?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onSerializedChange?: (value: string) => void;
  onMentionTokenChange?: (token: ActiveAtToken | null) => void;
  onOpenFilePreview?: (path: string) => void;
  onSend?: () => void;
  onPasteFiles?: (files: FileList) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}

/**
 * Returns crisp SVG or HTML for file icons matching VS Code / Antigravity aesthetics.
 */
function getMentionIconMarkup({
  title,
  kind,
  fileType,
}: {
  title: string;
  kind?: string;
  fileType?: string;
}): string {
  if (kind === "directory") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="text-[#888888] dark:text-[#a0a0a0] shrink-0 inline-block"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 8 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`;
  }

  if (kind === "session") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="text-[#888888] dark:text-[#a0a0a0] shrink-0 inline-block"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`;
  }

  if (kind === "media" || fileType === "image") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="text-[#888888] dark:text-[#a0a0a0] shrink-0 inline-block"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`;
  }

  const lower = title.toLowerCase();
  const ext = lower.includes(".") ? lower.split(".").pop() || "" : "";

  // 1. Markdown (*.md, *.mdx) -> Iconify / VS Code Markdown M↓ icon
  if (ext === "md" || ext === "markdown" || ext === "mdx") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14" fill="currentColor" class="text-[#519aba] shrink-0 inline-block"><path fill-rule="evenodd" d="M14.85 3H1.15C.52 3 0 3.52 0 4.15v7.69C0 12.48.52 13 1.15 13h13.69c.64 0 1.15-.52 1.15-1.15V4.15C16 3.52 15.48 3 14.85 3zM9 11H7V8L5.5 9.5 4 8v3H2V5h2l1.5 2L7 5h2v6zm2.99.5L9.5 8H11V5h2v3h1.5l-2.51 3.5z"/></svg>`;
  }

  // 2. React TSX/JSX -> Cyan Atom
  if (ext === "tsx" || ext === "jsx") {
    return `<svg viewBox="-11.5 -10.23174 23 20.46348" width="14" height="14" class="text-[#00d8ff] shrink-0 inline-block" fill="currentColor"><circle cx="0" cy="0" r="2.05" fill="#00d8ff"/><g stroke="#00d8ff" stroke-width="1.2" fill="none"><ellipse rx="11" ry="4.2"/><ellipse rx="11" ry="4.2" transform="rotate(60)"/><ellipse rx="11" ry="4.2" transform="rotate(120)"/></g></svg>`;
  }

  // 3. TypeScript (*.ts) -> TS blue
  if (ext === "ts" || ext === "mts" || ext === "cts") {
    return `<span class="w-3.5 h-3.5 inline-flex items-center justify-center font-mono font-bold text-[9.5px] tracking-tighter leading-none select-none text-[#519aba] shrink-0">TS</span>`;
  }

  // 4. JavaScript (*.js) -> JS yellow
  if (ext === "js" || ext === "mjs" || ext === "cjs") {
    return `<span class="w-3.5 h-3.5 inline-flex items-center justify-center font-mono font-bold text-[9.5px] tracking-tighter leading-none select-none text-[#cbcb41] shrink-0">JS</span>`;
  }

  // 5. JSON (*.json) -> {} yellow
  if (ext === "json") {
    return `<span class="w-3.5 h-3.5 inline-flex items-center justify-center font-mono font-bold text-[10.5px] leading-none select-none text-[#cbcb41] shrink-0">{}</span>`;
  }

  // 6. CSS / SCSS -> #
  if (ext === "css" || ext === "scss" || ext === "sass" || ext === "less") {
    return `<span class="w-3.5 h-3.5 inline-flex items-center justify-center font-mono font-bold text-[11px] leading-none select-none text-[#519aba] shrink-0">#</span>`;
  }

  // 7. HTML -> </>
  if (ext === "html" || ext === "htm") {
    return `<span class="w-3.5 h-3.5 inline-flex items-center justify-center font-mono font-bold text-[10px] leading-none select-none text-[#e34c26] shrink-0">&lt;/&gt;</span>`;
  }

  // 8. YAML -> !
  if (ext === "yaml" || ext === "yml") {
    return `<span class="w-3.5 h-3.5 inline-flex items-center justify-center font-mono font-bold text-[11px] leading-none select-none text-[#c678dd] shrink-0">!</span>`;
  }

  // Generic File
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="text-[#888888] dark:text-[#a0a0a0] shrink-0 inline-block"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>`;
}

/**
 * Creates an inline non-editable mention badge DOM element with icon and filename.
 * Does NOT contain any 'x' close button.
 */
function createMentionBadgeElement(
  candidate: {
    title: string;
    fullPath?: string;
    path?: string;
    kind?: string;
    fileType?: string;
  },
  onOpenFilePreview?: (path: string) => void
): HTMLSpanElement {
  const badge = document.createElement("span");
  badge.contentEditable = "false";
  badge.setAttribute("data-mention-token", "true");

  const targetPath = candidate.fullPath || candidate.path || candidate.title;
  badge.setAttribute("data-mention-path", targetPath);
  badge.setAttribute("data-mention-kind", candidate.kind || "file");
  badge.setAttribute("data-mention-title", candidate.title);

  badge.className =
    "inline-flex items-center gap-1.5 py-0.5 px-1.5 rounded select-none cursor-pointer text-[#262626] dark:text-[#ececec] bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 align-baseline font-sans text-[13.5px] mx-0.5 transition-colors group";
  badge.title = `Click to preview ${candidate.title}`;

  const cleanName = candidate.title.replace(/\/$/, "");
  const iconHtml = getMentionIconMarkup({
    title: cleanName,
    kind: candidate.kind || "file",
    fileType: candidate.fileType,
  });

  badge.innerHTML = `${iconHtml}<span class="leading-tight text-[13.5px] font-sans font-medium">${cleanName}</span>`;

  if (onOpenFilePreview && candidate.kind !== "session") {
    badge.addEventListener("click", (e) => {
      e.stopPropagation();
      onOpenFilePreview(targetPath);
    });
  }

  return badge;
}

/**
 * Serializes container nodes to prompt string (mentions become @[path]).
 * When forActiveToken is true, completed mention badges serialize as spaces
 * so they never trigger autocomplete when the caret is adjacent to them.
 */
function serializeContainer(container: Node, forActiveToken = false): string {
  let result = "";

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.nodeValue || "";
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.getAttribute("data-mention-token") === "true") {
        if (forActiveToken) {
          result += " ";
        } else {
          const path = el.getAttribute("data-mention-path") || el.getAttribute("data-mention-title") || "";
          result += `@[${path}]`;
        }
      } else if (el.tagName === "BR") {
        result += "\n";
      } else if (el.tagName === "DIV" || el.tagName === "P") {
        // If it's a div block inserted on enter
        if (result.length > 0 && !result.endsWith("\n")) {
          result += "\n";
        }
        node.childNodes.forEach(walk);
      } else {
        node.childNodes.forEach(walk);
      }
    }
  }

  container.childNodes.forEach(walk);
  return result;
}

export const RichMentionEditor = React.forwardRef<RichMentionEditorRef, RichMentionEditorProps>(
  (
    {
      initialValue = "",
      placeholder = "Ask Const anything, @ to add context, / for commands...",
      disabled = false,
      className,
      onSerializedChange,
      onMentionTokenChange,
      onOpenFilePreview,
      onSend,
      onPasteFiles,
      onKeyDown,
    },
    ref
  ) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [isEmpty, setIsEmpty] = useState(true);
    const savedRangeRef = useRef<Range | null>(null);

    const saveSelection = useCallback(() => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editorRef.current) {
        const range = sel.getRangeAt(0);
        if (editorRef.current.contains(range.startContainer)) {
          savedRangeRef.current = range.cloneRange();
        }
      }
    }, []);

    const syncContent = useCallback(() => {
      const editor = editorRef.current;
      if (!editor) return;

      const serialized = serializeContainer(editor);
      const hasBadges = editor.querySelector("[data-mention-token]") !== null;
      const textEmpty = !serialized.trim() && !hasBadges;
      setIsEmpty(textEmpty);

      onSerializedChange?.(serialized);

      // Check activeAtToken based on cursor position
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        const preRange = document.createRange();
        preRange.selectNodeContents(editor);
        preRange.setEnd(range.startContainer, range.startOffset);

        const fragment = preRange.cloneContents();
        const temp = document.createElement("div");
        temp.appendChild(fragment);
        const textBeforeCaret = serializeContainer(temp, true);

        const token = activeAtToken(textBeforeCaret, textBeforeCaret.length);
        onMentionTokenChange?.(token);
      } else {
        onMentionTokenChange?.(null);
      }
    }, [onSerializedChange, onMentionTokenChange]);

    const setEditorFromSerializedText = useCallback(
      (text: string) => {
        const editor = editorRef.current;
        if (!editor) return;

        editor.innerHTML = "";
        if (!text) {
          setIsEmpty(true);
          onSerializedChange?.("");
          return;
        }

        const mentionRegex = /@\[([^\]]+)\]/g;
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = mentionRegex.exec(text)) !== null) {
          const before = text.slice(lastIndex, match.index);
          if (before) {
            editor.appendChild(document.createTextNode(before));
          }

          const rawPath = match[1];
          if (!rawPath) continue;
          const cleanName = rawPath.replace(/\\/g, "/").split("/").filter(Boolean).pop() || rawPath;
          const badge = createMentionBadgeElement(
            {
              title: cleanName,
              fullPath: rawPath,
              path: rawPath,
              kind: rawPath.endsWith("/") ? "directory" : "file",
            },
            onOpenFilePreview
          );
          editor.appendChild(badge);
          lastIndex = mentionRegex.lastIndex;
        }

        const remainder = text.slice(lastIndex);
        if (remainder) {
          editor.appendChild(document.createTextNode(remainder));
        }

        syncContent();
      },
      [onOpenFilePreview, syncContent, onSerializedChange]
    );

    useEffect(() => {
      if (initialValue !== undefined) {
        const current = editorRef.current ? serializeContainer(editorRef.current) : "";
        if (current !== initialValue) {
          setEditorFromSerializedText(initialValue);
        }
      }
    }, [initialValue, setEditorFromSerializedText]);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          editorRef.current?.focus();
        },
        clear: () => {
          if (editorRef.current) {
            editorRef.current.innerHTML = "";
            syncContent();
          }
        },
        getText: () => {
          return editorRef.current ? serializeContainer(editorRef.current) : "";
        },
        setText: (text: string) => {
          setEditorFromSerializedText(text);
        },
        getElement: () => editorRef.current,
        insertAt: () => {
          const editor = editorRef.current;
          if (!editor) return;
          editor.focus();

          const sel = window.getSelection();
          if (!sel || sel.rangeCount === 0) return;
          const range = savedRangeRef.current || sel.getRangeAt(0);

          // Insert " @" or "@"
          const preRange = document.createRange();
          preRange.selectNodeContents(editor);
          preRange.setEnd(range.startContainer, range.startOffset);
          const temp = document.createElement("div");
          temp.appendChild(preRange.cloneContents());
          const textBefore = serializeContainer(temp);

          const needsSpace = textBefore.length > 0 && !/\s$/.test(textBefore);
          const insertStr = needsSpace ? " @" : "@";
          const textNode = document.createTextNode(insertStr);
          range.insertNode(textNode);

          range.setStartAfter(textNode);
          range.setEndAfter(textNode);
          sel.removeAllRanges();
          sel.addRange(range);
          saveSelection();
          syncContent();
        },
        insertCommand: (cmd: string) => {
          const editor = editorRef.current;
          if (!editor) return;
          editor.focus();

          const sel = window.getSelection();
          if (!sel || sel.rangeCount === 0) return;
          const range = savedRangeRef.current || sel.getRangeAt(0);

          const textNode = document.createTextNode(cmd);
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.setEndAfter(textNode);
          sel.removeAllRanges();
          sel.addRange(range);
          saveSelection();
          syncContent();
        },
        insertText: (text: string) => {
          const editor = editorRef.current;
          if (!editor) return;
          editor.focus();

          const sel = window.getSelection();
          if (!sel || sel.rangeCount === 0) return;
          const range = savedRangeRef.current || sel.getRangeAt(0);

          const textNode = document.createTextNode(text);
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.setEndAfter(textNode);
          sel.removeAllRanges();
          sel.addRange(range);
          saveSelection();
          syncContent();
        },
        insertMention: (candidate: MentionCandidate) => {
          const editor = editorRef.current;
          if (!editor) return;
          editor.focus();

          const sel = window.getSelection();
          if (!sel || sel.rangeCount === 0) return;

          let range = savedRangeRef.current || sel.getRangeAt(0);

          // Find and replace active @token in text node
          if (range.startContainer.nodeType === Node.TEXT_NODE) {
            const node = range.startContainer;
            const fullText = node.nodeValue || "";
            const offset = range.startOffset;

            // Look back from offset to find the '@' or '@"' trigger
            const beforeText = fullText.slice(0, offset);
            const tokenMatch = /(?:^|\s)(@"[^"]*|@[^\s]*)$/.exec(beforeText);

            if (tokenMatch && tokenMatch[1]) {
              const matchedPrefix = tokenMatch[1];
              const tokenStart = offset - matchedPrefix.length;
              range.setStart(node, tokenStart);
              range.setEnd(node, offset);
              range.deleteContents();
            }
          }

          // Create and insert badge
          const badge = createMentionBadgeElement(candidate, onOpenFilePreview);
          range.insertNode(badge);

          // Insert trailing space so cursor is positioned right after
          const spaceNode = document.createTextNode(" ");
          badge.after(spaceNode);

          range.setStartAfter(spaceNode);
          range.setEndAfter(spaceNode);
          sel.removeAllRanges();
          sel.addRange(range);

          saveSelection();
          syncContent();
          onMentionTokenChange?.(null);
        },
        drillDirectory: (candidate: MentionCandidate) => {
          const editor = editorRef.current;
          if (!editor || !candidate.drillPath) return;
          editor.focus();

          const sel = window.getSelection();
          if (!sel || sel.rangeCount === 0) return;
          const range = savedRangeRef.current || sel.getRangeAt(0);

          if (range.startContainer.nodeType === Node.TEXT_NODE) {
            const node = range.startContainer;
            const fullText = node.nodeValue || "";
            const offset = range.startOffset;
            const beforeText = fullText.slice(0, offset);
            const tokenMatch = /(?:^|\s)(@"[^"]*|@[^\s]*)$/.exec(beforeText);

            if (tokenMatch && tokenMatch[1]) {
              const matchedPrefix = tokenMatch[1];
              const tokenStart = offset - matchedPrefix.length;
              const needsQuote = /\s/.test(candidate.drillPath);
              const drillPrefix = needsQuote ? `@"${candidate.drillPath}` : `@${candidate.drillPath}`;

              range.setStart(node, tokenStart);
              range.setEnd(node, offset);
              range.deleteContents();

              const textNode = document.createTextNode(drillPrefix);
              range.insertNode(textNode);
              range.setStartAfter(textNode);
              range.setEndAfter(textNode);
              sel.removeAllRanges();
              sel.addRange(range);

              saveSelection();
              syncContent();
            }
          }
        },
      }),
      [onOpenFilePreview, saveSelection, setEditorFromSerializedText, syncContent]
    );

    const handleCopy = (e: React.ClipboardEvent<HTMLDivElement>) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !editorRef.current) return;

      const range = sel.getRangeAt(0);
      if (!editorRef.current.contains(range.commonAncestorContainer)) return;

      const clone = range.cloneContents();
      const temp = document.createElement("div");
      temp.appendChild(clone);
      const serialized = serializeContainer(temp);

      e.clipboardData.setData("text/plain", serialized);
      e.preventDefault();
    };

    const handleCut = (e: React.ClipboardEvent<HTMLDivElement>) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !editorRef.current) return;

      const range = sel.getRangeAt(0);
      if (!editorRef.current.contains(range.commonAncestorContainer)) return;

      const clone = range.cloneContents();
      const temp = document.createElement("div");
      temp.appendChild(clone);
      const serialized = serializeContainer(temp);

      e.clipboardData.setData("text/plain", serialized);
      range.deleteContents();
      e.preventDefault();
      syncContent();
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
      const clipboardFiles = e.clipboardData?.files;
      if (clipboardFiles && clipboardFiles.length > 0 && onPasteFiles) {
        e.preventDefault();
        onPasteFiles(clipboardFiles);
        return;
      }

      const text = e.clipboardData.getData("text/plain");
      if (!text) return;

      e.preventDefault();
      const editor = editorRef.current;
      if (!editor) return;

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      range.deleteContents();

      // If text contains mention syntax @[path]
      if (/@\[([^\]]+)\]/.test(text)) {
        const mentionRegex = /@\[([^\]]+)\]/g;
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = mentionRegex.exec(text)) !== null) {
          const before = text.slice(lastIndex, match.index);
          if (before) {
            const tn = document.createTextNode(before);
            range.insertNode(tn);
            range.setStartAfter(tn);
            range.setEndAfter(tn);
          }

          const rawPath = match[1];
          if (!rawPath) continue;
          const cleanName = rawPath.replace(/\\/g, "/").split("/").filter(Boolean).pop() || rawPath;
          const badge = createMentionBadgeElement(
            {
              title: cleanName,
              fullPath: rawPath,
              path: rawPath,
              kind: rawPath.endsWith("/") ? "directory" : "file",
            },
            onOpenFilePreview
          );
          range.insertNode(badge);
          range.setStartAfter(badge);
          range.setEndAfter(badge);
          lastIndex = mentionRegex.lastIndex;
        }

        const remainder = text.slice(lastIndex);
        if (remainder) {
          const tn = document.createTextNode(remainder);
          range.insertNode(tn);
          range.setStartAfter(tn);
          range.setEndAfter(tn);
        }
      } else {
        // Plain text paste without styling
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
      }

      sel.removeAllRanges();
      sel.addRange(range);
      saveSelection();
      syncContent();
    };

    const handleKeyDownInternal = (e: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(e);
      if (e.defaultPrevented) return;

      // Handle Backspace deleting mention badge atomically
      if (e.key === "Backspace") {
        const sel = window.getSelection();
        if (sel && sel.isCollapsed && editorRef.current) {
          const range = sel.getRangeAt(0);

          // If caret is in a text node at position 0, check preceding sibling
          if (range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset === 0) {
            const prev = range.startContainer.previousSibling;
            if (prev && prev.nodeType === Node.ELEMENT_NODE && (prev as HTMLElement).dataset.mentionToken) {
              e.preventDefault();
              prev.remove();
              syncContent();
              return;
            }
          }

          // If caret is directly on element node container
          if (range.startContainer.nodeType === Node.ELEMENT_NODE && range.startOffset > 0) {
            const prev = range.startContainer.childNodes[range.startOffset - 1];
            if (prev && prev.nodeType === Node.ELEMENT_NODE && (prev as HTMLElement).dataset.mentionToken) {
              e.preventDefault();
              prev.remove();
              syncContent();
              return;
            }
          }
        }
      }

      // Enter sends unless Shift is pressed
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSend?.();
      }
    };

    return (
      <div className="relative w-full min-h-[28px] flex items-center">
        {isEmpty && (
          <div className="absolute top-0.5 left-0 pointer-events-none select-none text-[14px] leading-5 text-[#a9a9a9] dark:text-[#5d5d5d] font-sans">
            {placeholder}
          </div>
        )}

        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={() => {
            saveSelection();
            syncContent();
          }}
          onKeyUp={saveSelection}
          onMouseUp={saveSelection}
          onCopy={handleCopy}
          onCut={handleCut}
          onPaste={handlePaste}
          onKeyDown={handleKeyDownInternal}
          className={cn(
            "w-full min-h-[28px] max-h-48 overflow-y-auto outline-none font-sans text-[14px] leading-5 text-[#262626] dark:text-[#d4d4d4] py-0.5 whitespace-pre-wrap break-words cursor-text",
            className
          )}
        />
      </div>
    );
  }
);

RichMentionEditor.displayName = "RichMentionEditor";
