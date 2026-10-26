import React, { useState, useEffect, useMemo, useRef } from "react";
import { Button, Input, ScrollArea, Switch, toast, cn } from "@const/ui";
import {
  PanelLeft,
  Trash2,
  PencilSparkles,
  Upload,
  X,
  ArrowLeft,
  Copy,
  Folder,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
} from "lucide-react";
import JSZip from "jszip";
import { db, localDb, type LocalSkill, type SkillCategory } from "../../lib/db";
import { useI18n } from "../../lib/i18n";
import {
  installSkillFromMarketplace,
  uninstallSkillFromMarketplace,
  fetchSkillContent,
  parseSkillMarkdown,
  generateSkillOverview,
  runSecurityScan,
  type MarketplaceSkill,
} from "../../lib/skills/skills-service";
import { FileIcon } from "../workbench/file-icon";
import { PluginsMarketplace } from "./plugins-marketplace";
import type { SkillsShItem } from "../../lib/skills/skills-sh-service";
import type { SkillInstallProgress } from "../../lib/skills/types";
import { SkillsLibrary } from "./skills-library";
import { useResolvedSkills } from "../../lib/skills/use-skills";
import { usePluginInventory } from "../../lib/plugins/plugins-service";
import { MarkdownContent } from "../workbench/markdown-content";

import { highlightCodeLines } from "../../lib/code-highlighter";

function SkillCodeViewer({
  code,
  filename,
}: {
  code: string;
  filename: string;
}) {
  const highlightedHtml = useMemo(() => {
    return highlightCodeLines(code, filename);
  }, [code, filename]);

  return (
    <div className="w-full min-h-full bg-[#161616] rounded-xl p-3">
      <div
        className="table w-full border-collapse font-mono"
        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      />
    </div>
  );
}

export interface SkillsSettingsProps {
  onClose?: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  isModal?: boolean;
  initialTab?: "skills" | "plugins";
  workspacePath?: string;
}

export function SkillsSettings({
  onClose,
  isSidebarOpen,
  onToggleSidebar,
  isModal = false,
  initialTab = "skills",
  workspacePath,
}: SkillsSettingsProps = {}) {
  const { t } = useI18n();
  const uploadDropzoneInputRef = useRef<HTMLInputElement | null>(null);

  // The filesystem registry supplies installed skills; Dexie supplies custom drafts.
  const skills = useResolvedSkills(workspacePath).filter(
    (skill) => !skill.pluginId,
  );
  const { catalog: pluginCatalog } = usePluginInventory(workspacePath);

  // Marketplace tab: Skills vs Plugins
  const [marketplaceTab, setMarketplaceTab] = useState<"skills" | "plugins">(
    initialTab,
  );

  // Navigation state
  const [viewMode, setViewMode] = useState<"list" | "skill-detail" | "upload">(
    "list",
  );
  const [selectedSkill, setSelectedSkill] = useState<
    LocalSkill | MarketplaceSkill | null
  >(null);
  const [installingSlug, setInstallingSlug] = useState<string | null>(null);

  // Detail view state
  const [skillActiveTab, setSkillActiveTab] = useState<"overview" | "content">(
    "overview",
  );
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  // List filter state
  const [searchQuery, setSearchQuery] = useState("");
  const handleMarketplaceTabChange = (tab: "skills" | "plugins") => {
    if (tab === marketplaceTab) return;
    setSearchQuery("");
    setMarketplaceTab(tab);
  };
  const [selectedScope, setSelectedScope] = useState<"user" | "workspace">(
    "user",
  );
  const [deleteConfirmSkill, setDeleteConfirmSkill] =
    useState<LocalSkill | null>(null);

  const [contentViewMode, setContentViewMode] = useState<"preview" | "code">(
    "preview",
  );
  const [installProgress, setInstallProgress] =
    useState<SkillInstallProgress | null>(null);
  const [installFailure, setInstallFailure] = useState<string | null>(null);
  const [detailError, setDetailError] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const requestRef = useRef<string | null>(null);
  const installLock = useRef(false);
  const lastInstall = useRef<MarketplaceSkill | null>(null);
  useEffect(
    () => () => {
      if (requestRef.current)
        void window.electron?.marketplace?.cancelSkillInstall(
          requestRef.current,
        );
    },
    [],
  );
  useEffect(
    () =>
      window.electron?.marketplace?.onInstallProgress?.((progress) => {
        if (progress.requestId === requestRef.current)
          setInstallProgress(progress);
      }),
    [],
  );

  // Async loaded detail for real SKILL.md and scripts/files
  const [loadedSkillDetail, setLoadedSkillDetail] = useState<{
    content: string;
    files: Record<string, string>;
    overview?: string;
    author?: string;
    version?: string;
    description?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadedSkillDetail(null);
    setDetailError(false);
    setDetailLoading(!!selectedSkill);
    if (selectedSkill) {
      const remote = !("createdAt" in selectedSkill) && selectedSkill.source;
      const detail = remote
        ? (window.electron?.marketplace?.previewRemoteSkill(
            remote,
            selectedSkill.slug,
          ) ?? Promise.reject(new Error("previewUnavailable")))
        : fetchSkillContent(
            selectedSkill.slug,
            workspacePath,
            selectedSkill.id,
          );
      detail
        .then((res) => {
          if (!cancelled && res) {
            const overview = res.content
              .replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "")
              .trim();
            setLoadedSkillDetail({
              content: res.content,
              files: res.files,
              overview,
              author: res.author,
              version: res.version,
              description: res.description,
            });
          }
          if (!cancelled && !res) setDetailError(true);
        })
        .catch(() => {
          if (!cancelled) setDetailError(true);
        })
        .finally(() => {
          if (!cancelled) setDetailLoading(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [selectedSkill?.slug, selectedSkill?.id, workspacePath]);

  // Update selected skill when db updates
  useEffect(() => {
    if (selectedSkill && "createdAt" in selectedSkill) {
      const refreshed = skills.find(
        (s) => s.id === (selectedSkill as LocalSkill).id,
      );
      if (refreshed) setSelectedSkill(refreshed);
    }
  }, [skills]);

  // Compute file map for skill content tab
  const skillFilesMap: Record<string, string> = useMemo(() => {
    if (!selectedSkill) return {};
    if (
      loadedSkillDetail?.files &&
      Object.keys(loadedSkillDetail.files).length > 0
    ) {
      return loadedSkillDetail.files;
    }
    if (
      "files" in selectedSkill &&
      selectedSkill.files &&
      !Array.isArray(selectedSkill.files) &&
      Object.keys(selectedSkill.files).length > 0
    ) {
      return selectedSkill.files as Record<string, string>;
    }
    const content =
      loadedSkillDetail?.content ||
      ("content" in selectedSkill ? selectedSkill.content : "");
    if (content) {
      return {
        "SKILL.md": content,
      };
    }
    return {};
  }, [selectedSkill, loadedSkillDetail]);

  useEffect(() => {
    if (viewMode === "skill-detail" && selectedSkill) {
      const keys = Object.keys(skillFilesMap);
      if (
        keys.length > 0 &&
        (!selectedFileName || !skillFilesMap[selectedFileName])
      ) {
        setSelectedFileName(keys[0]!);
      }
    }
  }, [viewMode, selectedSkill, skillFilesMap]);

  // Handlers
  const handleToggleSkill = async (id: string, isEnabled: boolean) => {
    try {
      const skill = skills.find((item) => item.id === id);
      if (skill?.path && window.electron?.marketplace) {
        await window.electron.marketplace.setEnabled({
          id,
          enabled: isEnabled,
          workspacePath,
        });
      } else {
        await localDb.toggleSkill(id, isEnabled);
      }
      toast.success(isEnabled ? t("skillEnabled") : t("skillDisabled"));
    } catch {
      toast.error(t("marketplace.failedToUpdateStatus"));
    }
  };

  const handleInstallSkill = async (skill: MarketplaceSkill) => {
    if (installLock.current) return;
    installLock.current = true;
    lastInstall.current = skill;
    const requestId = crypto.randomUUID();
    requestRef.current = requestId;
    setInstallingSlug(
      skill.source ? skill.source + "/" + skill.slug : skill.slug,
    );
    setInstallFailure(null);
    setInstallProgress({
      requestId,
      phase: "resolving",
      completed: 0,
      total: 0,
    });
    try {
      const installed = await installSkillFromMarketplace(
        skill.slug,
        selectedScope,
        workspacePath,
        skill.source,
        skill.slug,
        requestId,
      );
      toast.success(t("marketplace.installedSuccess", { name: skill.name }));
      if (selectedSkill?.id === skill.id) setSelectedSkill(installed);
    } catch (error) {
      const code =
        error instanceof Error
          ? error.message.match(/SKILL_INSTALL_([A-Z_]+)/)?.[1]
          : undefined;
      const keys: Record<string, string> = {
        DOWNLOAD: "installErrorDownload",
        RATE_LIMIT: "installErrorRateLimit",
        INVALID: "installErrorInvalid",
        NOT_FOUND: "installErrorNotFound",
        TOO_LARGE: "installErrorTooLarge",
        CONFLICT: "installErrorConflict",
        BUSY: "installErrorBusy",
      };
      if (code === "CANCELLED")
        toast.success(t("marketplace.installCancelled"));
      else
        setInstallFailure(
          t("marketplace." + (keys[code ?? ""] ?? "failedToInstall")),
        );
    } finally {
      installLock.current = false;
      requestRef.current = null;
      setInstallingSlug(null);
      setInstallProgress(null);
    }
  };

  const selectLibraryItem = (item: SkillsShItem | LocalSkill) => {
    setSelectedSkill(
      "createdAt" in item
        ? item
        : {
            id: item.id,
            slug: item.skillId,
            name: item.name,
            description: item.description ?? "",
            category: "custom",
            author: item.source,
            version: "",
            source: item.source,
          },
    );
    setSkillActiveTab("overview");
    setViewMode("skill-detail");
  };

  const handleUninstallSkill = async (skill: LocalSkill) => {
    try {
      const removed = await uninstallSkillFromMarketplace(skill, workspacePath);
      if (!removed) throw new Error(t("marketplace.failedToUninstall"));
      toast.success(
        t("marketplace.uninstalledSuccess").replace("{name}", skill.name),
      );
      setDeleteConfirmSkill(null);
      if (selectedSkill && (selectedSkill as LocalSkill).id === skill.id) {
        setViewMode("list");
        setSelectedSkill(null);
      }
    } catch (err: any) {
      toast.error(err?.message || t("marketplace.failedToUninstall"));
    }
  };

  const handleOpenSkillsFolder = () => {
    if (window.electron?.marketplace) {
      window.electron.marketplace.openSkillsFolder({
        scope: selectedScope === "workspace" ? "workspace" : "user",
        workspacePath,
      });
    } else if (window.electron?.openConstFolder) {
      window.electron.openConstFolder();
    }
  };

  // Upload view state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadSkillName, setUploadSkillName] = useState("");
  const [uploadSkillSlug, setUploadSkillSlug] = useState("");
  const [uploadSkillDescription, setUploadSkillDescription] = useState("");
  const [uploadSkillContent, setUploadSkillContent] = useState("");
  const [uploadSkillOverview, setUploadSkillOverview] = useState("");
  const [uploadCategory, setUploadCategory] = useState<SkillCategory>("custom");
  const [uploadFilesMap, setUploadFilesMap] = useState<Record<string, string>>(
    {},
  );
  const [scanStatus, setScanStatus] = useState<
    "idle" | "scanning" | "passed" | "failed"
  >("idle");
  const [scanMessage, setScanMessage] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileProcess = async (file: File) => {
    setUploadFile(file);
    setScanStatus("scanning");
    setScanMessage(t("scanScanning"));

    try {
      if (file.name.endsWith(".zip")) {
        const zip = new JSZip();
        const zipData = await zip.loadAsync(file);
        const filesMap: Record<string, string> = {};

        for (const [relativePath, zipEntry] of Object.entries(zipData.files)) {
          if (!zipEntry.dir) {
            const ext = relativePath.split(".").pop()?.toLowerCase();
            if (
              ext &&
              ["md", "txt", "json", "yaml", "yml", "ts", "js", "py"].includes(
                ext,
              )
            ) {
              filesMap[relativePath] = await zipEntry.async("text");
            }
          }
        }

        const skillMdKey = Object.keys(filesMap).find(
          (k) => k.endsWith("SKILL.md") || k === "SKILL.md",
        );
        const mainContent = skillMdKey ? filesMap[skillMdKey] || "" : "";
        const parsed = parseSkillMarkdown(mainContent);

        const scan = runSecurityScan(mainContent);
        if (!scan.passed) {
          setScanStatus("failed");
          setScanMessage(t("scanFailed"));
          return;
        }

        setUploadFilesMap(filesMap);
        setUploadSkillContent(mainContent);
        setUploadSkillName(parsed.name || file.name.replace(".zip", ""));
        setUploadSkillSlug(
          parsed.slug || file.name.replace(".zip", "").toLowerCase(),
        );
        setUploadSkillDescription(parsed.description || "");
        setUploadSkillOverview(
          generateSkillOverview(parsed.slug, mainContent, parsed.description),
        );
        setUploadCategory(
          (parsed.frontmatter.category as SkillCategory) || "custom",
        );
        setScanStatus("passed");
        setScanMessage(t("securityScanClean"));
      } else {
        const text = await file.text();
        const parsed = parseSkillMarkdown(text);
        const scan = runSecurityScan(text);
        if (!scan.passed) {
          setScanStatus("failed");
          setScanMessage(t("scanFailed"));
          return;
        }

        setUploadSkillContent(text);
        setUploadSkillName(parsed.name || file.name.replace(/\.[^/.]+$/, ""));
        setUploadSkillSlug(
          parsed.slug || file.name.replace(/\.[^/.]+$/, "").toLowerCase(),
        );
        setUploadSkillDescription(parsed.description || "");
        setUploadSkillOverview(
          generateSkillOverview(parsed.slug, text, parsed.description),
        );
        setUploadCategory(
          (parsed.frontmatter.category as SkillCategory) || "custom",
        );
        setUploadFilesMap({ "SKILL.md": text });
        setScanStatus("passed");
        setScanMessage(t("securityScanClean"));
      }
    } catch {
      setScanStatus("failed");
      setScanMessage(t("marketplace.failedToSaveSkill"));
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadSkillName.trim()) {
      toast.error(t("marketplace.nameRequired"));
      return;
    }
    try {
      const id =
        "skill_" +
        Math.random().toString(36).substring(2, 9) +
        Date.now().toString(36);
      const now = Date.now();
      if (
        scanStatus !== "passed" ||
        !uploadSkillContent.trim() ||
        (selectedScope === "workspace" && !workspacePath)
      )
        throw new Error("Invalid skill upload.");
      await db.skills.add({
        id,
        slug: uploadSkillSlug.trim().toLowerCase(),
        name: uploadSkillName.trim(),
        description: uploadSkillDescription.trim(),
        content: uploadSkillContent,
        icon: "PencilSparkles",
        category: uploadCategory,
        isBuiltIn: false,
        isEnabled: true,
        scope: selectedScope === "workspace" ? "workspace" : "user",
        workspacePath:
          selectedScope === "workspace" ? workspacePath : undefined,
        author: "Uploaded",
        version: "1.0.0",
        overview: uploadSkillOverview,
        files: uploadFilesMap,
        createdAt: now,
        updatedAt: now,
      });

      toast.success(t("skillAddedSuccess").replace("{name}", uploadSkillName));
      setViewMode("list");
      setUploadFile(null);
    } catch {
      toast.error(t("marketplace.failedToSaveSkill"));
    }
  };

  const handleCopyContent = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t("marketplace.copiedToClipboard"));
  };

  const deleteDialog = deleteConfirmSkill && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={() => setDeleteConfirmSkill(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="skill-uninstall-title"
        className="w-[420px] max-w-[95vw] bg-[#222222] border border-[#383838] rounded-2xl p-5 flex flex-col gap-4 text-white shadow-2xl animate-in zoom-in-[0.985] duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3
              id="skill-uninstall-title"
              className="text-sm font-semibold text-white"
            >
              {t("marketplace.uninstallConfirmTitle")}
            </h3>
            <p className="text-xs text-[#969696] mt-1 leading-relaxed">
              {t("marketplace.uninstallConfirmDesc").replace(
                "{name}",
                deleteConfirmSkill.name,
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2e2e2e]">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteConfirmSkill(null)}
            className="h-8 px-3 rounded-lg text-xs text-[#969696] hover:text-white"
          >
            {t("common.cancel")}
          </Button>
          <Button
            size="sm"
            onClick={() => handleUninstallSkill(deleteConfirmSkill)}
            className="h-8 px-3.5 rounded-lg text-xs bg-red-600 hover:bg-red-500 text-white font-medium shadow-none cursor-pointer"
          >
            {t("marketplace.uninstall")}
          </Button>
        </div>
      </div>
    </div>
  );
  const progressPanel = installProgress ? (
    <div
      role="status"
      aria-live="polite"
      className="rounded-2xl bg-[#222222] p-4 space-y-3"
    >
      <div className="flex justify-between items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-white">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>
            {t(
              "marketplace.phase" +
                installProgress.phase[0]!.toUpperCase() +
                installProgress.phase.slice(1),
            )}
          </span>
          <span className="text-[#969696]">{lastInstall.current?.name}</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (requestRef.current)
              void window.electron?.marketplace?.cancelSkillInstall(
                requestRef.current,
              );
          }}
        >
          {t("common.cancel")}
        </Button>
      </div>
      {installProgress.total > 0 && (
        <>
          <div
            role="progressbar"
            aria-label={t("marketplace.downloadingFiles")}
            aria-valuenow={installProgress.completed}
            aria-valuemin={0}
            aria-valuemax={installProgress.total}
            className="h-1.5 rounded-full bg-[#383838] overflow-hidden"
          >
            <div
              className="h-full rounded-full bg-white transition-[width]"
              style={{
                width:
                  (installProgress.completed / installProgress.total) * 100 +
                  "%",
              }}
            />
          </div>
          <p className="text-xs text-[#969696] truncate">
            {t("marketplace.filesProgress", {
              completed: installProgress.completed,
              total: installProgress.total,
            })}
            {installProgress.file && " · " + installProgress.file}
          </p>
        </>
      )}
    </div>
  ) : installFailure ? (
    <div
      role="alert"
      className="rounded-2xl bg-[#222222] p-4 flex items-center justify-between gap-4"
    >
      <p className="text-sm text-[#d4d4d4]">{installFailure}</p>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          if (lastInstall.current) void handleInstallSkill(lastInstall.current);
        }}
      >
        {t("marketplace.retry")}
      </Button>
    </div>
  ) : null;

  // ---------------------------------------------------------------------------
  // RENDER: VIEW 1 — SKILL DETAIL VIEW
  // ---------------------------------------------------------------------------
  if (viewMode === "skill-detail" && selectedSkill) {
    const isInstalled = "createdAt" in selectedSkill;
    const activeFileContent =
      skillFilesMap[selectedFileName] ||
      loadedSkillDetail?.content ||
      ("content" in selectedSkill ? selectedSkill.content : "") ||
      "";
    const filesList = Object.keys(skillFilesMap);

    return (
      <div
        className={cn(
          "w-full flex flex-col font-sans select-none outline-none ring-0",
          isModal ? "space-y-4 pb-8" : "space-y-6",
        )}
      >
        {/* Top Back Navigation Bar */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("list")}
            className="gap-1.5 text-xs text-[#969696] hover:text-white cursor-pointer -ml-2 h-8"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t("marketplace.title")}</span>
          </Button>

          {onClose && !isModal && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 rounded-lg text-[#969696] hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {progressPanel}
        {deleteDialog}
        {/* Skill Header Strip */}
        <div className="flex items-center justify-between gap-4 p-5 rounded-2xl bg-[#222222] border border-[#383838]">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-[#2b2b2b] border border-[#383838] flex items-center justify-center text-white shrink-0">
              <PencilSparkles className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-medium text-white truncate">
                  {selectedSkill.name}
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#1b1b1b] border border-[#2e2e2e] text-[#969696]">
                  /{selectedSkill.slug}
                </span>
                {isInstalled && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {t("marketplace.installedSection")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-[#969696] mt-1 flex-wrap">
                {(loadedSkillDetail?.author || selectedSkill.author) && (
                  <span>
                    {t("marketplace.byAuthor").replace(
                      "{author}",
                      loadedSkillDetail?.author || selectedSkill.author || "",
                    )}
                  </span>
                )}
                {(loadedSkillDetail?.version || selectedSkill.version) && (
                  <>
                    <span>·</span>
                    <span>
                      v{loadedSkillDetail?.version || selectedSkill.version}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action button */}
          <div className="shrink-0 flex items-center gap-3">
            {isInstalled ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#969696]">
                  {(selectedSkill as LocalSkill).isEnabled
                    ? t("marketplace.active")
                    : t("marketplace.disabled")}
                </span>
                <Switch
                  aria-label={t("marketplace.enableSkill", {
                    name: selectedSkill.name,
                  })}
                  checked={(selectedSkill as LocalSkill).isEnabled}
                  onCheckedChange={(checked) =>
                    handleToggleSkill((selectedSkill as LocalSkill).id, checked)
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setDeleteConfirmSkill(selectedSkill as LocalSkill)
                  }
                  className="h-8 px-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg cursor-pointer"
                  title={t("marketplace.uninstall")}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() =>
                  handleInstallSkill(selectedSkill as MarketplaceSkill)
                }
                disabled={
                  installingSlug !== null ||
                  (selectedScope === "workspace" && !workspacePath)
                }
                className="h-8 px-4 rounded-xl text-xs font-medium gap-1.5 bg-white text-black hover:bg-zinc-200 transition-colors shadow-none cursor-pointer"
              >
                {installingSlug ===
                (selectedSkill.source
                  ? selectedSkill.source + "/" + selectedSkill.slug
                  : selectedSkill.slug) ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t("marketplace.installing")}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 stroke-[2.2]" />
                    <span>{t("marketplace.install")}</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {detailLoading && (
          <p role="status" className="text-sm text-[#969696]">
            {t("marketplace.loadingInstructions")}
          </p>
        )}
        {detailError && (
          <p role="alert" className="text-sm text-[#d4d4d4]">
            {t("marketplace.previewUnavailable")}
          </p>
        )}
        {/* 2 Tabs Row (Overview, Content · N) */}
        <div className="flex items-center gap-6 text-xs font-medium border-b border-[#2e2e2e]">
          <button
            type="button"
            onClick={() => setSkillActiveTab("overview")}
            className={cn(
              "pb-2.5 transition-colors cursor-pointer border-b-2 -mb-[1px]",
              skillActiveTab === "overview"
                ? "border-white text-white font-semibold"
                : "border-transparent text-[#969696] hover:text-white",
            )}
          >
            {t("tabOverview")}
          </button>
          <button
            type="button"
            onClick={() => setSkillActiveTab("content")}
            className={cn(
              "pb-2.5 transition-colors cursor-pointer border-b-2 -mb-[1px]",
              skillActiveTab === "content"
                ? "border-white text-white font-semibold"
                : "border-transparent text-[#969696] hover:text-white",
            )}
          >
            {t("tabContent")} · {filesList.length}
          </button>
        </div>

        {/* Tab 1: OVERVIEW */}
        {skillActiveTab === "overview" && (
          <div className="max-w-3xl flex flex-col gap-4 pt-2">
            {loadedSkillDetail?.overview || selectedSkill.overview ? (
              <div className="p-5 rounded-2xl bg-[#222222] border border-[#383838] select-text">
                <MarkdownContent
                  content={
                    loadedSkillDetail?.overview || selectedSkill.overview || ""
                  }
                />
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-[#222222] border border-[#383838] select-text">
                <p className="text-sm text-[#d4d4d4] leading-relaxed">
                  {loadedSkillDetail?.description || selectedSkill.description}
                </p>
              </div>
            )}

            {/* Slash Command Usage card */}
            <div className="p-4 rounded-2xl bg-[#222222] border border-[#383838] flex flex-col gap-2">
              <span className="text-xs font-semibold text-white">
                {t("slashCommandSkills")}
              </span>
              <p className="text-xs text-[#969696] leading-relaxed">
                {t("skillSlashCommandHint")}:
              </p>
              <div className="px-3 py-2 rounded-xl bg-[#161616] border border-[#2e2e2e] flex items-center justify-between">
                <code className="text-xs font-mono text-white">
                  /{selectedSkill.slug}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopyContent(`/${selectedSkill.slug}`)}
                  className="h-6 px-2 text-[11px] text-[#969696] hover:text-white cursor-pointer"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  <span>{t("common.copy")}</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: CONTENT & FILES */}
        {skillActiveTab === "content" && (
          <div className="flex flex-col md:flex-row gap-4 h-[560px] max-h-[65vh] pt-2">
            {/* File explorer sidebar */}
            <div className="w-full md:w-60 shrink-0 flex flex-col rounded-2xl bg-[#222222] border border-[#383838] overflow-hidden">
              <div className="px-3.5 py-3 border-b border-[#2e2e2e] flex items-center justify-between text-xs font-medium text-[#d4d4d4]">
                <span>
                  {t("marketplace.filesList").replace(
                    "{count}",
                    String(filesList.length),
                  )}
                </span>
              </div>
              <ScrollArea className="flex-1 p-2">
                <div className="flex flex-col gap-1">
                  {filesList.map((fName) => (
                    <button
                      key={fName}
                      type="button"
                      onClick={() => setSelectedFileName(fName)}
                      className={cn(
                        "w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center gap-2 transition-colors cursor-pointer truncate",
                        selectedFileName === fName
                          ? "bg-[#2b2b2b] text-white font-medium border border-[#383838]"
                          : "text-[#969696] hover:bg-[#2b2b2b]/60 hover:text-white",
                      )}
                    >
                      <FileIcon
                        filename={fName}
                        className="w-3.5 h-3.5 shrink-0"
                      />
                      <span className="truncate">{fName}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* File viewer */}
            <div className="flex-1 min-w-0 flex flex-col rounded-2xl bg-[#222222] border border-[#383838] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-[#2e2e2e] flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <FileIcon
                    filename={selectedFileName}
                    className="w-3.5 h-3.5 shrink-0"
                  />
                  <span className="text-xs font-medium text-white truncate">
                    {selectedFileName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center p-0.5 rounded-lg bg-[#161616] border border-[#2e2e2e]">
                    <button
                      type="button"
                      onClick={() => setContentViewMode("preview")}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer",
                        contentViewMode === "preview"
                          ? "bg-[#2b2b2b] text-white"
                          : "text-[#969696] hover:text-white",
                      )}
                    >
                      {t("previewMode")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setContentViewMode("code")}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer",
                        contentViewMode === "code"
                          ? "bg-[#2b2b2b] text-white"
                          : "text-[#969696] hover:text-white",
                      )}
                    >
                      {t("rawCodeMode")}
                    </button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyContent(activeFileContent)}
                    className="h-7 w-7 p-0 rounded-lg text-[#969696] hover:text-white cursor-pointer"
                    title={t("common.copy")}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1 p-5">
                {selectedFileName.endsWith(".md") ||
                selectedFileName === "README.md" ||
                selectedFileName === "SKILL.md" ? (
                  contentViewMode === "preview" ? (
                    <div className="p-2 select-text">
                      <MarkdownContent content={activeFileContent} />
                    </div>
                  ) : (
                    <SkillCodeViewer
                      code={activeFileContent}
                      filename={selectedFileName}
                    />
                  )
                ) : (
                  <SkillCodeViewer
                    code={activeFileContent}
                    filename={selectedFileName}
                  />
                )}
              </ScrollArea>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: VIEW 2 — UPLOAD SKILL VIEW
  // ---------------------------------------------------------------------------
  if (viewMode === "upload") {
    return (
      <div
        className={cn(
          "w-full flex flex-col font-sans select-none outline-none ring-0",
          isModal ? "space-y-4 pb-8" : "space-y-6",
        )}
      >
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("list")}
            className="gap-1.5 text-xs text-[#969696] hover:text-white cursor-pointer -ml-2 h-8"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t("marketplace.title")}</span>
          </Button>
        </div>

        <div className="max-w-2xl mx-auto w-full space-y-6">
          <div>
            <h2 className="text-xl font-medium text-white">
              {t("uploadSkillTitle")}
            </h2>
            <p className="text-xs text-[#969696] mt-1">
              {t("uploadSkillSubtitle")}
            </p>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFileProcess(file);
            }}
            onClick={() => uploadDropzoneInputRef.current?.click()}
            className={cn(
              "rounded-2xl border-2 border-dashed p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors",
              isDragOver
                ? "border-white bg-[#2b2b2b]"
                : "border-[#383838] bg-[#222222] hover:bg-[#2b2b2b]/60",
            )}
          >
            <input
              ref={uploadDropzoneInputRef}
              type="file"
              accept=".md,.zip"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileProcess(file);
              }}
            />
            <div className="w-12 h-12 rounded-2xl bg-[#2b2b2b] border border-[#383838] flex items-center justify-center text-white mb-3">
              <Upload className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-white">
              {uploadFile ? uploadFile.name : t("dragAndDropFiles")}
            </p>
            <p className="text-xs text-[#969696] mt-1">
              .md (SKILL.md) or .zip bundle
            </p>
          </div>

          {scanStatus !== "idle" && (
            <div
              className={cn(
                "p-4 rounded-xl border flex items-center gap-3 text-xs",
                scanStatus === "scanning" &&
                  "bg-blue-500/10 border-blue-500/20 text-blue-300",
                scanStatus === "passed" &&
                  "bg-emerald-500/10 border-emerald-500/20 text-emerald-300",
                scanStatus === "failed" &&
                  "bg-red-500/10 border-red-500/20 text-red-300",
              )}
            >
              {scanStatus === "scanning" && (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              )}
              {scanStatus === "passed" && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              {scanStatus === "failed" && (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{scanMessage}</span>
            </div>
          )}

          {scanStatus === "passed" && (
            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[#d4d4d4] block mb-1">
                  {t("skillName")}
                </label>
                <Input
                  value={uploadSkillName}
                  onChange={(e) => setUploadSkillName(e.target.value)}
                  className="bg-[#2b2b2b] border-[#383838] text-white text-xs h-9 rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#d4d4d4] block mb-1">
                  {t("skillSlug")}
                </label>
                <Input
                  value={uploadSkillSlug}
                  onChange={(e) => setUploadSkillSlug(e.target.value)}
                  className="bg-[#2b2b2b] border-[#383838] text-white text-xs h-9 rounded-xl font-mono"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#d4d4d4] block mb-1">
                  {t("skillDescription")}
                </label>
                <Input
                  value={uploadSkillDescription}
                  onChange={(e) => setUploadSkillDescription(e.target.value)}
                  className="bg-[#2b2b2b] border-[#383838] text-white text-xs h-9 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setViewMode("list")}
                  className="h-9 px-4 text-xs text-[#969696] hover:text-white"
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  className="h-9 px-4 text-xs bg-white text-black hover:bg-zinc-200 rounded-xl font-medium"
                >
                  {t("saveSkill")}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: MAIN MARKETPLACE VIEW
  // ---------------------------------------------------------------------------
  return (
    <div
      className={cn(
        "w-full flex flex-col font-sans outline-none ring-0",
        isModal ? "space-y-5" : "space-y-6",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-2">
          {!isSidebarOpen && onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-label={t("topToolbar.toggleSidebar")}
              className="p-2 rounded-lg text-[#969696] hover:text-white"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-medium tracking-tight text-white">
              {t("marketplace.title")}
            </h1>
            <p className="text-sm text-[#969696] mt-1">
              {t(marketplaceTab === "skills" ? "marketplace.skillsIntro" : "marketplace.pluginUsageHint")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {marketplaceTab === "skills" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenSkillsFolder}
                className="text-[#969696] gap-2"
              >
                <Folder className="w-4 h-4" />
                {t("marketplace.openFolder")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setViewMode("upload")}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                {t("uploadBtn")}
              </Button>
            </>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              aria-label={t("common.close")}
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-5 text-sm" role="tablist" aria-label={t("marketplace.title")}>
        <button
          type="button"
          role="tab"
          aria-selected={marketplaceTab === "skills"}
          onClick={() => handleMarketplaceTabChange("skills")}
          className={cn(
            "py-2",
            marketplaceTab === "skills" ? "text-white" : "text-[#969696]",
          )}
        >
          {t("marketplace.tabSkills")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={marketplaceTab === "plugins"}
          onClick={() => handleMarketplaceTabChange("plugins")}
          className={cn(
            "py-2",
            marketplaceTab === "plugins" ? "text-white" : "text-[#969696]",
          )}
        >
          {t("marketplace.tabPlugins")}{" "}
          <span className="text-[#969696]">{pluginCatalog.length}</span>
        </button>
      </div>
      {progressPanel}
      {marketplaceTab === "skills" ? (
        <SkillsLibrary
          skills={skills}
          query={searchQuery}
          onQueryChange={setSearchQuery}
          scope={selectedScope}
          onScopeChange={setSelectedScope}
          workspacePath={workspacePath}
          installing={installingSlug !== null}
          onInstall={(item) =>
            void handleInstallSkill({
              id: item.id,
              slug: item.skillId,
              name: item.name,
              description: item.description ?? "",
              category: "custom",
              author: item.source,
              version: "",
              source: item.source,
            })
          }
          onSelect={selectLibraryItem}
          onToggle={(skill, enabled) =>
            void handleToggleSkill(skill.id, enabled)
          }
          onUninstall={setDeleteConfirmSkill}
        />
      ) : (
        <>
          <Input
            aria-label={t("marketplace.searchPlaceholder")}
            placeholder={t("marketplace.searchPlaceholder")}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <PluginsMarketplace
            workspacePath={workspacePath}
            scope="all"
            search={searchQuery}
          />
        </>
      )}
      {deleteDialog}
    </div>
  );
}
