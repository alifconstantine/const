import React, { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "../../lib/i18n";
import {
  toast,
  cn,
  ScrollArea,
  Switch,
} from "@const/ui";
import {
  Brain,
  Folder,
  Globe,
  Search,
  RotateCw,
  ChevronDown,
  Eye,
  FileCode,
  FolderOpen,
  Trash2,
  X,
  Check,
  Plus,
  Save,
  AlertTriangle,
} from "lucide-react";
import { Markdown } from "@thesvg/react";
import { MarkdownContent } from "../workbench/markdown-content";
import type { MemoryFileInfo } from "../../vite-env";

export interface MemorySettingsProps {
  currentProject?: string;
}

interface ProjectOption {
  id: string;
  name: string;
  path?: string;
  isGlobal: boolean;
}

function resolveActiveWorkspace(project?: string): string | null {
  const p =
    project ||
    (typeof window !== "undefined"
      ? localStorage.getItem("const_harness_current_project")
      : null);
  if (!p || p === "Outside Project" || p === "[object Object]" || p.trim() === "") {
    return null;
  }
  return p;
}

function formatProjectName(projPath: string): string {
  return (
    projPath.replace(/\\/g, "/").split("/").filter(Boolean).pop() || projPath
  );
}

function getInitialProjectOptions(activeWorkspace: string | null): ProjectOption[] {
  const list: ProjectOption[] = [
    { id: "global", name: "Global / Default", isGlobal: true },
  ];
  if (activeWorkspace) {
    list.push({
      id: activeWorkspace,
      name: formatProjectName(activeWorkspace),
      path: activeWorkspace,
      isGlobal: false,
    });
  }
  return list;
}

export function MemorySettings({ currentProject }: MemorySettingsProps) {
  const { t } = useTranslation();
  // 1. Workspace Memory master toggle
  const [memoryEnabled, setMemoryEnabled] = useState<boolean>(true);
  const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(true);

  // 2. Scope & Project Selector state - initialize directly based on current workspace
  const [selectedScopeId, setSelectedScopeId] = useState<string>(() => {
    return resolveActiveWorkspace(currentProject) || "global";
  });
  const [projectsList, setProjectsList] = useState<ProjectOption[]>(() => {
    return getInitialProjectOptions(resolveActiveWorkspace(currentProject));
  });
  const [isScopeDropdownOpen, setIsScopeDropdownOpen] = useState(false);
  const scopeDropdownRef = useRef<HTMLDivElement>(null);

  // 3. Memory files state
  const [files, setFiles] = useState<MemoryFileInfo[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // 4. Action menu dropdown per file
  const [activeMenuFileId, setActiveMenuFileId] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  // 5. Modals: View/Edit & Delete
  const [editingFile, setEditingFile] = useState<{
    file: MemoryFileInfo;
    content: string;
    mode: "preview" | "edit";
  } | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [deletingFile, setDeletingFile] = useState<MemoryFileInfo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 6. New Memory File Modal
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileContent, setNewFileContent] = useState("");
  const [isSavingNew, setIsSavingNew] = useState(false);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (scopeDropdownRef.current && !scopeDropdownRef.current.contains(e.target as Node)) {
        setIsScopeDropdownOpen(false);
      }
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setActiveMenuFileId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load config on mount
  useEffect(() => {
    if (window.electron?.memory?.getConfig) {
      window.electron.memory.getConfig().then((res) => {
        setMemoryEnabled(res.workspaceMemoryEnabled ?? true);
        setIsLoadingConfig(false);
      }).catch(() => {
        setIsLoadingConfig(false);
      });
    } else {
      setIsLoadingConfig(false);
    }
  }, []);

  // Keep selected scope in sync if currentProject changes while mounted
  const prevProjectRef = useRef<string | undefined>(currentProject);
  useEffect(() => {
    if (prevProjectRef.current !== currentProject) {
      prevProjectRef.current = currentProject;
      const ws = resolveActiveWorkspace(currentProject);
      setSelectedScopeId(ws || "global");
    }
  }, [currentProject]);

  // Discover all unique projects from conversations database
  useEffect(() => {
    const ws = resolveActiveWorkspace(currentProject);
    const seenProjects = new Set<string>();

    const list: ProjectOption[] = [
      { id: "global", name: "Global / Default", isGlobal: true },
    ];

    if (ws) {
      seenProjects.add(ws);
      list.push({
        id: ws,
        name: formatProjectName(ws),
        path: ws,
        isGlobal: false,
      });
    }

    if (window.electron?.listConversations) {
      window.electron.listConversations().then((convos) => {
        for (const c of convos) {
          if (
            c.project &&
            c.project !== "Outside Project" &&
            c.project !== "[object Object]" &&
            c.project.trim() !== "" &&
            !seenProjects.has(c.project)
          ) {
            seenProjects.add(c.project);
            list.push({
              id: c.project,
              name: formatProjectName(c.project),
              path: c.project,
              isGlobal: false,
            });
          }
        }
        setProjectsList(list);
      }).catch(() => {});
    }
  }, [currentProject]);

  // Load memory files whenever selectedScopeId changes
  const fetchMemoryFiles = async (targetScope: string = selectedScopeId) => {
    if (!window.electron?.memory?.list) return;

    setIsLoadingFiles(true);
    try {
      const isGlobal = targetScope === "global";
      const workspacePath = isGlobal ? undefined : targetScope;

      const res = await window.electron.memory.list({
        scope: isGlobal ? "global" : "project",
        workspacePath,
      });

      setFiles(Array.isArray(res) ? res : []);
    } catch (err) {
      toast.error("Failed to load memory files");
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    fetchMemoryFiles(selectedScopeId);
  }, [selectedScopeId]);

  // Handle Toggle Workspace Memory
  const handleToggleMemory = async (checked: boolean) => {
    setMemoryEnabled(checked);
    if (window.electron?.memory?.saveConfig) {
      try {
        await window.electron.memory.saveConfig({ workspaceMemoryEnabled: checked });
        toast.success(checked ? "Workspace memory enabled" : "Workspace memory disabled");
      } catch {
        toast.error("Failed to update memory setting");
      }
    }
  };

  // Filter files by search query
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const q = searchQuery.toLowerCase().trim();
    return files.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.preview && f.preview.toLowerCase().includes(q))
    );
  }, [files, searchQuery]);

  const selectedProjectObj = useMemo(() => {
    const found = projectsList.find((p) => p.id === selectedScopeId);
    if (found) return found;

    if (selectedScopeId === "global") {
      return { id: "global", name: "Global / Default", isGlobal: true };
    }

    return {
      id: selectedScopeId,
      name: formatProjectName(selectedScopeId),
      path: selectedScopeId,
      isGlobal: false,
    };
  }, [projectsList, selectedScopeId]);

  // View / Edit file handler
  const handleOpenFile = async (file: MemoryFileInfo, initialMode: "preview" | "edit" = "preview") => {
    setActiveMenuFileId(null);
    if (!window.electron?.memory?.read) return;

    try {
      const content = await window.electron.memory.read(file.path);
      setEditingFile({
        file,
        content,
        mode: initialMode,
      });
    } catch {
      toast.error(`Failed to read ${file.name}`);
    }
  };

  // Save edited file handler
  const handleSaveEdit = async () => {
    if (!editingFile || !window.electron?.memory?.save) return;

    setIsSavingEdit(true);
    try {
      await window.electron.memory.save(editingFile.file.path, editingFile.content);
      toast.success(`Saved ${editingFile.file.name}`);
      setEditingFile(null);
      fetchMemoryFiles(selectedScopeId);
    } catch {
      toast.error(`Failed to save ${editingFile.file.name}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Open in OS Explorer
  const handleOpenInExplorer = (file: MemoryFileInfo) => {
    setActiveMenuFileId(null);
    if (window.electron?.memory?.openInFolder) {
      window.electron.memory.openInFolder(file.path);
    }
  };

  // Delete file handler
  const handleConfirmDelete = async () => {
    if (!deletingFile || !window.electron?.memory?.delete) return;

    setIsDeleting(true);
    try {
      const ok = await window.electron.memory.delete(deletingFile.path);
      if (ok) {
        toast.success(`Deleted ${deletingFile.name}`);
        setDeletingFile(null);
        fetchMemoryFiles(selectedScopeId);
      } else {
        toast.error(`Could not delete ${deletingFile.name}`);
      }
    } catch {
      toast.error(`Failed to delete ${deletingFile.name}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Create new memory file handler
  const handleSaveNewFile = async () => {
    if (!newFileName.trim()) {
      toast.error("Please enter a file name");
      return;
    }

    let finalName = newFileName.trim();
    if (!finalName.endsWith(".md")) finalName += ".md";

    const isGlobal = selectedScopeId === "global";

    let targetPath = "";
    if (isGlobal) {
      targetPath = `.const/memory/${finalName}`;
    } else {
      const targetProject = projectsList.find((p) => p.id === selectedScopeId);
      const wsPath = targetProject?.path || selectedScopeId;
      targetPath = `${wsPath}/.const/memory/${finalName}`;
    }

    if (!targetPath || !window.electron?.memory?.save) return;

    setIsSavingNew(true);
    try {
      const defaultHeader = `# ${finalName.replace(/\.md$/, "")}\n\n`;
      const fullBody = newFileContent.trim() ? newFileContent : defaultHeader;
      await window.electron.memory.save(targetPath, fullBody);
      toast.success(`Created ${finalName}`);
      setIsCreatingNew(false);
      setNewFileName("");
      setNewFileContent("");
      fetchMemoryFiles(selectedScopeId);
    } catch {
      toast.error("Failed to create memory file");
    } finally {
      setIsSavingNew(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl pb-8 select-none">
      {/* ------------------------------------------------------------- */}
      {/* 1. Workspace Memory Card (Image 1 top card)                   */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-4 sm:p-5 flex items-center justify-between gap-4 transition-colors">
        <div className="flex flex-col gap-1 pr-2">
          <span className="text-[14px] font-medium text-[#262626] dark:text-white tracking-tight">
            {t("settings.workspaceMemory")}
          </span>
          <p className="text-[12px] leading-relaxed text-[#737373] dark:text-[#969696] max-w-xl">
            {t("settings.workspaceMemoryDesc")}
          </p>
        </div>

        {/* Toggle Switch */}
        <div className="shrink-0 flex items-center">
          <Switch
            checked={memoryEnabled}
            onCheckedChange={handleToggleMemory}
            disabled={isLoadingConfig}
            className="data-[state=checked]:bg-[#262626] dark:data-[state=checked]:bg-white"
            aria-label="Toggle workspace memory"
          />
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. Control Row: Scope Dropdown, Counter, Search & Refresh     */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Left: Project Scope Selector & Counter */}
        <div className="flex items-center gap-3">
          {/* Dropdown Menu */}
          <div className="relative" ref={scopeDropdownRef}>
            <button
              type="button"
              onClick={() => setIsScopeDropdownOpen((prev) => !prev)}
              className="px-3 py-1.5 rounded-lg bg-[#ffffff] dark:bg-[#222222] hover:bg-[#f0f0f2] dark:hover:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838] text-xs font-medium text-[#262626] dark:text-white flex items-center gap-2 transition-colors cursor-pointer outline-none focus:outline-none"
              title={t("settings.selectScope")}
            >
              {selectedProjectObj.isGlobal ? (
                <Globe className="w-3.5 h-3.5 text-[#737373] dark:text-[#969696]" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-[#737373] dark:text-[#969696]" />
              )}
              <span className="truncate max-w-[140px] sm:max-w-[200px]">
                {selectedProjectObj.name}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#737373] dark:text-[#969696] shrink-0" />
            </button>

            {/* Scope Dropdown Pop-over */}
            {isScopeDropdownOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-64 max-h-60 overflow-y-auto bg-[#ffffff] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
                <span className="text-[10px] uppercase font-semibold text-[#737373] dark:text-[#888888] px-2.5 py-1">
                  {t("settings.memoryScope")}
                </span>
                {projectsList.map((p) => {
                  const isSelected = selectedScopeId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedScopeId(p.id);
                        setIsScopeDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full px-2.5 py-1.5 rounded-lg text-left flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer outline-none",
                        isSelected
                          ? "bg-black/5 dark:bg-white/10 text-[#262626] dark:text-white font-medium"
                          : "hover:bg-black/5 dark:hover:bg-white/5 text-[#555555] dark:text-[#d4d4d4]"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {p.isGlobal ? (
                          <Globe className="w-3.5 h-3.5 text-[#737373] shrink-0" />
                        ) : (
                          <Folder className="w-3.5 h-3.5 text-[#737373] shrink-0" />
                        )}
                        <span className="truncate">{p.name}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-black dark:text-white shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Memory Count Indicator */}
          <span className="text-xs text-[#737373] dark:text-[#969696] tabular-nums whitespace-nowrap">
            {filteredFiles.length} {filteredFiles.length === 1 ? t("settings.memoryUnit") : t("settings.memoriesUnit")}
          </span>
        </div>

        {/* Right: Search Input, Refresh & Add Button */}
        <div className="flex items-center gap-2">
          {/* Search Bar */}
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#737373] dark:text-[#888888] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("settings.searchMemoryFiles")}
              className="w-full h-8 pl-8 pr-7 text-xs rounded-lg border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#222222] text-[#262626] dark:text-white placeholder:text-[#888888] dark:placeholder:text-[#737373] focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#737373] hover:text-black dark:hover:text-white p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchMemoryFiles(selectedScopeId)}
            className="p-2 rounded-lg border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#222222] hover:bg-[#f0f0f2] dark:hover:bg-[#2b2b2b] text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white transition-colors cursor-pointer outline-none focus:outline-none shrink-0"
            title={t("settings.refreshFiles")}
          >
            <RotateCw className={cn("w-3.5 h-3.5", isLoadingFiles && "animate-spin")} />
          </button>

          {/* Create File Button */}
          <button
            type="button"
            onClick={() => {
              setNewFileName("");
              setNewFileContent("");
              setIsCreatingNew(true);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#222222] hover:bg-[#f0f0f2] dark:hover:bg-[#2b2b2b] text-[#262626] dark:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer outline-none shrink-0"
            title={t("settings.newMemoryFile")}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t("settings.newBtn")}</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. Files Section Header & List (Image 1 style)                */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[12px] font-medium text-[#737373] dark:text-[#969696]">
          {t("settings.filesHeader")}
        </span>

        {isLoadingFiles ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-[#737373]">
            <RotateCw className="w-5 h-5 animate-spin" />
            <span>{t("settings.loadingMemoryFiles")}</span>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#dedee2] dark:border-[#383838] bg-[#fafafa] dark:bg-[#222222] p-8 flex flex-col items-center justify-center text-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#ececee] dark:bg-[#2b2b2b] flex items-center justify-center text-[#737373] dark:text-[#969696]">
              <Brain className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-[#262626] dark:text-white">
                {searchQuery ? t("settings.noMatchingFiles") : t("settings.noMemoryFiles")}
              </span>
              <span className="text-[11px] text-[#737373] dark:text-[#969696] max-w-sm mt-0.5">
                {searchQuery
                  ? t("settings.tryDifferentKeywords")
                  : t("settings.memoriesAppearHere")}
              </span>
            </div>
            {!searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setNewFileName("MEMORY.md");
                  setNewFileContent(
                    selectedProjectObj.isGlobal
                      ? "# Global Memory\n\nGlobal preferences, conventions, and instructions across all workspaces.\n"
                      : "# Workspace Memory\n\nCore conventions and architectural decisions.\n"
                  );
                  setIsCreatingNew(true);
                }}
                className="mt-1 px-3 py-1.5 rounded-lg border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#222222] hover:bg-[#f0f0f2] dark:hover:bg-[#2b2b2b] text-xs font-medium text-[#262626] dark:text-white transition-colors cursor-pointer"
              >
                Create MEMORY.md
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {filteredFiles.map((file) => {
              const isMenuOpen = activeMenuFileId === file.path;
              return (
                <div
                  key={file.path}
                  className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] hover:bg-[#f1f1f4] dark:hover:bg-[#2b2b2b] p-3 flex items-center justify-between gap-3 transition-colors group relative"
                >
                  {/* Left: Markdown Icon & Details */}
                  <div
                    className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                    onClick={() => handleOpenFile(file, "preview")}
                    title={`Click to preview ${file.name}`}
                  >
                    {/* Dark badge with official Markdown logo from @thesvg/react */}
                    <div className="w-8 h-8 rounded-lg bg-[#f0f0f2] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838] flex items-center justify-center shrink-0">
                      <Markdown
                        variant="mono"
                        className="w-4 h-4 text-blue-400 dark:text-blue-400 shrink-0 fill-current"
                      />
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] font-medium text-[#262626] dark:text-white truncate">
                        {file.name}
                      </span>
                      <span className="text-[11px] text-[#737373] dark:text-[#969696] truncate">
                        {file.formattedDate}
                      </span>
                    </div>
                  </div>

                  {/* Right: Action Dropdown Button (Folder icon with chevron as in Image 1) */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuFileId(isMenuOpen ? null : file.path);
                      }}
                      className="px-2 py-1 rounded-md border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#222222] hover:bg-[#f0f0f2] dark:hover:bg-[#2b2b2b] text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white flex items-center gap-1.5 text-xs transition-colors cursor-pointer outline-none"
                      title={t("settings.fileActions")}
                    >
                      <Folder className="w-3.5 h-3.5 text-[#737373] dark:text-[#969696]" />
                      <ChevronDown className="w-3 h-3 text-[#737373] dark:text-[#969696]" />
                    </button>

                    {/* Action Dropdown Menu */}
                    {isMenuOpen && (
                      <div
                        ref={actionMenuRef}
                        className="absolute right-0 top-full mt-1 w-48 bg-[#ffffff] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenFile(file, "preview")}
                          className="w-full px-2.5 py-1.5 rounded-lg text-left flex items-center gap-2 text-xs text-[#555555] dark:text-[#d4d4d4] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#737373]" />
                          <span>{t("settings.viewPreview")}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenFile(file, "edit")}
                          className="w-full px-2.5 py-1.5 rounded-lg text-left flex items-center gap-2 text-xs text-[#555555] dark:text-[#d4d4d4] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          <FileCode className="w-3.5 h-3.5 text-[#737373]" />
                          <span>{t("settings.editMarkdown")}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenInExplorer(file)}
                          className="w-full px-2.5 py-1.5 rounded-lg text-left flex items-center gap-2 text-xs text-[#555555] dark:text-[#d4d4d4] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          <FolderOpen className="w-3.5 h-3.5 text-[#737373]" />
                          <span>{t("settings.showInExplorer")}</span>
                        </button>

                        <div className="h-px bg-[#dedee2] dark:bg-[#383838] my-0.5" />

                        {/* Delete Menu Item (User Request) */}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuFileId(null);
                            setDeletingFile(file);
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg text-left flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          <span>{t("settings.deleteMemoryFile")}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. View / Edit Markdown Modal                                 */}
      {/* ------------------------------------------------------------- */}
      {editingFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-text animate-in fade-in duration-150"
          onClick={() => setEditingFile(null)}
        >
          <div
            className="w-[780px] max-w-[95vw] h-[580px] max-h-[88vh] bg-[#ffffff] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] rounded-2xl flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-[0.985] duration-150 text-[#262626] dark:text-[#d4d4d4]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-[#dedee2] dark:border-[#383838] flex items-center justify-between gap-3 shrink-0 bg-[#f9f9fb] dark:bg-[#222222]">
              <div className="flex items-center gap-2.5 min-w-0">
                <Markdown
                  variant="mono"
                  className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0 fill-current"
                />
                <span className="text-sm font-medium text-[#262626] dark:text-white truncate">
                  {editingFile.file.name}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#e8e8eb] dark:bg-[#2b2b2b] text-[#737373] dark:text-[#969696] font-mono">
                  {editingFile.file.formattedDate}
                </span>
              </div>

              {/* Segmented Mode Switcher (Preview / Edit) & Close */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="inline-flex p-0.5 rounded-lg bg-[#ebebed] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838] items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setEditingFile({ ...editingFile, mode: "preview" })}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-md transition-all cursor-pointer flex items-center gap-1.5",
                      editingFile.mode === "preview"
                        ? "bg-[#ffffff] dark:bg-[#383838] text-[#262626] dark:text-white shadow-xs font-medium"
                        : "text-[#737373] hover:text-black dark:hover:text-white"
                    )}
                  >
                    <Eye className="w-3 h-3" />
                    <span>{t("common.preview")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingFile({ ...editingFile, mode: "edit" })}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-md transition-all cursor-pointer flex items-center gap-1.5",
                      editingFile.mode === "edit"
                        ? "bg-[#ffffff] dark:bg-[#383838] text-[#262626] dark:text-white shadow-xs font-medium"
                        : "text-[#737373] hover:text-black dark:hover:text-white"
                    )}
                  >
                    <FileCode className="w-3 h-3" />
                    <span>{t("common.edit")}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingFile(null)}
                  className="p-1 rounded-lg text-[#737373] hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col bg-[#ffffff] dark:bg-[#1b1b1b]">
              {editingFile.mode === "edit" ? (
                <textarea
                  value={editingFile.content}
                  onChange={(e) => setEditingFile({ ...editingFile, content: e.target.value })}
                  placeholder="Type markdown content here..."
                  className="w-full h-full p-4 font-mono text-xs leading-relaxed bg-transparent text-[#262626] dark:text-[#e0e0e0] placeholder:text-[#888888] resize-none outline-none focus:outline-none"
                  spellCheck={false}
                />
              ) : (
                <ScrollArea className="flex-1 h-full p-5 sm:p-6">
                  {editingFile.content.trim() ? (
                    <MarkdownContent content={editingFile.content} />
                  ) : (
                    <div className="py-12 text-center text-xs text-[#737373]">
                      (Empty memory document)
                    </div>
                  )}
                </ScrollArea>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-[#dedee2] dark:border-[#383838] flex items-center justify-between gap-3 shrink-0 bg-[#f9f9fb] dark:bg-[#222222]">
              <span className="text-[11px] text-[#737373] dark:text-[#969696] font-mono truncate">
                {editingFile.file.path}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingFile(null)}
                  className="px-3 py-1.5 rounded-lg border border-[#dedee2] dark:border-[#383838] text-xs font-medium text-[#737373] hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                  className="px-3.5 py-1.5 rounded-lg bg-[#262626] dark:bg-white text-white dark:text-black text-xs font-medium hover:bg-black dark:hover:bg-[#eaeaea] transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingEdit ? (
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>{t("common.save")}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. Delete Confirmation Modal (User Request)                   */}
      {/* ------------------------------------------------------------- */}
      {deletingFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setDeletingFile(null)}
        >
          <div
            className="w-[420px] max-w-[92vw] bg-[#ffffff] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] rounded-2xl p-5 flex flex-col gap-4 shadow-2xl animate-in zoom-in-95 duration-150 text-[#262626] dark:text-[#d4d4d4]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-sm font-semibold text-[#262626] dark:text-white">
                  {t("settings.deleteMemoryFile")}?
                </span>
                <p className="text-xs text-[#737373] dark:text-[#969696] leading-relaxed">
                  Are you sure you want to delete <strong className="text-black dark:text-white font-medium">{deletingFile.name}</strong>? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingFile(null)}
                className="px-3 py-1.5 rounded-lg border border-[#dedee2] dark:border-[#383838] text-xs font-medium text-[#737373] hover:text-black dark:hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. Create New Memory File Modal                               */}
      {/* ------------------------------------------------------------- */}
      {isCreatingNew && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setIsCreatingNew(false)}
        >
          <div
            className="w-[540px] max-w-[92vw] bg-[#ffffff] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] rounded-2xl p-5 flex flex-col gap-4 shadow-2xl animate-in zoom-in-95 duration-150 text-[#262626] dark:text-[#d4d4d4]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#262626] dark:text-white">
                {t("settings.newMemoryFile")}
              </span>
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="text-[#737373] hover:text-black dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#737373] dark:text-[#969696]">
                  File Name
                </label>
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="e.g. user-coding-preferences.md"
                  className="w-full h-8 px-3 text-xs rounded-lg border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#1b1b1b] text-[#262626] dark:text-white placeholder:text-[#888888] focus:outline-none font-mono transition-colors"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#737373] dark:text-[#969696]">
                  Initial Content (Markdown)
                </label>
                <textarea
                  value={newFileContent}
                  onChange={(e) => setNewFileContent(e.target.value)}
                  placeholder="# Title&#10;&#10;Add initial memory notes, rules, or conventions..."
                  className="w-full h-32 p-3 text-xs rounded-lg border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#1b1b1b] text-[#262626] dark:text-white placeholder:text-[#888888] font-mono resize-none focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="px-3 py-1.5 rounded-lg border border-[#dedee2] dark:border-[#383838] text-xs font-medium text-[#737373] hover:text-black dark:hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNewFile}
                disabled={isSavingNew}
                className="px-3.5 py-1.5 rounded-lg bg-[#262626] dark:bg-white text-white dark:text-black text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSavingNew ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>{t("settings.newMemoryFile")}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
