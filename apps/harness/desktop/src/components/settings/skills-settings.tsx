import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Button,
  Input,
  ScrollArea,
  Switch,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  toast,
  cn,
} from "@const/ui";
import {
  Search,
  Plus,
  PanelLeft,
  RotateCw,
  MoreHorizontal,
  Trash2,
  PencilSparkles,
  FileText,
  FileCode,
  Upload,
  Eye,
  Code,
  X,
  Check,
  ChevronRight,
  User,
  ArrowLeft,
  Copy,
  Shield,
  ShieldCheck,
  ShieldAlert,
  File,
  Terminal,
  Blocks,
  Store,
  Folder,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Download,
} from "lucide-react";
import { marked } from "marked";
import JSZip from "jszip";
import {
  db,
  localDb,
  type LocalSkill,
  type LocalSkillBundle,
  type SkillCategory,
} from "../../lib/db";
import { useI18n } from "../../lib/i18n";
import {
  syncInstalledSkillsFromDisk,
  installSkillFromMarketplace,
  uninstallSkillFromMarketplace,
  fetchSkillContent,
  parseSkillMarkdown,
  generateSkillOverview,
  runSecurityScan,
  MARKETPLACE_CATALOG,
  type MarketplaceSkill,
} from "../../lib/skills/skills-service";
import { FileIcon } from "../workbench/file-icon";
import { MarkdownContent } from "../workbench/markdown-content";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function highlightPythonLine(line: string): string {
  const regex =
    /(#.*$)|(f?["'](?:\\.|[^"'\\])*["'])|(\b(?:def|class|return|if|elif|else|for|while|try|except|finally|with|as|import|from|in|is|not|and|or|lambda|yield|raise|pass|break|continue|async|await|global|nonlocal|assert)\b)|(\b(?:True|False|None|self|cls|print|len|range|open|int|str|float|bool|list|dict|set|tuple|enumerate|zip|map|filter|type)\b)|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_]\w*(?=\s*\())|([a-zA-Z_]\w*)|([^\s\w]+)|(\s+)/g;

  return line.replace(
    regex,
    (match, comment, str, kw, builtin, num, fnCall, _ident, _symbol, spaces) => {
      if (comment) return `<span class="text-zinc-400 dark:text-zinc-500 italic">${escapeHtml(comment)}</span>`;
      if (str) return `<span class="text-emerald-600 dark:text-emerald-400">${escapeHtml(str)}</span>`;
      if (kw) return `<span class="text-purple-600 dark:text-purple-400 font-semibold">${escapeHtml(kw)}</span>`;
      if (builtin) return `<span class="text-sky-600 dark:text-sky-400">${escapeHtml(builtin)}</span>`;
      if (num) return `<span class="text-amber-600 dark:text-amber-400">${escapeHtml(num)}</span>`;
      if (fnCall) return `<span class="text-blue-600 dark:text-blue-300">${escapeHtml(fnCall)}</span>`;
      if (spaces) return spaces;
      return escapeHtml(match);
    }
  );
}

function highlightJsTsLine(line: string): string {
  const regex =
    /(\/\/.*$)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b(?:import|export|from|as|default|const|let|var|function|return|if|else|switch|case|break|continue|for|while|do|try|catch|finally|throw|new|class|extends|implements|interface|type|enum|public|private|protected|readonly|static|async|await|yield|typeof|instanceof|void|null|undefined|this|super|true|false)\b)|(\b(?:string|number|boolean|any|unknown|never|object|Symbol|BigInt|Array|Record|Promise|Map|Set|Date|RegExp|Error|JSON|Math|console)\b)|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_$][\w$]*(?=\s*\())|([a-zA-Z_$][\w$]*)|([^\s\w$]+)|(\s+)/g;

  return line.replace(
    regex,
    (match, comment, str, kw, builtin, num, fnCall, _ident, _symbol, spaces) => {
      if (comment) return `<span class="text-zinc-400 dark:text-zinc-500 italic">${escapeHtml(comment)}</span>`;
      if (str) return `<span class="text-emerald-600 dark:text-emerald-400">${escapeHtml(str)}</span>`;
      if (kw) return `<span class="text-purple-600 dark:text-purple-400 font-semibold">${escapeHtml(kw)}</span>`;
      if (builtin) return `<span class="text-sky-600 dark:text-sky-400">${escapeHtml(builtin)}</span>`;
      if (num) return `<span class="text-amber-600 dark:text-amber-400">${escapeHtml(num)}</span>`;
      if (fnCall) return `<span class="text-blue-600 dark:text-blue-300">${escapeHtml(fnCall)}</span>`;
      if (spaces) return spaces;
      return escapeHtml(match);
    }
  );
}

export function highlightCodeLines(code: string, filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const lines = code.split("\n");

  return lines
    .map((line, idx) => {
      let highlighted = escapeHtml(line);
      if (ext === "py") {
        highlighted = highlightPythonLine(line);
      } else if (ext === "ts" || ext === "js" || ext === "tsx" || ext === "jsx" || ext === "json") {
        highlighted = highlightJsTsLine(line);
      }
      return `<div class="table-row hover:bg-[#252528] transition-colors leading-5"><span class="table-cell select-none pr-4 text-right text-[11px] text-[#5d5d5d] font-mono w-10">${idx + 1}</span><span class="table-cell select-text text-xs font-mono text-[#d4d4d4] whitespace-pre">${highlighted || "&nbsp;"}</span></div>`;
    })
    .join("");
}

function SkillCodeViewer({ code, filename }: { code: string; filename: string }) {
  const highlightedHtml = useMemo(() => {
    return highlightCodeLines(code, filename);
  }, [code, filename]);

  return (
    <div className="w-full h-full overflow-auto bg-[#161616] rounded-xl p-3 border border-[#2e2e2e]">
      <div className="table w-full border-collapse font-mono" dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
    </div>
  );
}

export interface SkillsSettingsProps {
  onClose?: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  isModal?: boolean;
  initialTab?: "skills" | "plugins";
}

export function SkillsSettings({
  onClose,
  isSidebarOpen,
  onToggleSidebar,
  isModal = false,
  initialTab = "skills",
}: SkillsSettingsProps = {}) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadDropzoneInputRef = useRef<HTMLInputElement | null>(null);

  // Live Query of installed skills from Dexie DB
  const skills = useLiveQuery(() => db.skills.toArray(), [], [] as LocalSkill[]);

  // Marketplace tab: Skills vs Plugins
  const [marketplaceTab, setMarketplaceTab] = useState<"skills" | "plugins">(initialTab);

  // Navigation state
  const [viewMode, setViewMode] = useState<"list" | "skill-detail" | "upload">("list");
  const [selectedSkill, setSelectedSkill] = useState<LocalSkill | MarketplaceSkill | null>(null);
  const [installingSlug, setInstallingSlug] = useState<string | null>(null);

  // Detail view state
  const [skillActiveTab, setSkillActiveTab] = useState<"overview" | "content">("overview");
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [contentViewMode, setContentViewMode] = useState<"preview" | "code">("preview");

  // List filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedScope, setSelectedScope] = useState<"all" | "user" | "workspace">("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [deleteConfirmSkill, setDeleteConfirmSkill] = useState<LocalSkill | null>(null);
  const [isManualCreateOpen, setIsManualCreateOpen] = useState(false);

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
    if (selectedSkill) {
      fetchSkillContent(selectedSkill.slug).then((res) => {
        if (!cancelled && res) {
          const overview = generateSkillOverview(
            res.name || selectedSkill.name,
            selectedSkill.slug,
            res.content,
            res.description || selectedSkill.description
          );
          setLoadedSkillDetail({
            content: res.content,
            files: res.files,
            overview,
            author: res.author,
            version: res.version,
            description: res.description,
          });
        }
      });
    } else {
      setLoadedSkillDetail(null);
    }
    return () => {
      cancelled = true;
    };
  }, [selectedSkill?.slug]);

  // Sync installed skills from disk on mount
  useEffect(() => {
    syncInstalledSkillsFromDisk().catch((err) =>
      console.warn("[Marketplace] Disk sync on mount:", err)
    );
  }, []);

  // Update selected skill when db updates
  useEffect(() => {
    if (selectedSkill && "createdAt" in selectedSkill) {
      const refreshed = skills.find((s) => s.id === (selectedSkill as LocalSkill).id);
      if (refreshed) setSelectedSkill(refreshed);
    }
  }, [skills]);

  // Set of installed skill slugs (lowercase)
  const installedSlugs = useMemo(() => {
    return new Set((skills || []).map((s) => s.slug.toLowerCase().trim()));
  }, [skills]);

  // Filtered installed skills
  const filteredInstalledSkills = useMemo(() => {
    return (skills || []).filter((skill) => {
      if (selectedScope === "user" && skill.scope === "workspace") return false;
      if (selectedScope === "workspace" && skill.scope !== "workspace") return false;
      if (selectedCategory !== "all" && skill.category !== selectedCategory) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = skill.name.toLowerCase().includes(q);
        const matchesSlug = skill.slug.toLowerCase().includes(q);
        const matchesDesc = (skill.description || "").toLowerCase().includes(q);
        const matchesAuthor = (skill.author || "").toLowerCase().includes(q);
        return matchesName || matchesSlug || matchesDesc || matchesAuthor;
      }
      return true;
    });
  }, [skills, selectedScope, selectedCategory, searchQuery]);

  // Available marketplace skills (uninstalled)
  const availableMarketplaceSkills = useMemo(() => {
    return MARKETPLACE_CATALOG.filter((item) => {
      if (installedSlugs.has(item.slug.toLowerCase().trim())) return false;
      if (selectedCategory !== "all" && item.category !== selectedCategory) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesSlug = item.slug.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesAuthor = item.author.toLowerCase().includes(q);
        return matchesName || matchesSlug || matchesDesc || matchesAuthor;
      }
      return true;
    });
  }, [installedSlugs, selectedCategory, searchQuery]);

  // Compute file map for skill content tab
  const skillFilesMap = useMemo(() => {
    if (!selectedSkill) return {};
    if (loadedSkillDetail?.files && Object.keys(loadedSkillDetail.files).length > 0) {
      return loadedSkillDetail.files;
    }
    if ("files" in selectedSkill && selectedSkill.files && Object.keys(selectedSkill.files).length > 0) {
      return selectedSkill.files;
    }
    const content = loadedSkillDetail?.content || ("content" in selectedSkill ? selectedSkill.content : "");
    if (content) {
      return {
        "SKILL.md": content,
      };
    }
    return {
      "SKILL.md": `# ${selectedSkill.name}\n\n${selectedSkill.description}`,
    };
  }, [selectedSkill, loadedSkillDetail]);

  useEffect(() => {
    if (viewMode === "skill-detail" && selectedSkill) {
      const keys = Object.keys(skillFilesMap);
      if (keys.length > 0 && (!selectedFileName || !skillFilesMap[selectedFileName])) {
        setSelectedFileName(keys[0]!);
      }
    }
  }, [viewMode, selectedSkill, skillFilesMap]);

  // Handlers
  const handleToggleSkill = async (id: string, isEnabled: boolean) => {
    try {
      await localDb.toggleSkill(id, isEnabled);
      toast.success(isEnabled ? t("skillEnabled") : t("skillDisabled"));
    } catch {
      toast.error(t("marketplace.failedToUpdateStatus"));
    }
  };

  const handleInstallSkill = async (skill: MarketplaceSkill) => {
    setInstallingSlug(skill.slug);
    try {
      const installed = await installSkillFromMarketplace(
        skill.slug,
        selectedScope === "workspace" ? "workspace" : "user"
      );
      toast.success(t("marketplace.installedSuccess").replace("{name}", skill.name));
      if (selectedSkill && selectedSkill.slug === skill.slug) {
        setSelectedSkill(installed);
      }
    } catch (err: any) {
      toast.error(err?.message || t("marketplace.failedToInstall"));
    } finally {
      setInstallingSlug(null);
    }
  };

  const handleUninstallSkill = async (skill: LocalSkill) => {
    try {
      await uninstallSkillFromMarketplace(skill.id, skill.slug, skill.scope);
      toast.success(t("marketplace.uninstalledSuccess").replace("{name}", skill.name));
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
  const [uploadFilesMap, setUploadFilesMap] = useState<Record<string, string>>({});
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "passed" | "failed">("idle");
  const [scanMessage, setScanMessage] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  // Manual create form state
  const [manualName, setManualName] = useState("");
  const [manualSlug, setManualSlug] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualContent, setManualContent] = useState("");
  const [manualCategory, setManualCategory] = useState<SkillCategory>("custom");

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
            if (ext && ["md", "txt", "json", "yaml", "yml", "ts", "js", "py"].includes(ext)) {
              filesMap[relativePath] = await zipEntry.async("text");
            }
          }
        }

        const skillMdKey = Object.keys(filesMap).find(
          (k) => k.endsWith("SKILL.md") || k === "SKILL.md"
        );
        const mainContent = skillMdKey ? filesMap[skillMdKey] || "" : "";
        const parsed = parseSkillMarkdown(mainContent);

        const scan = runSecurityScan(mainContent);
        if (!scan.passed) {
          setScanStatus("failed");
          setScanMessage(scan.message);
          return;
        }

        setUploadFilesMap(filesMap);
        setUploadSkillContent(mainContent);
        setUploadSkillName(parsed.name || file.name.replace(".zip", ""));
        setUploadSkillSlug(parsed.slug || file.name.replace(".zip", "").toLowerCase());
        setUploadSkillDescription(parsed.description || "");
        setUploadSkillOverview(generateSkillOverview(parsed.name, parsed.slug, mainContent, parsed.description));
        setUploadCategory((parsed.frontmatter.category as SkillCategory) || "custom");
        setScanStatus("passed");
        setScanMessage(t("securityScanClean"));
      } else {
        const text = await file.text();
        const parsed = parseSkillMarkdown(text);
        const scan = runSecurityScan(text);
        if (!scan.passed) {
          setScanStatus("failed");
          setScanMessage(scan.message);
          return;
        }

        setUploadSkillContent(text);
        setUploadSkillName(parsed.name || file.name.replace(/\.[^/.]+$/, ""));
        setUploadSkillSlug(parsed.slug || file.name.replace(/\.[^/.]+$/, "").toLowerCase());
        setUploadSkillDescription(parsed.description || "");
        setUploadSkillOverview(generateSkillOverview(parsed.name, parsed.slug, text, parsed.description));
        setUploadCategory((parsed.frontmatter.category as SkillCategory) || "custom");
        setUploadFilesMap({ "SKILL.md": text });
        setScanStatus("passed");
        setScanMessage(t("securityScanClean"));
      }
    } catch (err: any) {
      setScanStatus("failed");
      setScanMessage(err?.message || "Failed to process file");
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadSkillName.trim()) {
      toast.error(t("marketplace.nameRequired"));
      return;
    }
    try {
      const id = "skill_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      const now = Date.now();
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

  const handleManualSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualSlug.trim()) {
      toast.error(t("marketplace.nameAndSlugRequired"));
      return;
    }
    try {
      const id = "skill_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      const now = Date.now();
      await db.skills.add({
        id,
        slug: manualSlug.trim().toLowerCase(),
        name: manualName.trim(),
        description: manualDescription.trim(),
        content: manualContent,
        icon: "PencilSparkles",
        category: manualCategory,
        isBuiltIn: false,
        isEnabled: true,
        scope: selectedScope === "workspace" ? "workspace" : "user",
        author: "User",
        version: "1.0.0",
        overview: generateSkillOverview(manualName, manualSlug, manualContent, manualDescription),
        files: { "SKILL.md": manualContent },
        createdAt: now,
        updatedAt: now,
      });

      toast.success(t("skillAddedSuccess").replace("{name}", manualName));
      setIsManualCreateOpen(false);
      setManualName("");
      setManualSlug("");
      setManualDescription("");
      setManualContent("");
    } catch {
      toast.error(t("marketplace.failedToCreateSkill"));
    }
  };

  const handleCopyContent = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t("marketplace.copiedToClipboard"));
  };

  const CATEGORY_FILTERS: Array<{ id: string; label: string }> = [
    { id: "all", label: t("marketplace.filterAll") },
    { id: "coding_dev", label: t("marketplace.filterCoding") },
    { id: "motion_video", label: t("marketplace.filterCreative") },
    { id: "finance", label: t("marketplace.filterFinance") },
    { id: "scraping_research", label: t("marketplace.filterResearch") },
    { id: "design", label: t("marketplace.filterDesign") },
    { id: "agent_workflow", label: t("marketplace.filterWorkflow") },
    { id: "document", label: t("marketplace.filterDocument") },
  ];

  // ---------------------------------------------------------------------------
  // RENDER: VIEW 1 — SKILL DETAIL VIEW
  // ---------------------------------------------------------------------------
  if (viewMode === "skill-detail" && selectedSkill) {
    const isInstalled = "createdAt" in selectedSkill || installedSlugs.has(selectedSkill.slug.toLowerCase().trim());
    const activeFileContent =
      skillFilesMap[selectedFileName] ||
      loadedSkillDetail?.content ||
      ("content" in selectedSkill ? selectedSkill.content : "") ||
      "";
    const filesList = Object.keys(skillFilesMap);

    return (
      <div className={cn("w-full flex flex-col font-sans select-none outline-none ring-0", isModal ? "space-y-4 pb-8" : "space-y-6")}>
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
                      loadedSkillDetail?.author || selectedSkill.author || ""
                    )}
                  </span>
                )}
                {(loadedSkillDetail?.version || selectedSkill.version) && (
                  <>
                    <span>·</span>
                    <span>v{loadedSkillDetail?.version || selectedSkill.version}</span>
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
                  {(selectedSkill as LocalSkill).isEnabled ? t("marketplace.active") : t("marketplace.disabled")}
                </span>
                <Switch
                  checked={(selectedSkill as LocalSkill).isEnabled}
                  onCheckedChange={(checked) => handleToggleSkill((selectedSkill as LocalSkill).id, checked)}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteConfirmSkill(selectedSkill as LocalSkill)}
                  className="h-8 px-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg cursor-pointer"
                  title={t("marketplace.uninstall")}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => handleInstallSkill(selectedSkill as MarketplaceSkill)}
                disabled={installingSlug === selectedSkill.slug}
                className="h-8 px-4 rounded-xl text-xs font-medium gap-1.5 bg-white text-black hover:bg-zinc-200 transition-colors shadow-none cursor-pointer"
              >
                {installingSlug === selectedSkill.slug ? (
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

        {/* 2 Tabs Row (Overview, Content · N) */}
        <div className="flex items-center gap-6 text-xs font-medium border-b border-[#2e2e2e]">
          <button
            type="button"
            onClick={() => setSkillActiveTab("overview")}
            className={cn(
              "pb-2.5 transition-colors cursor-pointer border-b-2 -mb-[1px]",
              skillActiveTab === "overview"
                ? "border-white text-white font-semibold"
                : "border-transparent text-[#969696] hover:text-white"
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
                : "border-transparent text-[#969696] hover:text-white"
            )}
          >
            {t("tabContent")} · {filesList.length}
          </button>
        </div>

        {/* Tab 1: OVERVIEW */}
        {skillActiveTab === "overview" && (
          <div className="max-w-3xl flex flex-col gap-4 pt-2">
            {(loadedSkillDetail?.overview || selectedSkill.overview) ? (
              <div className="p-5 rounded-2xl bg-[#222222] border border-[#383838] select-text">
                <MarkdownContent content={loadedSkillDetail?.overview || selectedSkill.overview || ""} />
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
                  <span>Copy</span>
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
                <span>{t("marketplace.filesList").replace("{count}", String(filesList.length))}</span>
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
                          : "text-[#969696] hover:bg-[#2b2b2b]/60 hover:text-white"
                      )}
                    >
                      <FileIcon filename={fName} className="w-3.5 h-3.5 shrink-0" />
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
                  <FileIcon filename={selectedFileName} className="w-3.5 h-3.5 shrink-0" />
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
                          : "text-[#969696] hover:text-white"
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
                          : "text-[#969696] hover:text-white"
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
                    title={t("copyCode")}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1 p-5">
                {selectedFileName.endsWith(".md") || selectedFileName === "README.md" || selectedFileName === "SKILL.md" ? (
                  contentViewMode === "preview" ? (
                    <div className="p-2 select-text">
                      <MarkdownContent content={activeFileContent} />
                    </div>
                  ) : (
                    <SkillCodeViewer code={activeFileContent} filename={selectedFileName} />
                  )
                ) : (
                  <SkillCodeViewer code={activeFileContent} filename={selectedFileName} />
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
      <div className={cn("w-full flex flex-col font-sans select-none outline-none ring-0", isModal ? "space-y-4 pb-8" : "space-y-6")}>
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
                : "border-[#383838] bg-[#222222] hover:bg-[#2b2b2b]/60"
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
                scanStatus === "scanning" && "bg-blue-500/10 border-blue-500/20 text-blue-300",
                scanStatus === "passed" && "bg-emerald-500/10 border-emerald-500/20 text-emerald-300",
                scanStatus === "failed" && "bg-red-500/10 border-red-500/20 text-red-300"
              )}
            >
              {scanStatus === "scanning" && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
              {scanStatus === "passed" && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              {scanStatus === "failed" && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
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
                  Cancel
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
    <div className={cn("w-full flex flex-col font-sans select-none outline-none ring-0", isModal ? "space-y-5" : "space-y-6")}>
      {/* 1. Header with Title & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            {!isSidebarOpen && onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                className="p-1.5 -ml-1 rounded-xl bg-[#2b2b2b] hover:bg-[#383838] text-[#969696] hover:text-white transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-none"
                title={t("chat.toggleSidebar")}
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            )}
            <h1 className="text-xl sm:text-2xl font-medium tracking-tight text-white">
              {t("marketplace.title")}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#1b1b1b] border border-[#2e2e2e] text-[#969696] font-sans tabular-nums">
              {skills.length + availableMarketplaceSkills.length}
            </span>
          </div>
          <p className="text-xs text-[#969696] mt-0.5">
            {t("marketplace.subtitle")}
          </p>
        </div>

        {/* Search Bar & Actions */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#5d5d5d] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("marketplace.searchPlaceholder")}
              className="h-8 w-44 sm:w-56 pl-8 pr-7 text-xs rounded-xl bg-[#2b2b2b] border-[#383838] text-white placeholder-[#5d5d5d] focus-visible:ring-0 shadow-none outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#969696] hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <Button
            size="sm"
            onClick={handleOpenSkillsFolder}
            className="h-8 px-3 rounded-xl text-xs font-medium gap-1.5 bg-[#222222] border border-[#383838] text-[#d4d4d4] hover:text-white hover:bg-[#2b2b2b] transition-all cursor-pointer shadow-none"
            title={t("marketplace.openFolder")}
          >
            <Folder className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t("marketplace.openFolder")}</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setViewMode("upload")}
            className="h-8 px-3 rounded-xl text-xs font-medium gap-1.5 bg-white text-black hover:bg-zinc-200 transition-all cursor-pointer shadow-none"
          >
            <Upload className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>{t("uploadBtn")}</span>
          </Button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#969696] hover:text-white hover:bg-[#2b2b2b] transition-colors cursor-pointer"
              title={t("common.close")}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Segmented Switcher: [ Skills ] [ Plugins ] */}
      <div className="flex items-center gap-3 border-b border-[#2e2e2e] pb-1">
        <div className="flex items-center p-1 rounded-xl bg-[#1b1b1b] border border-[#2e2e2e]">
          <button
            type="button"
            onClick={() => setMarketplaceTab("skills")}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-2",
              marketplaceTab === "skills"
                ? "bg-[#2b2b2b] text-white shadow-xs font-semibold"
                : "text-[#969696] hover:text-white"
            )}
          >
            <PencilSparkles className="w-3.5 h-3.5 text-white" />
            <span>{t("marketplace.tabSkills")}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#161616] text-[#969696]">
              {skills.length + availableMarketplaceSkills.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMarketplaceTab("plugins")}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-2",
              marketplaceTab === "plugins"
                ? "bg-[#2b2b2b] text-white shadow-xs font-semibold"
                : "text-[#969696] hover:text-white"
            )}
          >
            <Blocks className="w-3.5 h-3.5 text-[#969696]" />
            <span>{t("marketplace.tabPlugins")}</span>
          </button>
        </div>

        {marketplaceTab === "skills" && (
          <div className="flex items-center p-1 rounded-xl bg-[#1b1b1b] border border-[#2e2e2e] ml-auto">
            <button
              type="button"
              onClick={() => setSelectedScope("all")}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                selectedScope === "all" ? "bg-[#2b2b2b] text-white font-semibold" : "text-[#969696] hover:text-white"
              )}
            >
              {t("allScope") || "All"}
            </button>
            <button
              type="button"
              onClick={() => setSelectedScope("user")}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                selectedScope === "user" ? "bg-[#2b2b2b] text-white font-semibold" : "text-[#969696] hover:text-white"
              )}
            >
              {t("userScope") || "Personal"}
            </button>
            <button
              type="button"
              onClick={() => setSelectedScope("workspace")}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                selectedScope === "workspace" ? "bg-[#2b2b2b] text-white font-semibold" : "text-[#969696] hover:text-white"
              )}
            >
              {t("workspaceScope") || "Workspace"}
            </button>
          </div>
        )}
      </div>

      {/* 3. TAB CONTENT: PLUGINS (EMPTY STATE) */}
      {marketplaceTab === "plugins" && (
        <div className="rounded-2xl bg-[#222222] border border-[#383838] p-12 flex flex-col items-center justify-center text-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-[#2b2b2b] border border-[#383838] flex items-center justify-center text-[#969696] mb-1">
            <Blocks className="w-8 h-8 text-[#969696]" />
          </div>
          <h3 className="text-base font-medium text-white">
            {t("marketplace.pluginsComingSoonTitle")}
          </h3>
          <p className="text-xs text-[#969696] max-w-md leading-relaxed">
            {t("marketplace.pluginsComingSoonDesc")}
          </p>
          <div className="mt-2">
            <span className="px-3 py-1 rounded-full bg-[#1b1b1b] border border-[#2e2e2e] text-[#969696] text-xs font-sans">
              {t("marketplace.inDevelopment")}
            </span>
          </div>
        </div>
      )}

      {/* 4. TAB CONTENT: SKILLS */}
      {marketplaceTab === "skills" && (
        <div className="space-y-6">
          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
            {CATEGORY_FILTERS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer",
                  selectedCategory === cat.id
                    ? "bg-white text-black font-semibold"
                    : "bg-[#1b1b1b] border border-[#2e2e2e] text-[#969696] hover:text-white hover:bg-[#252528]"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* ================================================================= */}
          {/* SECTION A: INSTALLED SKILLS (ON TOP)                              */}
          {/* ================================================================= */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                  {t("marketplace.installedSection")}
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#1b1b1b] border border-[#2e2e2e] text-[#969696] font-mono">
                  {filteredInstalledSkills.length}
                </span>
              </div>
            </div>

            {filteredInstalledSkills.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#383838] bg-[#1b1b1b]/50 p-6 flex flex-col items-center justify-center text-center gap-1.5">
                <p className="text-xs font-medium text-[#d4d4d4]">
                  {t("marketplace.noInstalledTitle")}
                </p>
                <p className="text-[11px] text-[#969696] max-w-sm leading-relaxed">
                  {t("marketplace.noInstalledDesc")}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredInstalledSkills.map((skill) => (
                  <div
                    key={skill.id}
                    onClick={() => {
                      setSelectedSkill(skill);
                      setSkillActiveTab("overview");
                      setViewMode("skill-detail");
                    }}
                    className="rounded-xl bg-[#222222] border border-[#2e2e2e] hover:border-[#383838] p-4 flex flex-col justify-between transition-all group cursor-pointer"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-[#2b2b2b] border border-[#383838] flex items-center justify-center text-white shrink-0 group-hover:border-primary/40 transition-colors">
                            <PencilSparkles className="w-4 h-4 text-white" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-white group-hover:text-primary transition-colors truncate">
                                {skill.name}
                              </span>
                              <span className="text-[11px] font-mono text-[#969696]">
                                /{skill.slug}
                              </span>
                            </div>
                            {skill.author && (
                              <p className="text-[10px] text-[#969696] mt-0.5">
                                by @{skill.author}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Right: Switch & Uninstall */}
                        <div
                          className="flex items-center gap-2.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Switch
                            checked={skill.isEnabled}
                            onCheckedChange={(checked) => handleToggleSkill(skill.id, checked)}
                          />
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmSkill(skill)}
                            className="p-1 rounded-lg text-[#969696] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title={t("marketplace.uninstall")}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {skill.description && (
                        <p className="text-xs text-[#969696] line-clamp-2 mt-2 leading-relaxed">
                          {skill.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[#2e2e2e]/50 text-[10px]">
                      <span className="px-2 py-0.5 rounded-md bg-[#1b1b1b] border border-[#2e2e2e] text-[#969696] capitalize">
                        {skill.category.replace(/_/g, " ")}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-[#1b1b1b] border border-[#2e2e2e] text-[#969696]">
                        {skill.scope === "workspace" ? t("marketplace.workspaceScope") : t("marketplace.globalScope")}
                      </span>
                      <div className="ml-auto flex items-center gap-1.5 text-[#969696]">
                        <span className={cn("w-1.5 h-1.5 rounded-full", skill.isEnabled ? "bg-emerald-400" : "bg-[#5d5d5d]")} />
                        <span>{skill.isEnabled ? t("marketplace.active") : t("marketplace.disabled")}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ================================================================= */}
          {/* SECTION B: AVAILABLE IN MARKETPLACE (BELOW)                       */}
          {/* ================================================================= */}
          <div className="space-y-3 pt-4 border-t border-[#2e2e2e]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                  {t("marketplace.availableSection")}
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#1b1b1b] border border-[#2e2e2e] text-[#969696] font-mono">
                  {availableMarketplaceSkills.length}
                </span>
              </div>
            </div>

            {availableMarketplaceSkills.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#383838] bg-[#1b1b1b]/50 p-6 flex flex-col items-center justify-center text-center gap-1.5">
                <p className="text-xs font-medium text-[#d4d4d4]">
                  {t("marketplace.noAvailableTitle")}
                </p>
                <p className="text-[11px] text-[#969696] max-w-sm leading-relaxed">
                  {t("marketplace.noAvailableDesc")}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {availableMarketplaceSkills.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedSkill(item);
                      setSkillActiveTab("overview");
                      setViewMode("skill-detail");
                    }}
                    className="rounded-xl bg-[#1b1b1b] border border-[#2e2e2e] hover:border-[#383838] p-4 flex flex-col justify-between transition-all group cursor-pointer"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-[#222222] border border-[#2e2e2e] flex items-center justify-center text-[#d4d4d4] shrink-0 group-hover:border-primary/40 transition-colors">
                            <PencilSparkles className="w-4 h-4 text-[#d4d4d4]" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-white group-hover:text-primary transition-colors truncate">
                                {item.name}
                              </span>
                              <span className="text-[11px] font-mono text-[#969696]">
                                /{item.slug}
                              </span>
                            </div>
                            <p className="text-[10px] text-[#969696] mt-0.5">
                              by @{item.author}
                            </p>
                          </div>
                        </div>

                        {/* Install Button */}
                        <div onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            onClick={() => handleInstallSkill(item)}
                            disabled={installingSlug === item.slug}
                            className="h-7 px-3.5 rounded-lg text-xs font-medium bg-white text-black hover:bg-zinc-200 transition-colors shadow-none cursor-pointer"
                          >
                            {installingSlug === item.slug ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <span>{t("marketplace.install")}</span>
                            )}
                          </Button>
                        </div>
                      </div>

                      <p className="text-xs text-[#969696] line-clamp-2 mt-2 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[#2e2e2e]/40 text-[10px]">
                      <span className="px-2 py-0.5 rounded-md bg-[#222222] border border-[#2e2e2e] text-[#969696] capitalize">
                        {item.category.replace(/_/g, " ")}
                      </span>
                      <span className="text-[#5d5d5d] ml-auto">
                        v{item.version}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete / Uninstall Confirmation Dialog */}
      {deleteConfirmSkill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setDeleteConfirmSkill(null)}
        >
          <div
            className="w-[420px] max-w-[95vw] bg-[#222222] border border-[#383838] rounded-2xl p-5 flex flex-col gap-4 text-white shadow-2xl animate-in zoom-in-[0.985] duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {t("marketplace.uninstallConfirmTitle")}
                </h3>
                <p className="text-xs text-[#969696] mt-1 leading-relaxed">
                  {t("marketplace.uninstallConfirmDesc").replace("{name}", deleteConfirmSkill.name)}
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
                Cancel
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
      )}

      {/* Manual Create Dialog */}
      {isManualCreateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setIsManualCreateOpen(false)}
        >
          <div
            className="w-[560px] max-w-[95vw] max-h-[85vh] bg-[#222222] border border-[#383838] rounded-2xl flex flex-col overflow-hidden text-white shadow-2xl animate-in zoom-in-[0.985] duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[#2e2e2e] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Create Skill from Scratch
                </h3>
                <p className="text-xs text-[#969696] mt-0.5">
                  Write customized instructions and prompt triggers for your agent.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsManualCreateOpen(false)}
                className="p-1 rounded-lg text-[#969696] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleManualSave} className="flex-1 min-h-0 flex flex-col">
              <ScrollArea className="flex-1 p-5 space-y-4">
                <div>
                  <label className="text-xs font-medium text-[#d4d4d4] block mb-1">
                    {t("skillName")}
                  </label>
                  <Input
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder={t("marketplace.skillNamePlaceholder")}
                    className="bg-[#2b2b2b] border-[#383838] text-white text-xs h-9 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#d4d4d4] block mb-1">
                    {t("skillSlug")}
                  </label>
                  <Input
                    value={manualSlug}
                    onChange={(e) => setManualSlug(e.target.value)}
                    placeholder={t("marketplace.skillSlugPlaceholder")}
                    className="bg-[#2b2b2b] border-[#383838] text-white text-xs h-9 rounded-xl font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#d4d4d4] block mb-1">
                    {t("skillDescription")}
                  </label>
                  <Input
                    value={manualDescription}
                    onChange={(e) => setManualDescription(e.target.value)}
                    placeholder={t("marketplace.skillDescPlaceholder")}
                    className="bg-[#2b2b2b] border-[#383838] text-white text-xs h-9 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#d4d4d4] block mb-1">
                    {t("skillContent")}
                  </label>
                  <textarea
                    value={manualContent}
                    onChange={(e) => setManualContent(e.target.value)}
                    rows={8}
                    placeholder={t("marketplace.skillContentPlaceholder")}
                    className="w-full bg-[#161616] border border-[#2e2e2e] rounded-xl p-3 text-xs text-white font-mono placeholder-[#5d5d5d] focus:outline-none focus:border-[#383838] resize-none"
                    required
                  />
                </div>
              </ScrollArea>

              <div className="p-4 border-t border-[#2e2e2e] flex justify-end gap-2 bg-[#222222]">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsManualCreateOpen(false)}
                  className="h-8 px-3 text-xs text-[#969696] hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="h-8 px-4 text-xs bg-white text-black hover:bg-zinc-200 rounded-xl font-medium"
                >
                  Create Skill
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
