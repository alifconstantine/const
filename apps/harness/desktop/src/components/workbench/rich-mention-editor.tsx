import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { ScrollArea, cn } from "@const/ui";
import { useI18n, translate } from "../../lib/i18n";
import { activeAtToken, type ActiveAtToken, type MentionCandidate } from "../../lib/mention-search";

function escapeMentionHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export interface ActiveSlashToken {
  range: [number, number];
  query: string;
}

export function activeSlashToken(text: string, cursorOffset: number): ActiveSlashToken | null {
  const textBefore = text.slice(0, cursorOffset);
  const match = /(?:^|\s)\/([a-zA-Z0-9_-]*)$/.exec(textBefore);
  if (!match) return null;
  const query = match[1] ?? "";
  const slashIndex = textBefore.length - query.length - 1;
  return {
    range: [slashIndex, cursorOffset],
    query,
  };
}

export interface RichMentionEditorRef {
  focus: () => void;
  insertMention: (candidate: MentionCandidate) => void;
  insertSkillMention: (skill: { id: string; name: string; slug: string; category?: string }) => void;
  drillDirectory: (candidate: MentionCandidate) => void;
  insertText: (text: string) => void;
  insertAt: () => void;
  insertSlash: () => void;
  insertCommand: (cmd: string) => void;
  clear: () => void;
  getText: () => string;
  setText: (text: string, options?: { focus?: boolean }) => void;
  getElement: () => HTMLDivElement | null;
}

export interface RichMentionEditorProps {
  initialValue?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onSerializedChange?: (value: string) => void;
  onMentionTokenChange?: (token: ActiveAtToken | null) => void;
  onSlashTokenChange?: (token: ActiveSlashToken | null) => void;
  onOpenFilePreview?: (path: string) => void;
  onOpenTrajectory?: (conversationIdOrPath: string) => void;
  onSend?: () => void;
  onPasteFiles?: (files: FileList) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}

/**
 * Returns crisp SVG or HTML for file icons matching VS Code / Antigravity aesthetics.
 */
export function getMentionIconMarkup({
  title,
  kind,
  fileType,
  pluginName,
}: {
  title: string;
  kind?: string;
  fileType?: string;
  pluginName?: string;
}): string {
  if (kind === "plugin") {
    if (pluginName === "const-guide") {
      const base = typeof window !== "undefined" && window.location.protocol === "file:" ? "./" : "/";
      return `<img src="${base}const-logo-light-transparent.png" alt="" width="14" height="14" class="shrink-0 inline-block dark:hidden" /><img src="${base}const-logo-dark-transparent.png" alt="" width="14" height="14" class="shrink-0 hidden dark:inline-block" />`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 inline-block"><path d="M10 22V7a1 1 0 0 0-1-1H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a1 1 0 0 0-1-1H2"/><rect x="14" y="2" width="8" height="8" rx="1"/></svg>`;
  }
  if (kind === "skill") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="text-primary shrink-0 inline-block"><path d="m18 2 4 4-10 10H8v-4L18 2Z"/><path d="m14 6 4 4"/><path d="M4 12v8a2 2 0 0 0 2 2h8"/><path d="m21.5 13-1.5-1.5-1.5 1.5 1.5 1.5Z"/><path d="m3 3 1.5 1.5L3 6l-1.5-1.5Z"/></svg>`;
  }

  if (kind === "directory") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="text-[#888888] dark:text-[#a0a0a0] shrink-0 inline-block"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 8 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`;
  }

  if (kind === "session") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="text-[#888888] dark:text-[#a0a0a0] shrink-0 inline-block"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`;
  }

  if (kind === "media" || fileType === "image") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="text-[#888888] dark:text-[#a0a0a0] shrink-0 inline-block"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`;
  }

  // Generic File
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="text-[#888888] dark:text-[#a0a0a0] shrink-0 inline-block"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>`;
}

/**
 * Returns HTML string for an inline mention badge matching AI input design.
 */
export function renderMentionBadgeHtml({
  href,
  title,
  kind,
  fileType,
}: {
  href: string;
  title: string;
  kind?: string;
  fileType?: string;
}): string {
  const isPlugin = kind === "plugin" || href.startsWith("plugin://");
  const isSkill = kind === "skill" || href.startsWith("skill://");
  const isSession =
    !isSkill &&
    (kind === "session" ||
      href.startsWith("trajectory://") ||
      href.startsWith("conversation://") ||
      href.includes("transcript.jsonl") ||
      href.includes("brain/"));

  const isDirectory =
    !isSkill &&
    !isSession &&
    (kind === "directory" || href.startsWith("folder://") || title.endsWith("/") || href.endsWith("/"));

  const resolvedKind = isPlugin ? "plugin" : isSkill ? "skill" : isSession ? "session" : isDirectory ? "directory" : (kind || "file");
  const cleanTitle = title.replace(/^[\s💬📁📄✨]+/, "").replace(/\/$/, "");

  const iconHtml = getMentionIconMarkup({
    title: cleanTitle,
    kind: resolvedKind,
    fileType,
    pluginName: isPlugin ? href.replace("plugin://", "") : undefined,
  });

  const tooltip = isPlugin ? translate("marketplace.pluginMentionTooltip").replace("{name}", cleanTitle) : isSkill
    ? `Skill: ${cleanTitle}`
    : isSession
    ? `Trajectory: ${cleanTitle} • Click to view`
    : isDirectory
    ? `Directory: ${cleanTitle} • Click to open`
    : `File: ${cleanTitle} • Click to preview`;

  return `<a href="${escapeMentionHtml(href)}" class="inline-mention-badge inline-flex items-center gap-1.5 py-0.5 px-1.5 rounded select-none cursor-pointer text-[#262626] dark:text-[#ececec] bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 align-baseline font-sans text-[13.5px] mx-0.5 transition-colors no-underline !text-[#262626] dark:!text-[#ececec] hover:!no-underline" data-mention-token="true" data-mention-kind="${escapeMentionHtml(resolvedKind)}" title="${escapeMentionHtml(tooltip)}">${iconHtml}<span class="leading-tight text-[13.5px] font-sans font-medium text-[#262626] dark:text-[#ececec]">${escapeMentionHtml(cleanTitle)}</span></a>`;
}

/**
 * Creates an inline non-editable mention badge DOM element with icon and filename.
 */
function createMentionBadgeElement(
  candidate: {
    title: string;
    fullPath?: string;
    path?: string;
    kind?: string;
    fileType?: string;
    conversationId?: string;
  },
  onOpenFilePreview?: (path: string) => void,
  onOpenTrajectory?: (conversationIdOrPath: string) => void
): HTMLSpanElement {
  const badge = document.createElement("span");
  badge.contentEditable = "false";
  badge.setAttribute("data-mention-token", "true");

  const targetPath = candidate.fullPath || candidate.path || candidate.title;
  const isPlugin = candidate.kind === "plugin" || targetPath.startsWith("plugin://");
  const isSkill = candidate.kind === "skill" || targetPath.startsWith("skill://");
  const isSession =
    !isSkill &&
    (candidate.kind === "session" ||
      Boolean(candidate.conversationId) ||
      (candidate.path && candidate.path.includes("transcript.jsonl")));

  const resolvedKind = isPlugin ? "plugin" : isSkill ? "skill" : isSession ? "session" : (candidate.kind || "file");
  badge.setAttribute("data-mention-path", targetPath);
  badge.setAttribute("data-mention-kind", resolvedKind);
  badge.setAttribute("data-mention-title", candidate.title);
  if (candidate.conversationId) {
    badge.setAttribute("data-mention-id", candidate.conversationId);
  }

  badge.className =
    "inline-flex items-center gap-1.5 py-0.5 px-1.5 rounded select-none cursor-pointer text-[#262626] dark:text-[#ececec] bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 align-baseline font-sans text-[13.5px] mx-0.5 transition-colors group";
  badge.title = isPlugin ? translate("marketplace.pluginMentionTooltip").replace("{name}", candidate.title) : isSkill
    ? `Skill: ${candidate.title}`
    : isSession
    ? `Trajectory: ${candidate.title} • Click to view`
    : `Click to preview ${candidate.title}`;

  const cleanName = candidate.title.replace(/^[\s💬📁📄✨]+/, "").replace(/\/$/, "");
  const iconHtml = getMentionIconMarkup({
    title: cleanName,
    kind: resolvedKind,
    fileType: candidate.fileType,
    pluginName: isPlugin ? targetPath.replace("plugin://", "") : undefined,
  });

  badge.innerHTML = iconHtml;
  const titleNode = document.createElement("span");
  titleNode.className = "leading-tight text-[13.5px] font-sans font-medium";
  titleNode.textContent = cleanName;
  badge.appendChild(titleNode);

  badge.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isPlugin) return;
    if (isSession) {
      const convoId =
        candidate.conversationId ||
        (candidate.path ? candidate.path.match(/brain\/([^\/\\]+)/)?.[1] : undefined);
      if (onOpenTrajectory && convoId) {
        onOpenTrajectory(convoId);
      } else if (onOpenFilePreview) {
        onOpenFilePreview(targetPath);
      }
    } else if (onOpenFilePreview) {
      onOpenFilePreview(targetPath);
    }
  });

  return badge;
}

/**
 * Serializes container nodes to prompt string (mentions become @[path] or @[title](path)).
 * When forActiveToken is true, completed mention badges serialize as spaces
 * so they never trigger autocomplete when the caret is adjacent to them.
 */
function serializeContainer(container: Node, forActiveToken = false): string {
  // If container only has a lone <br> (Chromium default empty container)
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
      // Normalize non-breaking spaces (\u00A0) from contenteditable to standard space
      result += (node.nodeValue || "").replace(/\u00A0/g, " ");
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.getAttribute("data-mention-token") === "true") {
        if (forActiveToken) {
          result += " ";
        } else {
          const kind = el.getAttribute("data-mention-kind") || "file";
          const title = el.getAttribute("data-mention-title") || "";
          const path = el.getAttribute("data-mention-path") || title;
          if (kind === "skill") {
            const cleanPath = path.startsWith("skill://") ? path : `skill://${path}`;
            result += `/[${title}](${cleanPath})`;
          } else if (kind === "plugin") {
            result += `@[${title}](${path})`;
          } else if (kind === "session") {
            const cleanTitle = title || path.split("/").filter(Boolean).pop() || "Chat";
            result += `@[${cleanTitle}](${path})`;
          } else {
            result += `@[${path}]`;
          }
        }
      } else if (el.tagName === "BR") {
        result += "\n";
      } else if (el.tagName === "DIV" || el.tagName === "P") {
        // If it's a div block inserted on enter
        if (result.length > 0 && !result.endsWith("\n")) {
          result += "\n";
        }
        // If div contains only a single BR (empty line), the newline is already represented
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
      placeholder,
      disabled = false,
      className,
      onSerializedChange,
      onMentionTokenChange,
      onSlashTokenChange,
      onOpenFilePreview,
      onOpenTrajectory,
      onSend,
      onPasteFiles,
      onKeyDown,
    },
    ref
  ) => {
    const { t } = useI18n();
    const effectivePlaceholder = placeholder ?? t("workbench.askPlaceholder");
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
      const editor = editorRef.current;
      if (!editor) return;

      const serialized = serializeContainer(editor);
      const hasBadges = editor.querySelector("[data-mention-token]") !== null;
      const textEmpty = serialized.length === 0 && !hasBadges;
      setIsEmpty(textEmpty);

      lastEmittedValueRef.current = serialized;
      onSerializedChange?.(serialized);

      // Check activeAtToken and activeSlashToken based on cursor position
      try {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
          const range = sel.getRangeAt(0);
          if (editor.contains(range.startContainer)) {
            const preRange = document.createRange();
            preRange.selectNodeContents(editor);
            preRange.setEnd(range.startContainer, range.startOffset);

            const fragment = preRange.cloneContents();
            const temp = document.createElement("div");
            temp.appendChild(fragment);
            const textBeforeCaret = serializeContainer(temp, true);

            const token = activeAtToken(textBeforeCaret, textBeforeCaret.length);
            onMentionTokenChange?.(token);

            if (!token) {
              const slashToken = activeSlashToken(textBeforeCaret, textBeforeCaret.length);
              onSlashTokenChange?.(slashToken);
            } else {
              onSlashTokenChange?.(null);
            }
          } else {
            onMentionTokenChange?.(null);
            onSlashTokenChange?.(null);
          }
        } else {
          onMentionTokenChange?.(null);
          onSlashTokenChange?.(null);
        }
      } catch {
        onMentionTokenChange?.(null);
        onSlashTokenChange?.(null);
      }
    }, [onSerializedChange, onMentionTokenChange, onSlashTokenChange]);

    const setEditorFromSerializedText = useCallback(
      (text: string) => {
        const editor = editorRef.current;
        if (!editor) return;

        editor.innerHTML = "";
        if (!text) {
          setIsEmpty(true);
          lastEmittedValueRef.current = "";
          onSerializedChange?.("");
          return;
        }

        // Match @[Title](path) or /[Title](path) or @[path] or /[path]
        const mentionRegex = /(?:@|\/)\[([^\]]+)\](?:\(([^)]+)\))?/g;
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = mentionRegex.exec(text)) !== null) {
          const before = text.slice(lastIndex, match.index);
          if (before) {
            editor.appendChild(document.createTextNode(before));
          }

          const isSlashBadge = match[0].startsWith("/[");
          const rawTitle = match[1];
          const rawLink = match[2];
          if (!rawTitle) continue;

          let kind: "file" | "directory" | "session" | "skill" | "plugin" = isSlashBadge ? "skill" : "file";
          let targetPath = rawLink || rawTitle;
          let displayTitle = rawTitle;
          let convoId: string | undefined = undefined;

          if (rawLink?.startsWith("plugin://")) {
            kind = "plugin";
          } else if (isSlashBadge || (rawLink && rawLink.startsWith("skill://")) || rawTitle.startsWith("skill:")) {
            kind = "skill";
            displayTitle = rawTitle.replace(/^skill:/, "");
            targetPath = rawLink || `skill://${displayTitle}`;
          } else if (rawLink && (rawLink.includes("transcript.jsonl") || rawLink.startsWith("brain/"))) {
            kind = "session";
            convoId = rawLink.match(/brain\/([^\/\\]+)/)?.[1];
          } else if (rawTitle.startsWith("chat:") || rawTitle.startsWith("session:")) {
            kind = "session";
            const parts = rawTitle.split(":");
            convoId = parts[1];
            displayTitle = parts.slice(2).join(":") || convoId || "Chat";
            targetPath = `brain/${convoId}/.system_generated/logs/transcript.jsonl`;
          } else if (targetPath.endsWith("/")) {
            kind = "directory";
          } else {
            kind = "file";
            displayTitle = targetPath.replace(/\\/g, "/").split("/").filter(Boolean).pop() || targetPath;
          }

          const badge = createMentionBadgeElement(
            {
              title: displayTitle,
              fullPath: targetPath,
              path: targetPath,
              kind,
              conversationId: convoId,
            },
            onOpenFilePreview,
            onOpenTrajectory
          );
          editor.appendChild(badge);
          lastIndex = mentionRegex.lastIndex;
        }

        const remainder = text.slice(lastIndex);
        if (remainder) {
          editor.appendChild(document.createTextNode(remainder));
        }

        const hasBadges = editor.querySelector("[data-mention-token]") !== null;
        setIsEmpty(text.length === 0 && !hasBadges);
        lastEmittedValueRef.current = text;
        onSerializedChange?.(text);
      },
      [onOpenFilePreview, onOpenTrajectory, onSerializedChange]
    );

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
      setEditorFromSerializedText(initialValue);
    }, [initialValue, setEditorFromSerializedText]);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          const editor = editorRef.current;
          if (!editor) return;
          editor.focus();
          const sel = window.getSelection();
          if (!sel || sel.rangeCount === 0 || !editor.contains(sel.anchorNode)) {
            const range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
            sel?.removeAllRanges();
            sel?.addRange(range);
            savedRangeRef.current = range.cloneRange();
          }
        },
        clear: () => {
          if (editorRef.current) {
            editorRef.current.innerHTML = "";
            lastEmittedValueRef.current = "";
            lastPropValueRef.current = "";
            setIsEmpty(true);
            onSerializedChange?.("");
            onMentionTokenChange?.(null);
            savedRangeRef.current = null;
          }
        },
        getText: () => {
          return editorRef.current ? serializeContainer(editorRef.current) : "";
        },
        setText: (text: string, options?: { focus?: boolean }) => {
          lastEmittedValueRef.current = text;
          lastPropValueRef.current = text;
          setEditorFromSerializedText(text);
          if (editorRef.current && options?.focus !== false) {
            editorRef.current.focus();
            const range = document.createRange();
            range.selectNodeContents(editorRef.current);
            range.collapse(false);
            const sel = window.getSelection();
            if (sel) {
              sel.removeAllRanges();
              sel.addRange(range);
            }
            savedRangeRef.current = range.cloneRange();
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
          if (sel && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).startContainer)) {
            range = sel.getRangeAt(0);
          } else if (savedRangeRef.current && editor.contains(savedRangeRef.current.startContainer)) {
            range = savedRangeRef.current;
          } else {
            range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
          }

          // Chromium may leave the caret on the editor after its final text node.
          if (range.startContainer.nodeType === Node.ELEMENT_NODE && range.startOffset > 0) {
            let previous: Node | undefined = range.startContainer.childNodes[range.startOffset - 1];
            while (previous?.lastChild && !(previous instanceof HTMLElement && previous.dataset.mentionToken === "true")) previous = previous.lastChild;
            if (previous?.nodeType === Node.TEXT_NODE) {
              const offset = previous.nodeValue?.length ?? 0;
              range.setStart(previous, offset);
              range.setEnd(previous, offset);
            }
          }
          // Find and replace active @token in text node
          if (range.startContainer.nodeType === Node.TEXT_NODE) {
            const node = range.startContainer;
            const fullText = node.nodeValue || "";
            const offset = range.startOffset;

            // Look back from offset to find the '@' or '@"' trigger
            const beforeText = fullText.slice(0, offset);
            const tokenMatch = /(?:^|\s)(@"[^"]*|@[^\n\[\]@"]{0,40})$/.exec(beforeText);

            if (tokenMatch && tokenMatch[1]) {
              const matchedPrefix = tokenMatch[1];
              const tokenStart = offset - matchedPrefix.length;
              range.setStart(node, tokenStart);
              range.setEnd(node, offset);
              range.deleteContents();
            }
          }

          // Create and insert badge
          const badge = createMentionBadgeElement(candidate, onOpenFilePreview, onOpenTrajectory);
          range.insertNode(badge);

          // Insert trailing space so cursor is positioned right after
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
        insertSlash: () => {
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
          const insertStr = needsSpace ? " /" : "/";
          const textNode = document.createTextNode(insertStr);
          range.insertNode(textNode);

          range.setStartAfter(textNode);
          range.setEndAfter(textNode);
          sel?.removeAllRanges();
          sel?.addRange(range);
          saveSelection();
          syncContent();
        },
        insertSkillMention: (skill: { id: string; name: string; slug: string; category?: string }) => {
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

          // Find and replace active /slash token in text node
          if (range.startContainer.nodeType === Node.TEXT_NODE) {
            const node = range.startContainer;
            const fullText = node.nodeValue || "";
            const offset = range.startOffset;

            const beforeText = fullText.slice(0, offset);
            const tokenMatch = /(?:^|\s)\/([a-zA-Z0-9_-]*)$/.exec(beforeText);

            if (tokenMatch) {
              const matchLen = tokenMatch[1] ? tokenMatch[1].length + 1 : 1;
              const tokenStart = offset - matchLen;
              range.setStart(node, tokenStart);
              range.setEnd(node, offset);
              range.deleteContents();
            }
          }

          // Create badge element with kind="skill" and pencil-sparkles icon
          const badge = createMentionBadgeElement(
            {
              title: skill.name,
              fullPath: `skill://${skill.slug}`,
              path: `skill://${skill.slug}`,
              kind: "skill",
            },
            onOpenFilePreview,
            onOpenTrajectory
          );
          range.insertNode(badge);

          const spaceNode = document.createTextNode(" ");
          badge.after(spaceNode);

          range.setStartAfter(spaceNode);
          range.setEndAfter(spaceNode);
          sel?.removeAllRanges();
          sel?.addRange(range);

          saveSelection();
          syncContent();
          onSlashTokenChange?.(null);
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

              saveSelection();
              syncContent();
            }
          }
        },
      }),
      [onOpenFilePreview, saveSelection, setEditorFromSerializedText, syncContent, onMentionTokenChange]
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

      // Do nothing during active IME composition
      if (e.nativeEvent.isComposing || (e as any).keyCode === 229) {
        return;
      }

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
              const prevPrev = prev.previousSibling;
              const parent = prev.parentNode;
              prev.remove();
              if (parent) {
                const newRange = document.createRange();
                if (prevPrev && prevPrev.nodeType === Node.TEXT_NODE) {
                  newRange.setStart(prevPrev, (prevPrev.nodeValue || "").length);
                  newRange.collapse(true);
                } else if (range.startContainer.nodeType === Node.TEXT_NODE) {
                  newRange.setStart(range.startContainer, 0);
                  newRange.collapse(true);
                } else {
                  newRange.setStart(parent, 0);
                  newRange.collapse(true);
                }
                sel.removeAllRanges();
                sel.addRange(newRange);
                savedRangeRef.current = newRange.cloneRange();
              }
              syncContent();
              return;
            }
          }

          // If caret is directly on element node container
          if (range.startContainer.nodeType === Node.ELEMENT_NODE && range.startOffset > 0) {
            const prev = range.startContainer.childNodes[range.startOffset - 1];
            if (prev && prev.nodeType === Node.ELEMENT_NODE && (prev as HTMLElement).dataset.mentionToken) {
              e.preventDefault();
              const prevPrev = prev.previousSibling;
              const parent = prev.parentNode;
              prev.remove();
              if (parent) {
                const newRange = document.createRange();
                if (prevPrev && prevPrev.nodeType === Node.TEXT_NODE) {
                  newRange.setStart(prevPrev, (prevPrev.nodeValue || "").length);
                  newRange.collapse(true);
                } else {
                  newRange.setStart(parent, Math.max(0, range.startOffset - 1));
                  newRange.collapse(true);
                }
                sel.removeAllRanges();
                sel.addRange(newRange);
                savedRangeRef.current = newRange.cloneRange();
              }
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
      <div data-composer-editor className="relative w-full min-h-[28px] grid min-w-0">
        {isEmpty && (
          <div data-composer-placeholder className="col-start-1 row-start-1 min-w-0 pointer-events-none select-none text-[14px] leading-5 py-0.5 pr-2 whitespace-pre-wrap break-words text-[#a9a9a9] dark:text-[#5d5d5d] font-sans">
            {effectivePlaceholder}
          </div>
        )}

        <ScrollArea
          data-composer-scroll
          className="col-start-1 row-start-1 w-full max-h-48 min-w-0 min-h-0"
          viewportClassName="[&>div[style]]:!block"
        >
          <div
            ref={editorRef}
            contentEditable={!disabled}
            role="textbox"
            aria-multiline="true"
            aria-label={effectivePlaceholder}
            suppressContentEditableWarning
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={() => {
              isComposingRef.current = false;
              saveSelection();
              syncContent();
            }}
            onInput={() => {
              if (isComposingRef.current) return;
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
              "w-full min-h-[28px] outline-none font-sans text-[14px] leading-5 text-[#262626] dark:text-[#d4d4d4] py-0.5 whitespace-pre-wrap break-words cursor-text pr-2",
              className
            )}
          />
        </ScrollArea>
      </div>
    );
  }
);

RichMentionEditor.displayName = "RichMentionEditor";
