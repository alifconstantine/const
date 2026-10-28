import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  Eye,
  Code,
  Loader2,
  Folder,
  FolderOpen,
  FolderTree,
  RotateCw,
  MoreVertical,
  PanelRight,
  FileCode,
  Search,
  X,
} from "lucide-react";
import { ScrollArea, cn } from "@const/ui";
import { FileIcon } from "../workbench/file-icon";
import { MarkdownContent } from "../workbench/markdown-content";
import { highlightCodeToHtmlLines } from "../../lib/code-highlighter";
import { useCodeFontSize } from "../../lib/theme";
import type { RightPaneTab } from "./types";
import { useTranslation } from "../../lib/i18n";
import { useRemoteRuntime } from "../../lib/remote-runtime";
const ExcalidrawEditor = React.lazy(() => import("../mcp-apps/excalidraw-editor"));

interface FilePreviewTabProps {
  tab: RightPaneTab;
  workspacePath?: string;
  onOpenFilePreview?: (filePath: string) => void;
  onOpenBrowser?: (url: string) => void;
  onUpdateTab?: (tabId: string, updates: Partial<RightPaneTab>) => void;
}

interface TreeEntry {
  name: string;
  path: string; // workspace-relative path e.g. "apps/harness"
  fullPath: string; // absolute path
  isDirectory: boolean;
}

interface BreadcrumbCrumb {
  name: string;
  relPath: string;
  parentRelPath: string;
}

export function FilePreviewTab(props: FilePreviewTabProps) {
  if (props.tab.filePath && /[\\/]artifacts[\\/]diagrams[\\/][a-f0-9-]{36}\.excalidraw$/i.test(props.tab.filePath)) return <React.Suspense fallback={<div className="h-full grid place-items-center"><Loader2 className="size-5 animate-spin text-[#969696]" /></div>}><ExcalidrawEditor filePath={props.tab.filePath} /></React.Suspense>;
  return <StandardFilePreviewTab {...props} />;
}

function StandardFilePreviewTab({
  tab,
  workspacePath: propWorkspacePath,
  onOpenFilePreview,
  onOpenBrowser,
  onUpdateTab,
}: FilePreviewTabProps) {
  const { t } = useTranslation();
  const remote = useRemoteRuntime();
  const [codeFontSize] = useCodeFontSize();

  // Active workspace path (prop or from tab cwd/project)
  const workspacePath = useMemo(() => {
    if (propWorkspacePath && propWorkspacePath !== "Outside Project") {
      return propWorkspacePath;
    }
    if (tab.cwd && tab.cwd !== "Outside Project") {
      return tab.cwd;
    }
    if (tab.project && tab.project !== "Outside Project") {
      return tab.project;
    }
    return undefined;
  }, [propWorkspacePath, tab.cwd, tab.project]);

  const rootFolderName = useMemo(() => {
    if (!workspacePath) return "Workspace";
    return (
      workspacePath.replace(/\\/g, "/").split("/").filter(Boolean).pop() ||
      "Workspace"
    );
  }, [workspacePath]);

  // Active file being viewed
  const [activeFilePath, setActiveFilePath] = useState<string>(tab.filePath || "");
  const [isDirectory, setIsDirectory] = useState<boolean>(
    tab.type === "directory" || Boolean(tab.isDirectory)
  );
  const [content, setContent] = useState<string>(tab.newContent || tab.previousContent || "");
  const [isLoading, setIsLoading] = useState<boolean>(!content && Boolean(tab.filePath));
  const [copied, setCopied] = useState(false);
  const [isWorkspaceTreeOpen, setIsWorkspaceTreeOpen] = useState(() => !remote?.mobile);
  const [searchQuery, setSearchQuery] = useState("");

  // Popover menus state
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const [openBreadcrumbMenu, setOpenBreadcrumbMenu] = useState<{
    crumbName: string;
    parentRelPath: string;
    siblings: TreeEntry[];
    left: number;
  } | null>(null);
  const breadcrumbMenuRef = useRef<HTMLDivElement>(null);

  // Code folding state (collapsed line indices)
  const [collapsedLines, setCollapsedLines] = useState<Set<number>>(new Set());

  // Tree directory state
  const [treeData, setTreeData] = useState<Record<string, TreeEntry[]>>({});
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set([""]));
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());

  // Compute normalized paths & breadcrumbs
  const normalizedRaw = (activeFilePath || tab.title || "").replace(/\\/g, "/");
  const fileName = normalizedRaw.split("/").filter(Boolean).pop() || normalizedRaw;
  const isMarkdown =
    fileName.toLowerCase().endsWith(".md") ||
    fileName.toLowerCase().endsWith(".markdown");

  const [mode, setMode] = useState<"formatted" | "raw">(
    tab.previewMode || (isMarkdown ? "formatted" : "raw")
  );

  const activeRelPath = useMemo(() => {
    if (!workspacePath || !activeFilePath) return "";
    const normWorkspace = workspacePath.replace(/\\/g, "/").toLowerCase();
    const normFile = activeFilePath.replace(/\\/g, "/");
    if (normFile.toLowerCase().startsWith(normWorkspace)) {
      return normFile.slice(normWorkspace.length).replace(/^\/+/, "");
    }
    return activeFilePath.replace(/\\/g, "/");
  }, [workspacePath, activeFilePath]);

  const breadcrumbSegments = useMemo<BreadcrumbCrumb[]>(() => {
    if (!activeRelPath) return [];
    const parts = activeRelPath.split("/").filter(Boolean);
    parts.pop(); // Remove active file/folder name, handled separately

    const list: BreadcrumbCrumb[] = [];
    let parentRelPath = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i] || "";
      if (!part) continue;
      const relPath = parentRelPath ? `${parentRelPath}/${part}` : part;
      list.push({
        name: part,
        relPath,
        parentRelPath,
      });
      parentRelPath = relPath;
    }
    return list;
  }, [activeRelPath]);

  // Load directory entries via IPC
  const fetchDirectory = useCallback(
    async (relPath: string) => {
      if (!workspacePath || !window.electron?.readDirectory) return [];
      setLoadingPaths((prev) => new Set(prev).add(relPath));
      try {
        const entries = await window.electron.readDirectory(relPath, workspacePath);
        setTreeData((prev) => ({
          ...prev,
          [relPath]: entries,
        }));
        return entries;
      } catch (err) {
        console.error("Failed to read directory:", err);
        return [];
      } finally {
        setLoadingPaths((prev) => {
          const next = new Set(prev);
          next.delete(relPath);
          return next;
        });
      }
    },
    [workspacePath]
  );

  // Auto-expand directory tree down to current activeFilePath
  const expandToActiveFile = useCallback(
    async (filePath: string, isDir = false) => {
      if (!workspacePath || !filePath) return;
      const normWorkspace = workspacePath.replace(/\\/g, "/").toLowerCase();
      let normFile = filePath.replace(/\\/g, "/");

      let rel = normFile;
      if (normFile.toLowerCase().startsWith(normWorkspace)) {
        rel = normFile.slice(normWorkspace.length).replace(/^\/+/, "");
      }

      const segments = rel.split("/").filter(Boolean);
      if (!isDir) {
        segments.pop(); // Remove file name only if it's a file
      }

      const pathsToExpand = new Set<string>([""]);
      let currentAcc = "";
      for (const seg of segments) {
        currentAcc = currentAcc ? `${currentAcc}/${seg}` : seg;
        pathsToExpand.add(currentAcc);
      }

      setExpandedPaths((prev) => {
        const next = new Set(prev);
        for (const p of pathsToExpand) next.add(p);
        return next;
      });

      // Fetch directories along the path
      for (const p of pathsToExpand) {
        if (!treeData[p]) {
          await fetchDirectory(p);
        }
      }
    },
    [workspacePath, treeData, fetchDirectory]
  );

  // When tab props change externally, sync state
  useEffect(() => {
    if (tab.filePath !== undefined && tab.filePath !== activeFilePath) {
      setActiveFilePath(tab.filePath);
      if (tab.newContent) {
        setContent(tab.newContent);
      } else {
        setContent("");
      }
    }
    if (tab.type === "directory" || tab.isDirectory) {
      setIsDirectory(true);
    }
  }, [tab.filePath, tab.newContent, tab.type, tab.isDirectory]);

  // Load file or directory content when activeFilePath changes
  useEffect(() => {
    if (!activeFilePath) {
      if (tab.type === "directory" || isDirectory) {
        setIsDirectory(true);
        if (workspacePath) {
          setIsLoading(true);
          fetchDirectory("").then(() => setIsLoading(false));
        } else {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
      return;
    }

    if (window.electron?.readFile) {
      setIsLoading(true);
      window.electron.readFile(activeFilePath, workspacePath).then(async (res) => {
        if (res?.isDirectory || res?.error === "Path is a directory") {
          setIsDirectory(true);
          setContent("");
          await fetchDirectory(activeRelPath);
          setExpandedPaths((prev) => new Set(prev).add(activeRelPath));
          if (tab.type !== "directory" || !tab.isDirectory) {
            onUpdateTab?.(tab.id, {
              type: "directory",
              isDirectory: true,
            });
          }
        } else if (res && res.content !== undefined) {
          setIsDirectory(false);
          setContent(res.content);
          if (tab.isDirectory) {
            onUpdateTab?.(tab.id, {
              type: "file_preview",
              isDirectory: false,
            });
          }
        } else if (res?.error) {
          if (res.error.toLowerCase().includes("directory") && window.electron?.readDirectory) {
            setIsDirectory(true);
            setContent("");
            await fetchDirectory(activeRelPath);
            setExpandedPaths((prev) => new Set(prev).add(activeRelPath));
            onUpdateTab?.(tab.id, {
              type: "directory",
              isDirectory: true,
            });
          } else {
            setIsDirectory(false);
            setContent(`// Failed to read file: ${res.error}`);
          }
        }
        setIsLoading(false);
      });
    } else if (!activeFilePath) {
      setIsLoading(false);
    }
  }, [activeFilePath, workspacePath, activeRelPath]);

  // Initial load of root directory & auto-expand
  useEffect(() => {
    if (workspacePath) {
      fetchDirectory("");
      if (activeFilePath) {
        expandToActiveFile(activeFilePath, isDirectory);
      }
    }
  }, [workspacePath]);

  // When activeFilePath changes, expand the tree to it
  useEffect(() => {
    if (activeFilePath && workspacePath) {
      expandToActiveFile(activeFilePath, isDirectory);
    }
  }, [activeFilePath, isDirectory, workspacePath]);

  // Refresh entire tree
  const handleRefreshTree = async () => {
    if (!workspacePath) return;
    await fetchDirectory("");
    for (const p of expandedPaths) {
      if (p !== "") {
        await fetchDirectory(p);
      }
    }
  };

  // Toggle folder expansion in tree
  const toggleFolder = async (dirRelPath: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(dirRelPath)) {
        next.delete(dirRelPath);
      } else {
        next.add(dirRelPath);
      }
      return next;
    });

    if (!treeData[dirRelPath]) {
      await fetchDirectory(dirRelPath);
    }
  };

  // Navigate directly to a folder
  const handleNavigateToFolder = (entry: TreeEntry) => {
    setActiveFilePath(entry.fullPath);
    setIsDirectory(true);
    setSearchQuery("");
    fetchDirectory(entry.path);
    setExpandedPaths((prev) => new Set(prev).add(entry.path));
    onUpdateTab?.(tab.id, {
      filePath: entry.fullPath,
      title: entry.name,
      type: "directory",
      isDirectory: true,
    });
  };

  // Navigate to breadcrumb crumb
  const handleNavigateToCrumb = (crumb: BreadcrumbCrumb) => {
    setActiveFilePath(crumb.relPath);
    setIsDirectory(true);
    setSearchQuery("");
    fetchDirectory(crumb.relPath);
    setExpandedPaths((prev) => new Set(prev).add(crumb.relPath));
    onUpdateTab?.(tab.id, {
      filePath: crumb.relPath,
      title: crumb.name,
      type: "directory",
      isDirectory: true,
    });
  };

  // Navigate to workspace root
  const handleNavigateToRoot = () => {
    setActiveFilePath("");
    setIsDirectory(true);
    setSearchQuery("");
    fetchDirectory("");
    onUpdateTab?.(tab.id, {
      filePath: "",
      title: rootFolderName,
      type: "directory",
      isDirectory: true,
    });
  };

  // Select file from tree
  const handleSelectFile = (entry: TreeEntry) => {
    if (entry.isDirectory) {
      handleNavigateToFolder(entry);
    } else {
      setActiveFilePath(entry.fullPath);
      setIsDirectory(false);
      setSearchQuery("");
      onUpdateTab?.(tab.id, {
        filePath: entry.fullPath,
        title: entry.name,
        type: "file_preview",
        isDirectory: false,
      });
    }
  };

  // Filtered entries for main directory view
  const currentDirEntries = useMemo(() => {
    const entries = treeData[activeRelPath] || [];
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase().trim();
    return entries.filter((e) => e.name.toLowerCase().includes(q));
  }, [treeData, activeRelPath, searchQuery]);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
      if (
        breadcrumbMenuRef.current &&
        !breadcrumbMenuRef.current.contains(e.target as Node)
      ) {
        setOpenBreadcrumbMenu(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Click on a breadcrumb folder segment to open sibling dropdown popover
  const handleBreadcrumbClick = async (
    e: React.MouseEvent<HTMLButtonElement>,
    crumb: BreadcrumbCrumb
  ) => {
    e.stopPropagation();
    const buttonRect = e.currentTarget.getBoundingClientRect();
    const parentContainerRect = e.currentTarget.closest(".flex-1")?.getBoundingClientRect();
    const leftOffset = parentContainerRect
      ? Math.max(10, buttonRect.left - parentContainerRect.left)
      : buttonRect.left;

    let siblings = treeData[crumb.parentRelPath];
    if (!siblings) {
      siblings = await fetchDirectory(crumb.parentRelPath);
    }
    const siblingDirs = (siblings || []).filter((s) => s.isDirectory);

    setOpenBreadcrumbMenu({
      crumbName: crumb.name,
      parentRelPath: crumb.parentRelPath,
      siblings: siblingDirs,
      left: leftOffset,
    });
  };

  const handleNavigateSibling = async (sibling: TreeEntry) => {
    setOpenBreadcrumbMenu(null);
    handleNavigateToFolder(sibling);
  };

  // Actions
  const handleCopyContent = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevealInExplorer = () => {
    setIsMoreMenuOpen(false);
    const target = activeFilePath || workspacePath;
    if (target && window.electron?.showInFolder) {
      window.electron.showInFolder(target);
    } else if (target && window.electron?.openPath) {
      window.electron.openPath(target);
    }
  };

  const handleCopyFullPath = () => {
    setIsMoreMenuOpen(false);
    if (activeFilePath) {
      navigator.clipboard.writeText(activeFilePath);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleCopyRelPath = () => {
    setIsMoreMenuOpen(false);
    if (activeRelPath) {
      navigator.clipboard.writeText(activeRelPath);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  // Syntax highlighting
  const ext = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() || "" : "";
  const highlightedLines = useMemo(() => {
    if (isMarkdown && mode === "formatted") return [];
    return highlightCodeToHtmlLines(content, ext);
  }, [content, ext, isMarkdown, mode]);

  const rawLines = useMemo(() => content.split(/\r?\n/), [content]);

  // Check if a line begins a foldable block
  const isFoldableLine = useCallback((lineText: string) => {
    const trimmed = lineText.trim();
    return (
      trimmed.endsWith("{") ||
      trimmed.endsWith("(") ||
      trimmed.endsWith("[") ||
      trimmed.endsWith("=>") ||
      trimmed.endsWith(":") ||
      /\b(function|class|interface|type)\b.*[{([][^})\]]*$/.test(trimmed)
    );
  }, []);

  // Compute closing line of a folded block
  const getFoldEndLine = useCallback((lines: string[], startIdx: number): number => {
    const startLine = lines[startIdx] || "";
    let openBraces = 0;
    let openParens = 0;
    let openBrackets = 0;
    let hasDelimiter = false;

    for (let i = startIdx; i < lines.length; i++) {
      const l = lines[i] || "";
      for (let c = 0; c < l.length; c++) {
        const ch = l[c];
        if (ch === "{") {
          openBraces++;
          hasDelimiter = true;
        } else if (ch === "}") {
          openBraces--;
        } else if (ch === "(") {
          openParens++;
          hasDelimiter = true;
        } else if (ch === ")") {
          openParens--;
        } else if (ch === "[") {
          openBrackets++;
          hasDelimiter = true;
        } else if (ch === "]") {
          openBrackets--;
        }
      }
      if (
        i > startIdx &&
        hasDelimiter &&
        openBraces <= 0 &&
        openParens <= 0 &&
        openBrackets <= 0
      ) {
        return i;
      }
    }

    // Fallback: indentation-based folding (e.g. Python, YAML)
    const startIndentMatch = startLine.match(/^\s*/);
    const startIndent = startIndentMatch ? startIndentMatch[0].length : 0;
    for (let i = startIdx + 1; i < lines.length; i++) {
      const l = lines[i] || "";
      if (!l.trim()) continue;
      const indentMatch = l.match(/^\s*/);
      const indent = indentMatch ? indentMatch[0].length : 0;
      if (indent <= startIndent) {
        return i - 1;
      }
    }

    return lines.length - 1;
  }, []);

  // Set of lines hidden due to collapsed parent blocks
  const hiddenLineIndices = useMemo(() => {
    const hidden = new Set<number>();
    for (const startIdx of collapsedLines) {
      const endIdx = getFoldEndLine(rawLines, startIdx);
      for (let i = startIdx + 1; i <= endIdx; i++) {
        hidden.add(i);
      }
    }
    return hidden;
  }, [collapsedLines, rawLines, getFoldEndLine]);

  const toggleFoldLine = (lineIdx: number) => {
    setCollapsedLines((prev) => {
      const next = new Set(prev);
      if (next.has(lineIdx)) {
        next.delete(lineIdx);
      } else {
        next.add(lineIdx);
      }
      return next;
    });
  };

  // Tree items rendering
  const renderTreeItem = (entry: TreeEntry, depth: number) => {
    const isExpanded = expandedPaths.has(entry.path);
    const isSelected = Boolean(
      activeFilePath &&
        (entry.fullPath === activeFilePath ||
          (activeRelPath && entry.path === activeRelPath))
    );
    const children = treeData[entry.path] || [];
    const isEntryLoading = loadingPaths.has(entry.path);

    if (entry.isDirectory) {
      return (
        <React.Fragment key={entry.path}>
          <div
            onClick={() => toggleFolder(entry.path)}
            style={{ paddingLeft: `${depth * 14 + 10}px` }}
            className="flex items-center gap-1.5 py-1 pr-2 text-xs text-[#a0a0a0] hover:text-white hover:bg-white/5 rounded-md cursor-pointer transition-colors select-none group"
            title={entry.name}
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-neutral-500 group-hover:text-neutral-300 shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-neutral-500 group-hover:text-neutral-300 shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-3.5 h-3.5 text-[#8e8e8e] group-hover:text-white shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-[#8e8e8e] group-hover:text-white shrink-0" />
            )}
            <span className="truncate text-[12px]">{entry.name}</span>
            {isEntryLoading && (
              <Loader2 className="w-2.5 h-2.5 animate-spin text-neutral-500 ml-auto shrink-0" />
            )}
          </div>
          {isExpanded && (
            <div>
              {children.map((child) => renderTreeItem(child, depth + 1))}
            </div>
          )}
        </React.Fragment>
      );
    }

    return (
      <div
        key={entry.path}
        onClick={() => handleSelectFile(entry)}
        style={{ paddingLeft: `${depth * 14 + 22}px` }}
        className={cn(
          "flex items-center gap-2 py-1 pr-2 text-xs rounded-md cursor-pointer transition-colors select-none group my-0.5",
          isSelected
            ? "bg-[#2b2b2b] text-white font-medium shadow-xs"
            : "text-[#a0a0a0] hover:text-white hover:bg-white/5"
        )}
        title={entry.name}
      >
        <FileIcon filename={entry.name} className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate text-[12px]">{entry.name}</span>
      </div>
    );
  };

  // Main pane directory items rendering
  const renderMainDirItem = (entry: TreeEntry, depth = 0) => {
    const isExpanded = expandedPaths.has(entry.path);
    const children = treeData[entry.path] || [];
    const isEntryLoading = loadingPaths.has(entry.path);

    if (entry.isDirectory) {
      return (
        <React.Fragment key={entry.path}>
          <div
            onClick={() => toggleFolder(entry.path)}
            style={{ paddingLeft: `${depth * 18 + 12}px` }}
            className="group flex items-center justify-between py-1.5 pr-3 text-xs text-neutral-300 hover:text-white hover:bg-white/[0.04] rounded-lg cursor-pointer transition-colors select-none my-0.5"
            title={entry.path}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="p-0.5 text-neutral-500 group-hover:text-neutral-300 rounded">
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                )}
              </span>
              {isExpanded ? (
                <FolderOpen className="w-4 h-4 text-[#8e8e8e] group-hover:text-white shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-[#8e8e8e] group-hover:text-white shrink-0" />
              )}
              <span className="truncate font-medium text-[12.5px] text-neutral-200 group-hover:text-white">
                {entry.name}
              </span>
              {isEntryLoading && (
                <Loader2 className="w-3 h-3 animate-spin text-neutral-500 ml-1 shrink-0" />
              )}
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNavigateToFolder(entry);
                }}
                className="px-2 py-0.5 rounded text-[11px] text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 flex items-center gap-1 transition-colors cursor-pointer"
                title={t("rightPane.openFolder")}
              >
                <FolderOpen className="w-3 h-3" />
                <span>{t("rightPane.openFolder")}</span>
              </button>
            </div>
          </div>

          {isExpanded && (
            <div>
              {children.length === 0 && isEntryLoading ? (
                <div
                  style={{ paddingLeft: `${(depth + 1) * 18 + 24}px` }}
                  className="py-1.5 text-[11px] text-neutral-500 flex items-center gap-2"
                >
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>{t("common.loading")}...</span>
                </div>
              ) : children.length === 0 ? (
                <div
                  style={{ paddingLeft: `${(depth + 1) * 18 + 24}px` }}
                  className="py-1.5 text-[11px] text-neutral-500 italic"
                >
                  {t("rightPane.emptyFolder")}
                </div>
              ) : (
                children.map((child) => renderMainDirItem(child, depth + 1))
              )}
            </div>
          )}
        </React.Fragment>
      );
    }

    return (
      <div
        key={entry.path}
        onClick={() => handleSelectFile(entry)}
        style={{ paddingLeft: `${depth * 18 + 32}px` }}
        className="group flex items-center justify-between py-1.5 pr-3 text-xs text-neutral-300 hover:text-white hover:bg-white/[0.04] rounded-lg cursor-pointer transition-colors select-none my-0.5"
        title={entry.fullPath}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <FileIcon filename={entry.name} className="w-4 h-4 shrink-0" />
          <span className="truncate text-[12.5px] font-mono text-neutral-300 group-hover:text-white">
            {entry.name}
          </span>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <span className="text-[11px] text-neutral-500 mr-1">
            {t("rightPane.clickToPreview")}
          </span>
        </div>
      </div>
    );
  };

  const rootChildren = treeData[""] || [];

  return (
    <div className="flex-1 w-full h-full flex flex-col overflow-hidden bg-[#141414] select-none font-sans relative">
      {/* 1. Header Bar: Breadcrumbs + Actions (matching Image 2) */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#282828] bg-[#1a1a1a] text-xs text-neutral-400 shrink-0 relative z-20">
        {/* Breadcrumb Path with clickable sibling dropdowns */}
        <div
          onWheel={(e) => {
            if (e.deltaY !== 0) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }}
          className="flex items-center gap-1 min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden font-mono text-[11.5px] pr-3 select-none"
        >
          {/* Root Workspace Folder */}
          <button
            type="button"
            onClick={handleNavigateToRoot}
            className="text-neutral-500 hover:text-neutral-300 transition-colors shrink-0 font-medium cursor-pointer"
            title={workspacePath || rootFolderName}
          >
            {rootFolderName}
          </button>

          {breadcrumbSegments.map((crumb, idx) => (
            <React.Fragment key={crumb.relPath || idx}>
              <span className="text-neutral-600 shrink-0">›</span>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleNavigateToCrumb(crumb)}
                  className="text-neutral-400 hover:text-white hover:underline transition-colors shrink-0 cursor-pointer"
                  title={`Open folder: ${crumb.relPath}`}
                >
                  {crumb.name}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleBreadcrumbClick(e, crumb)}
                  className="p-0.5 text-neutral-500 hover:text-neutral-300 hover:bg-white/5 rounded cursor-pointer"
                  title={`View sibling folders in ${crumb.parentRelPath || rootFolderName}`}
                >
                  <ChevronDown className="w-2.5 h-2.5" />
                </button>
              </div>
            </React.Fragment>
          ))}

          {/* Active File or Folder Name */}
          {activeFilePath && (
            <>
              <span className="text-neutral-600 shrink-0">›</span>
              <div
                className="flex items-center gap-1.5 shrink-0 text-white font-medium"
                title={activeFilePath}
              >
                {isDirectory ? (
                  <Folder className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                ) : (
                  <FileIcon filename={fileName} className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="truncate">{fileName}</span>
              </div>
            </>
          )}
        </div>

        {/* Action Controls matching Image 2 */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Formatted / Raw Toggle for Markdown */}
          {isMarkdown && activeFilePath && !isDirectory && (
            <div className="flex items-center rounded-md bg-[#222222] p-0.5 border border-[#2e2e2e] mr-1">
              <button
                type="button"
                onClick={() => setMode("formatted")}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-sans font-medium transition-colors cursor-pointer",
                  mode === "formatted"
                    ? "bg-[#333333] text-white"
                    : "text-neutral-400 hover:text-white"
                )}
                title={t("rightPane.filePreview")}
              >
                <Eye className="w-3 h-3" />
                <span>{t("common.preview")}</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("raw")}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-sans font-medium transition-colors cursor-pointer",
                  mode === "raw"
                    ? "bg-[#333333] text-white"
                    : "text-neutral-400 hover:text-white"
                )}
                title={t("common.raw")}
              >
                <Code className="w-3 h-3" />
                <span>{t("common.raw")}</span>
              </button>
            </div>
          )}

          {/* More Options '⋮' Menu */}
          <div className="relative" ref={moreMenuRef}>
            <button
              type="button"
              onClick={() => setIsMoreMenuOpen((prev) => !prev)}
              className={cn(
                "p-1.5 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer",
                isMoreMenuOpen && "bg-white/10 text-white"
              )}
              title={t("workbench.taskOptions")}
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {isMoreMenuOpen && (
              <div className="absolute top-8 right-0 min-w-[190px] rounded-xl bg-[#1e1e1e] border border-[#333333] shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={handleRevealInExplorer}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-neutral-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
                >
                  <FolderOpen className="w-3.5 h-3.5 shrink-0 text-neutral-400" />
                  <span>{t("rightPane.revealInExplorer")}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyFullPath}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-neutral-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
                >
                  <Copy className="w-3.5 h-3.5 shrink-0 text-neutral-400" />
                  <span>{t("rightPane.copyPath")}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyRelPath}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-neutral-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
                >
                  <FileCode className="w-3.5 h-3.5 shrink-0 text-neutral-400" />
                  <span>{t("rightPane.copyRelativePath")}</span>
                </button>
              </div>
            )}
          </div>

          {/* Copy File Content Button */}
          {activeFilePath && !isDirectory && (
            <button
              type="button"
              onClick={handleCopyContent}
              className="p-1.5 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              title={t("rightPane.copyFileContent")}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-green-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* Toggle Workspace Tree Panel Button matching Image 2 */}
          {workspacePath && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setIsWorkspaceTreeOpen((prev) => !prev)}
              className={cn(
                "p-1.5 rounded transition-colors cursor-pointer outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0 select-none",
                isWorkspaceTreeOpen
                  ? "bg-white/10 text-white"
                  : "text-neutral-400 hover:text-white hover:bg-white/5"
              )}
              title={t("rightPane.toggleFileTree")}
            >
              <PanelRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Floating Sibling Folders Dropdown Menu (matching Image 2) */}
        {openBreadcrumbMenu && (
          <div
            ref={breadcrumbMenuRef}
            style={{ left: `${openBreadcrumbMenu.left}px` }}
            className="absolute top-9 min-w-[170px] max-w-[240px] max-h-[240px] overflow-y-auto rounded-xl bg-[#1e1e1e] border border-[#333333] shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
          >
            {openBreadcrumbMenu.siblings.length === 0 ? (
              <div className="py-2 px-3 text-[11px] text-neutral-500 text-center">
                {t("rightPane.noTabsFound")}
              </div>
            ) : (
              openBreadcrumbMenu.siblings.map((sib) => {
                const isActive = sib.name === openBreadcrumbMenu.crumbName;
                return (
                  <div
                    key={sib.path}
                    onClick={() => handleNavigateSibling(sib)}
                    className={cn(
                      "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors",
                      isActive
                        ? "bg-[#2b2b2b] text-white font-medium"
                        : "text-neutral-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <Folder className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span className="truncate">{sib.name}</span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* 2. Main Content Split View: Left (Code Viewer / Directory Explorer) | Right (Workspace Tree Panel) */}
      <div className="flex-1 w-full min-h-0 flex overflow-hidden">
        {/* Left Side: Code Viewer / Directory Viewer / Placeholder */}
        <div className="flex-1 min-w-0 h-full overflow-hidden flex flex-col bg-[#141414]">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center p-12 gap-2 text-xs text-neutral-500 font-sans">
              <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
              <span>{t("common.loading")}</span>
            </div>
          ) : isDirectory ? (
            /* Directory Explorer View for clicked folder or workspace root */
            <div className="flex-1 min-w-0 h-full overflow-hidden flex flex-col bg-[#141414]">
              {/* Directory Header Bar */}
              <div className={cn("flex justify-between px-4 py-2.5 bg-[#161616] shrink-0", remote?.mobile ? "flex-col items-stretch gap-2" : "items-center")}>
                <div className="flex items-center gap-2 min-w-0">
                  <Folder className="w-4 h-4 text-neutral-400 shrink-0" />
                  <span className="text-sm font-semibold text-white truncate">
                    {activeRelPath.split("/").filter(Boolean).pop() || rootFolderName}
                  </span>
                  <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-neutral-400 border border-white/5 truncate max-w-[200px]">
                    {activeRelPath || "/"}
                  </span>
                </div>

                {/* Directory Controls */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className={cn("relative flex items-center", remote?.mobile && "flex-1 min-w-0")}>
                    <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t("rightPane.filterFiles") || "Filter files..."}
                      className={cn("transition-all pl-7 pr-6 py-1 text-xs rounded-md bg-[#202020] border border-[#2e2e2e] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-500 font-sans", remote?.mobile ? "w-full text-base" : "w-36 focus:w-48")}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-1.5 text-neutral-500 hover:text-white p-0.5 rounded cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => fetchDirectory(activeRelPath)}
                    className="p-1.5 rounded-md hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                    title={t("rightPane.refreshDirectory")}
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={handleRevealInExplorer}
                    className="p-1.5 rounded-md hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                    title={t("rightPane.revealInExplorer")}
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Directory Content List */}
              <ScrollArea className="flex-1 w-full h-full">
                <div className="p-3">
                  {currentDirEntries.length === 0 && loadingPaths.has(activeRelPath) ? (
                    <div className="flex flex-col items-center justify-center p-12 text-xs text-neutral-500 font-sans">
                      <Loader2 className="w-5 h-5 animate-spin text-neutral-400 mb-2" />
                      <span>{t("common.loading")}...</span>
                    </div>
                  ) : currentDirEntries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center select-none text-neutral-500 font-sans">
                      <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center mb-3 text-neutral-600">
                        <Folder className="w-6 h-6 stroke-[1.5]" />
                      </div>
                      <p className="text-sm font-medium text-neutral-300">
                        {searchQuery ? "No matching files or folders" : t("rightPane.emptyFolder") || "Folder is empty"}
                      </p>
                      <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                        {searchQuery
                          ? `No items match "${searchQuery}". Clear the filter to see all files.`
                          : t("rightPane.noFilesInFolder") || "There are no files or subdirectories in this directory."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-0.5 font-sans">
                      {currentDirEntries.map((child) => renderMainDirItem(child, 0))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : !activeFilePath ? (
            /* Empty / Welcome State when opening Direktori tab */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none text-neutral-500">
              <FolderTree className="w-12 h-12 text-neutral-600 mb-3 stroke-[1.2]" />
              <p className="text-sm font-medium text-neutral-300">
                {t("rightPane.selectFileToView")}
              </p>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                {workspacePath
                  ? `Exploring "${rootFolderName}". Click any file in the Workspace panel on the right to view its content.`
                  : "No workspace active. Open a project to inspect files and directory structure."}
              </p>
            </div>
          ) : isMarkdown && mode === "formatted" ? (
            /* Formatted Markdown Rendering */
            <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto font-sans select-text leading-relaxed text-[#d4d4d4]">
              <MarkdownContent
                content={content}
                onOpenFilePreview={onOpenFilePreview}
                onOpenBrowser={onOpenBrowser}
              />
            </div>
          ) : (
            /* Monospace Code Viewer matching Image 2 with Line Numbers & Fold chevrons */
            <ScrollArea className="w-full max-w-full h-full">
              <div
                style={{ fontSize: `${codeFontSize}px` }}
                className="w-full max-w-full py-3 font-mono leading-5 select-text [tab-size:2]"
              >
                {rawLines.map((line, idx) => {
                  if (hiddenLineIndices.has(idx)) {
                    return null;
                  }

                  const foldable = isFoldableLine(line);
                  const isCollapsed = collapsedLines.has(idx);

                  return (
                    <div
                      key={idx}
                      className="flex items-start w-full max-w-full hover:bg-white/[0.03] transition-colors group"
                    >
                      {/* Line Number & Fold Chevron matching Image 2 */}
                      <div className="w-12 px-2 text-right select-none text-[11px] text-neutral-600 dark:text-[#555555] shrink-0 border-r border-[#262626] self-stretch flex items-center justify-end gap-1">
                        <span>{idx + 1}</span>
                        {foldable ? (
                          <button
                            type="button"
                            onClick={() => toggleFoldLine(idx)}
                            className="p-0.5 -mr-1 text-neutral-500 hover:text-white cursor-pointer opacity-70 group-hover:opacity-100 transition-opacity"
                            title={isCollapsed ? "Unfold code block" : "Fold code block"}
                          >
                            {isCollapsed ? (
                              <ChevronRight className="w-2.5 h-2.5" />
                            ) : (
                              <ChevronDown className="w-2.5 h-2.5" />
                            )}
                          </button>
                        ) : (
                          <span className="w-2.5 shrink-0" />
                        )}
                      </div>

                      {/* Syntax Highlighted Code Line */}
                      <div className="flex-1 min-w-0 px-3 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[#d4d4d4] flex items-center flex-wrap gap-1">
                        <span
                          dangerouslySetInnerHTML={{
                            __html: highlightedLines[idx] || "&nbsp;",
                          }}
                        />
                        {isCollapsed && (
                          <button
                            type="button"
                            onClick={() => toggleFoldLine(idx)}
                            className="inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded text-[10px] font-mono bg-white/10 hover:bg-white/20 text-neutral-400 hover:text-white transition-colors cursor-pointer select-none"
                            title="Unfold code block"
                          >
                            ...
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Right Side: Collapsible Workspace Tree Panel matching Image 2 */}
        {workspacePath && isWorkspaceTreeOpen && (
          <div className={cn("h-full bg-[#141414] flex flex-col shrink-0 select-none", remote?.mobile ? "w-[45%] min-w-0" : "w-64 max-w-[40%] min-w-[200px]")}>
            {/* Header: Workspace ˇ + Refresh Button */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#282828] shrink-0">
              <div className="flex items-center gap-1 text-xs font-semibold text-neutral-300">
                <span>{t("rightPane.workspace")}</span>
                <ChevronDown className="w-3 h-3 text-neutral-500" />
              </div>
              <button
                type="button"
                onClick={handleRefreshTree}
                className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title={t("rightPane.refreshDirectory")}
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Tree Directory Scroll Area */}
            <ScrollArea className="flex-1 w-full p-2">
              <div className="space-y-0.5">
                {/* Root Workspace Node */}
                <div
                  onClick={() => toggleFolder("")}
                  className="flex items-center gap-1.5 py-1 px-1.5 text-xs text-neutral-300 hover:text-white hover:bg-white/5 rounded-md cursor-pointer transition-colors font-medium select-none"
                >
                  <Folder className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <span className="truncate">{rootFolderName}</span>
                </div>

                {/* Root Children */}
                {rootChildren.length === 0 && loadingPaths.has("") ? (
                  <div className="flex items-center justify-center p-6 text-xs text-neutral-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                    <span>{t("common.loading")}</span>
                  </div>
                ) : (
                  rootChildren.map((child) => renderTreeItem(child, 1))
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
