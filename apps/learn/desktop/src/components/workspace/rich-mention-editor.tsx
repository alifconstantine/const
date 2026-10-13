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
  onOpenSourcePreview?: (sourceId: string) => void;
  onOpenArtifactPreview?: (artifactId: string) => void;
  onSend?: () => void;
  onPasteFiles?: (files: FileList) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}

function getMentionIconMarkup(candidate: {
  title: string;
  kind?: string;
  sourceType?: string;
  artifactType?: string;
  fileType?: string;
}): string {
  if (candidate.kind === "source") {
    if (candidate.sourceType === "youtube") {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-rose-500 shrink-0 inline-block"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><polygon points="10 15 15 12 10 9 10 15"/></svg>`;
    }
    if (candidate.sourceType === "url") {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500 shrink-0 inline-block"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`;
    }
    if (candidate.sourceType === "text") {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-500 shrink-0 inline-block"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-sky-500 shrink-0 inline-block"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>`;
  }

  if (candidate.kind === "artifact") {
    const at = candidate.artifactType || "";
    if (at.includes("mind")) {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-400 shrink-0 inline-block"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/></svg>`;
    }
    if (at.includes("quiz")) {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-400 shrink-0 inline-block"><circle cx="12" cy="12" r="10"/><path d="9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`;
    }
    if (at.includes("flashcard")) {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-400 shrink-0 inline-block"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.9a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 12.5-8.58 3.9a2 2 0 0 1-1.66 0L2 12.5"/><path d="m22 17.5-8.58 3.9a2 2 0 0 1-1.66 0L2 17.5"/></svg>`;
    }
    if (at.includes("slide") || at.includes("presentation")) {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-purple-400 shrink-0 inline-block"><path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/></svg>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary shrink-0 inline-block"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"/></svg>`;
  }

  if (candidate.kind === "directory") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground shrink-0 inline-block"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 8 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`;
  }

  if (candidate.kind === "session") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground shrink-0 inline-block"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground shrink-0 inline-block"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>`;
}

function createMentionBadgeElement(
  candidate: MentionCandidate,
  onOpenSourcePreview?: (id: string) => void,
  onOpenArtifactPreview?: (id: string) => void
): HTMLSpanElement {
  const badge = document.createElement("span");
  badge.contentEditable = "false";
  badge.setAttribute("data-mention-token", "true");

  const targetPath = candidate.fullPath || candidate.title;
  badge.setAttribute("data-mention-path", targetPath);
  badge.setAttribute("data-mention-kind", candidate.kind);
  badge.setAttribute("data-mention-title", candidate.title);
  if (candidate.sourceId) badge.setAttribute("data-source-id", candidate.sourceId);
  if (candidate.artifactId) badge.setAttribute("data-artifact-id", candidate.artifactId);

  badge.className =
    "inline-flex items-center gap-1.5 py-0.5 px-2 rounded-lg select-none cursor-pointer text-foreground bg-primary/10 hover:bg-primary/20 border border-primary/20 align-baseline font-sans text-[13px] mx-0.5 transition-colors group";
  badge.title = `Referenced ${candidate.title}`;

  const cleanName = candidate.title.replace(/\/$/, "");
  const iconHtml = getMentionIconMarkup(candidate);

  badge.innerHTML = `${iconHtml}<span class="leading-tight text-[13px] font-sans font-medium text-foreground">${cleanName}</span>`;

  if (candidate.kind === "source" && candidate.sourceId && onOpenSourcePreview) {
    badge.addEventListener("click", (e) => {
      e.stopPropagation();
      onOpenSourcePreview(candidate.sourceId!);
    });
  } else if (candidate.kind === "artifact" && candidate.artifactId && onOpenArtifactPreview) {
    badge.addEventListener("click", (e) => {
      e.stopPropagation();
      onOpenArtifactPreview(candidate.artifactId!);
    });
  }

  return badge;
}

function serializeContainer(container: Node, forActiveToken = false): string {
  const firstChild = container.childNodes[0];
  if (
    container.childNodes.length === 1 &&
    firstChild &&
    firstChild.nodeType === Node.ELEMENT_NODE &&
    (firstChild as HTMLElement).tagName === "BR"
  ) {
    return "";
  }

  let result = "";

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += (node.nodeValue || "").replace(/\u00A0/g, " ");
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
        if (result.length > 0 && !result.endsWith("\n")) {
          result += "\n";
        }
        const child0 = el.childNodes[0];
        if (el.childNodes.length === 1 && child0 && (child0 as HTMLElement).tagName === "BR") {
          return;
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
      placeholder = "Tanya apapun, gunakan @ untuk referensi materi belajar...",
      disabled = false,
      className,
      onSerializedChange,
      onMentionTokenChange,
      onOpenSourcePreview,
      onOpenArtifactPreview,
      onSend,
      onPasteFiles,
      onKeyDown,
    },
    ref
  ) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [isEmpty, setIsEmpty] = useState(true);
    const savedRangeRef = useRef<Range | null>(null);
    const isComposingRef = useRef(false);
    const lastEmittedValueRef = useRef<string>(initialValue || "");
    const lastPropValueRef = useRef<string>(initialValue || "");

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
      if (!editorRef.current) return;
      const editor = editorRef.current;
      const serialized = serializeContainer(editor);
      const textForCheck = editor.innerText.replace(/\r?\n/g, "").trim();
      const hasBadges = Boolean(editor.querySelector('[data-mention-token="true"]'));
      const empty = textForCheck.length === 0 && !hasBadges;
      setIsEmpty(empty);

      if (lastEmittedValueRef.current !== serialized) {
        lastEmittedValueRef.current = serialized;
        onSerializedChange?.(serialized);
      }

      // Check for active @ token at cursor
      try {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
          const range = sel.getRangeAt(0);
          if (editor.contains(range.startContainer)) {
            const preRange = document.createRange();
            preRange.selectNodeContents(editor);
            preRange.setEnd(range.startContainer, range.startOffset);

            const fragment = preRange.cloneContents();
            const tempContainer = document.createElement("div");
            tempContainer.appendChild(fragment);
            const textBeforeCaret = serializeContainer(tempContainer, true);

            const token = activeAtToken(textBeforeCaret, textBeforeCaret.length);
            onMentionTokenChange?.(token);
          } else {
            onMentionTokenChange?.(null);
          }
        } else {
          onMentionTokenChange?.(null);
        }
      } catch {
        onMentionTokenChange?.(null);
      }
    }, [onSerializedChange, onMentionTokenChange]);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          editorRef.current?.focus();
        },
        getText: () => {
          return editorRef.current ? serializeContainer(editorRef.current) : "";
        },
        clear: () => {
          if (editorRef.current) {
            editorRef.current.innerHTML = "";
            setIsEmpty(true);
            lastEmittedValueRef.current = "";
            onSerializedChange?.("");
            onMentionTokenChange?.(null);
          }
        },
        setText: (text: string) => {
          if (editorRef.current) {
            editorRef.current.innerText = text;
            setIsEmpty(!text.trim());
            lastEmittedValueRef.current = text;
            onSerializedChange?.(text);
          }
        },
        getElement: () => editorRef.current,
        insertAt: () => {
          const editor = editorRef.current;
          if (!editor) return;
          editor.focus();

          const sel = window.getSelection();
          let range: Range;
          if (savedRangeRef.current && editor.contains(savedRangeRef.current.startContainer)) {
            range = savedRangeRef.current;
          } else if (sel && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).startContainer)) {
            range = sel.getRangeAt(0);
          } else {
            range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
          }

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
          sel?.removeAllRanges();
          sel?.addRange(range);
          saveSelection();
          syncContent();
        },
        insertCommand: (cmd: string) => {
          const editor = editorRef.current;
          if (!editor) return;
          editor.focus();

          const sel = window.getSelection();
          let range: Range;
          if (savedRangeRef.current && editor.contains(savedRangeRef.current.startContainer)) {
            range = savedRangeRef.current;
          } else if (sel && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).startContainer)) {
            range = sel.getRangeAt(0);
          } else {
            range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
          }

          const textNode = document.createTextNode(cmd);
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.setEndAfter(textNode);
          sel?.removeAllRanges();
          sel?.addRange(range);
          saveSelection();
          syncContent();
        },
        insertText: (text: string) => {
          const editor = editorRef.current;
          if (!editor) return;
          editor.focus();

          const sel = window.getSelection();
          let range: Range;
          if (savedRangeRef.current && editor.contains(savedRangeRef.current.startContainer)) {
            range = savedRangeRef.current;
          } else if (sel && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).startContainer)) {
            range = sel.getRangeAt(0);
          } else {
            range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
          }

          const textNode = document.createTextNode(text);
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.setEndAfter(textNode);
          sel?.removeAllRanges();
          sel?.addRange(range);
          saveSelection();
          syncContent();
        },
        insertMention: (candidate: MentionCandidate) => {
          const editor = editorRef.current;
          if (!editor) return;
          editor.focus();

          const sel = window.getSelection();
          let range: Range;
          if (savedRangeRef.current && editor.contains(savedRangeRef.current.startContainer)) {
            range = savedRangeRef.current;
          } else if (sel && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).startContainer)) {
            range = sel.getRangeAt(0);
          } else {
            range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
          }

          // Replace active @token in text node
          if (range.startContainer.nodeType === Node.TEXT_NODE) {
            const node = range.startContainer;
            const fullText = node.nodeValue || "";
            const offset = range.startOffset;

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

          // Create badge element
          const badge = createMentionBadgeElement(
            candidate,
            onOpenSourcePreview,
            onOpenArtifactPreview
          );
          range.insertNode(badge);

          // Add trailing space
          const spaceNode = document.createTextNode(" ");
          badge.after(spaceNode);

          range.setStartAfter(spaceNode);
          range.setEndAfter(spaceNode);
          sel?.removeAllRanges();
          sel?.addRange(range);

          saveSelection();
          syncContent();
          onMentionTokenChange?.(null);
        },
        drillDirectory: (candidate: MentionCandidate) => {
          const editor = editorRef.current;
          if (!editor || !candidate.drillPath) return;
          editor.focus();

          const sel = window.getSelection();
          let range: Range;
          if (savedRangeRef.current && editor.contains(savedRangeRef.current.startContainer)) {
            range = savedRangeRef.current;
          } else if (sel && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).startContainer)) {
            range = sel.getRangeAt(0);
          } else {
            range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
          }

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
              sel?.removeAllRanges();
              sel?.addRange(range);
            }
          }

          saveSelection();
          syncContent();
        },
      }),
      [saveSelection, syncContent, onSerializedChange, onMentionTokenChange, onOpenSourcePreview, onOpenArtifactPreview]
    );

    // Sync initialValue changes from external props
    useEffect(() => {
      if (initialValue === undefined) return;
      if (initialValue === lastPropValueRef.current) return;
      lastPropValueRef.current = initialValue;

      // If matches what we already emitted from user typing, do nothing
      if (initialValue === lastEmittedValueRef.current) {
        return;
      }

      const editor = editorRef.current;
      const current = editor ? serializeContainer(editor) : "";
      if (current === initialValue) {
        lastEmittedValueRef.current = initialValue;
        return;
      }

      // If user is actively typing, don't let lagging state updates overwrite
      const isFocused = editor && (document.activeElement === editor || editor.contains(document.activeElement));
      if (isFocused && initialValue !== "" && current.startsWith(initialValue)) {
        return;
      }

      lastEmittedValueRef.current = initialValue;
      if (editor) {
        editor.innerText = initialValue;
        setIsEmpty(!initialValue.trim());
      }
    }, [initialValue]);

    return (
      <div className="relative w-full flex items-center min-h-[28px]">
        {/* Placeholder label */}
        {isEmpty && (
          <span className="absolute left-0 top-0 py-1 text-[14px] text-muted-foreground/60 pointer-events-none select-none font-sans truncate pr-2">
            {placeholder}
          </span>
        )}

        {/* ContentEditable element */}
        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          onInput={() => {
            if (!isComposingRef.current) {
              saveSelection();
              syncContent();
            }
          }}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false;
            saveSelection();
            syncContent();
          }}
          onKeyUp={() => {
            saveSelection();
            syncContent();
          }}
          onMouseUp={() => {
            saveSelection();
            syncContent();
          }}
          onPaste={(e) => {
            // Check for files
            const files = e.clipboardData?.files;
            if (files && files.length > 0 && onPasteFiles) {
              e.preventDefault();
              onPasteFiles(files);
              return;
            }

            // Paste as plain text
            e.preventDefault();
            const text = e.clipboardData.getData("text/plain");
            document.execCommand("insertText", false, text);
            saveSelection();
            syncContent();
          }}
          onKeyDown={(e) => {
            onKeyDown?.(e);
            if (e.defaultPrevented) return;

            // Enter without Shift -> Send
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend?.();
            }
          }}
          className={cn(
            "w-full min-h-[28px] max-h-48 overflow-y-auto outline-none focus:outline-none text-[14px] leading-5 text-foreground font-sans break-words whitespace-pre-wrap select-text py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            disabled ? "opacity-50 cursor-not-allowed" : "cursor-text",
            className
          )}
        />
      </div>
    );
  }
);

RichMentionEditor.displayName = "RichMentionEditor";
