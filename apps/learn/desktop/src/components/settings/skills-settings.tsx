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
  RotateCw,
  MoreHorizontal,
  Trash2,
  PencilSparkles,
  FileText,
  Video,
  Presentation,
  Sigma,
  HelpCircle,
  LayoutTemplate,
  FileCode,
  Code2,
  GraduationCap,
  Wrench,
  PenLine,
  Upload,
  Eye,
  Code,
  Edit3,
  X,
  Check,
  ChevronDown,
  ChevronRight,
  User,
  FolderGit2,
  AlertCircle,
  ArrowLeft,
  Copy,
  Shield,
  ShieldCheck,
  ShieldAlert,
  File,
  Folder,
  Layers,
  Sparkle,
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
  ensureDefaultSkillsSeeded,
  parseSkillMarkdown,
  generateSkillOverview,
  runSecurityScan,
} from "../../lib/skills/skills-service";
import {
  DEFAULT_BUILTIN_SKILLS,
  DEFAULT_BUILTIN_BUNDLES,
} from "../../lib/skills/default-skills";

/**
 * Map icon name to Lucide Icon component
 */
function getSkillIcon(iconName?: string, category?: SkillCategory): React.ElementType {
  switch (iconName) {
    case "PenLine":
      return PenLine;
    case "Sigma":
      return Sigma;
    case "HelpCircle":
    case "Brain":
      return HelpCircle;
    case "Video":
      return Video;
    case "Presentation":
      return Presentation;
    case "LayoutTemplate":
      return LayoutTemplate;
    case "FileText":
      return FileText;
    case "FileCode":
      return FileCode;
    case "Code2":
      return Code2;
    case "GraduationCap":
      return GraduationCap;
    case "Wrench":
      return Wrench;
    case "Layers":
      return Layers;
    case "PencilSparkles":
    case "Sparkles":
      return PencilSparkles;
    default:
      break;
  }

  // Fallback by category
  switch (category) {
    case "writing":
      return PenLine;
    case "math_science":
      return Sigma;
    case "video":
      return Video;
    case "presentation":
      return Presentation;
    case "document":
      return FileText;
    case "design":
      return LayoutTemplate;
    case "education":
      return GraduationCap;
    default:
      return PencilSparkles;
  }
}

export interface SkillsSettingsProps {
  onClose?: () => void;
}

export function SkillsSettings({ onClose }: SkillsSettingsProps = {}) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadDropzoneInputRef = useRef<HTMLInputElement | null>(null);

  // Live Query from Dexie
  const skills = useLiveQuery(() => db.skills.toArray(), [], [] as LocalSkill[]);
  const bundles = useLiveQuery(() => db.skillBundles.toArray(), [], [] as LocalSkillBundle[]);

  // Navigation state
  const [viewMode, setViewMode] = useState<"list" | "bundle-detail" | "skill-detail" | "upload">("list");
  const [selectedBundle, setSelectedBundle] = useState<LocalSkillBundle | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<LocalSkill | null>(null);
  const [originBundle, setOriginBundle] = useState<LocalSkillBundle | null>(null);

  // Detail view state
  const [bundleActiveTab, setBundleActiveTab] = useState<"overview" | "content" | "skills">("overview");
  const [skillActiveTab, setSkillActiveTab] = useState<"overview" | "content">("overview");
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [contentViewMode, setContentViewMode] = useState<"preview" | "code">("preview");

  // List filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedScope, setSelectedScope] = useState<"all" | "user" | "workspace">("user");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [deleteConfirmSkill, setDeleteConfirmSkill] = useState<LocalSkill | null>(null);
  const [isManualCreateOpen, setIsManualCreateOpen] = useState(false);

  // Upload view state (Image 4)
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadSkillName, setUploadSkillName] = useState("");
  const [uploadSkillSlug, setUploadSkillSlug] = useState("");
  const [uploadSkillDescription, setUploadSkillDescription] = useState("");
  const [uploadSkillContent, setUploadSkillContent] = useState("");
  const [uploadSkillOverview, setUploadSkillOverview] = useState("");
  const [uploadCategory, setUploadCategory] = useState<SkillCategory>("custom");
  const [uploadFilesMap, setUploadFilesMap] = useState<Record<string, string>>({});
  const [uploadIsBundle, setUploadIsBundle] = useState(false);
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "passed" | "failed">("idle");
  const [scanMessage, setScanMessage] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  // Manual create form state
  const [manualName, setManualName] = useState("");
  const [manualSlug, setManualSlug] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualContent, setManualContent] = useState("");
  const [manualCategory, setManualCategory] = useState<SkillCategory>("custom");

  // Ensure default skills are present on mount
  useEffect(() => {
    ensureDefaultSkillsSeeded();
  }, []);

  // Update selected bundle / skill when db updates
  useEffect(() => {
    if (selectedBundle) {
      const refreshed = bundles.find((b) => b.id === selectedBundle.id);
      if (refreshed) setSelectedBundle(refreshed);
    }
  }, [bundles]);

  useEffect(() => {
    if (selectedSkill) {
      const refreshed = skills.find((s) => s.id === selectedSkill.id);
      if (refreshed) setSelectedSkill(refreshed);
    }
  }, [skills]);

  // Compute sub-skills for selected bundle
  const bundleSubSkills = useMemo(() => {
    if (!selectedBundle) return [];
    const skillIdSet = new Set(selectedBundle.skillIds || []);
    return skills.filter((s) => skillIdSet.has(s.id) || s.bundleId === selectedBundle.id);
  }, [selectedBundle, skills]);

  // Compute file map for bundle content tab
  const bundleFilesMap = useMemo(() => {
    if (!selectedBundle) return {};
    const files: Record<string, string> = { ...(selectedBundle.files || {}) };
    // Also include sub-skills files
    bundleSubSkills.forEach((subSkill) => {
      const prefix = `skills/${subSkill.name || subSkill.slug}`;
      if (subSkill.files) {
        Object.entries(subSkill.files).forEach(([fName, fContent]) => {
          files[`${prefix}/${fName}`] = fContent;
        });
      } else if (subSkill.content) {
        files[`${prefix}/SKILL.md`] = subSkill.content;
      }
    });
    return files;
  }, [selectedBundle, bundleSubSkills]);

  // Compute file map for skill content tab
  const skillFilesMap = useMemo(() => {
    if (!selectedSkill) return {};
    if (selectedSkill.files && Object.keys(selectedSkill.files).length > 0) {
      return selectedSkill.files;
    }
    return {
      "SKILL.md": selectedSkill.content || `# ${selectedSkill.name}\n\n${selectedSkill.description}`,
    };
  }, [selectedSkill]);

  // Set default selected file when switching to bundle or skill
  useEffect(() => {
    if (viewMode === "bundle-detail" && selectedBundle) {
      const keys = Object.keys(bundleFilesMap);
      if (keys.length > 0 && (!selectedFileName || !bundleFilesMap[selectedFileName])) {
        setSelectedFileName(keys[0]!);
      }
    } else if (viewMode === "skill-detail" && selectedSkill) {
      const keys = Object.keys(skillFilesMap);
      if (keys.length > 0 && (!selectedFileName || !skillFilesMap[selectedFileName])) {
        setSelectedFileName(keys[0]!);
      }
    }
  }, [viewMode, selectedBundle, selectedSkill, bundleFilesMap, skillFilesMap]);

  // Filter skills and bundles for the list view
  const filteredBundles = useMemo(() => {
    return bundles.filter((bundle) => {
      if (selectedScope === "user" && bundle.scope === "workspace") return false;
      if (selectedScope === "workspace" && bundle.scope !== "workspace") return false;
      if (selectedCategory !== "all" && bundle.category !== selectedCategory) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = bundle.name.toLowerCase().includes(q);
        const matchesSlug = bundle.slug.toLowerCase().includes(q);
        const matchesDesc = bundle.description.toLowerCase().includes(q);
        const matchesAuthor = bundle.author?.toLowerCase().includes(q);
        return matchesName || matchesSlug || matchesDesc || matchesAuthor;
      }
      return true;
    });
  }, [bundles, selectedScope, selectedCategory, searchQuery]);

  const filteredStandaloneSkills = useMemo(() => {
    return skills.filter((skill) => {
      // Exclude skills that belong to an existing bundle in main list
      if (skill.bundleId) return false;

      if (selectedScope === "user" && skill.scope === "workspace") return false;
      if (selectedScope === "workspace" && skill.scope !== "workspace") return false;
      if (selectedCategory !== "all" && skill.category !== selectedCategory) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = skill.name.toLowerCase().includes(q);
        const matchesSlug = skill.slug.toLowerCase().includes(q);
        const matchesDesc = skill.description.toLowerCase().includes(q);
        const matchesAuthor = skill.author?.toLowerCase().includes(q);
        return matchesName || matchesSlug || matchesDesc || matchesAuthor;
      }
      return true;
    });
  }, [skills, selectedScope, selectedCategory, searchQuery]);

  // Handlers for toggles
  const handleToggleSkill = async (id: string, isEnabled: boolean) => {
    try {
      await localDb.toggleSkill(id, isEnabled);
      toast.success(isEnabled ? t("skillEnabled") : t("skillDisabled"));
    } catch (err: any) {
      toast.error(err?.message || "Failed to toggle skill");
    }
  };

  const handleToggleBundle = async (id: string, isEnabled: boolean) => {
    try {
      await localDb.toggleSkillBundle(id, isEnabled);
      toast.success(isEnabled ? t("skillEnabled") : t("skillDisabled"));
    } catch (err: any) {
      toast.error(err?.message || "Failed to toggle bundle");
    }
  };

  const handleResetToDefault = async () => {
    try {
      await db.skillBundles.clear();
      await db.skills.clear();
      await db.skillBundles.bulkPut(DEFAULT_BUILTIN_BUNDLES);
      await db.skills.bulkPut(DEFAULT_BUILTIN_SKILLS);
      toast.success(t("skillsResetSuccess"));
    } catch (err: any) {
      toast.error(err?.message || "Failed to reset skills");
    }
  };

  // Upload & File handling for Image 4
  const processUploadedFile = async (file: File) => {
    setUploadFile(file);
    setScanStatus("scanning");
    setScanMessage(t("scanScanning"));

    try {
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith(".zip")) {
        // Handle ZIP file using JSZip
        const zip = await JSZip.loadAsync(file);
        const filesMap: Record<string, string> = {};
        let combinedContent = "";
        let mainSkillMd = "";

        const zipEntries = Object.keys(zip.files);
        for (const relativePath of zipEntries) {
          const entry = zip.files[relativePath];
          if (!entry || entry.dir) continue;
          const text = await entry.async("text");
          filesMap[relativePath] = text;
          combinedContent += text + "\n";
          if (relativePath.endsWith("SKILL.md") || relativePath.toLowerCase().includes("skill.md")) {
            mainSkillMd = text;
          }
        }

        const scanResult = runSecurityScan(combinedContent, file.name);
        if (!scanResult.passed) {
          setScanStatus("failed");
          setScanMessage(scanResult.message);
          toast.error(scanResult.message);
          return;
        }

        const parsed = parseSkillMarkdown(mainSkillMd || combinedContent.slice(0, 2000));
        const baseName = file.name.replace(/\.zip$/i, "");
        const name = parsed.name !== "Untitled Skill" ? parsed.name : baseName;
        const slug = parsed.slug || baseName.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
        const desc = parsed.description || "Uploaded agent skills bundle.";
        const overview = generateSkillOverview(name, slug, combinedContent, desc);

        setUploadSkillName(name);
        setUploadSkillSlug(slug);
        setUploadSkillDescription(desc);
        setUploadSkillContent(mainSkillMd || combinedContent);
        setUploadSkillOverview(overview);
        setUploadFilesMap(filesMap);
        setUploadIsBundle(true);
        setScanStatus("passed");
        setScanMessage(scanResult.message);
      } else {
        // Handle .md / text file
        const text = await file.text();
        const scanResult = runSecurityScan(text, file.name);
        if (!scanResult.passed) {
          setScanStatus("failed");
          setScanMessage(scanResult.message);
          toast.error(scanResult.message);
          return;
        }

        const parsed = parseSkillMarkdown(text);
        const overview = generateSkillOverview(parsed.name, parsed.slug, parsed.content, parsed.description);

        setUploadSkillName(parsed.name);
        setUploadSkillSlug(parsed.slug);
        setUploadSkillDescription(parsed.description);
        setUploadSkillContent(parsed.content);
        setUploadSkillOverview(overview);
        setUploadFilesMap({ "SKILL.md": parsed.content });
        setUploadIsBundle(false);
        setScanStatus("passed");
        setScanMessage(scanResult.message);
      }
    } catch (err: any) {
      setScanStatus("failed");
      setScanMessage(err?.message || "Failed to parse uploaded file");
      toast.error("Failed to parse file: " + (err?.message || ""));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  const handleUploadSubmit = async () => {
    if (!uploadSkillName.trim() || !uploadSkillSlug.trim()) {
      toast.error("Skill name and slug required");
      return;
    }
    if (scanStatus !== "passed") {
      toast.error("File must pass security scan before uploading");
      return;
    }

    try {
      const cleanSlug = uploadSkillSlug
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

      if (uploadIsBundle) {
        // Create bundle and its sub-skills
        const bundleId = "bundle_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
        const subSkillIds: string[] = [];

        // Save bundle
        await localDb.createSkillBundle({
          id: bundleId,
          slug: cleanSlug,
          name: uploadSkillName.trim(),
          description: uploadSkillDescription.trim(),
          overview: uploadSkillOverview,
          author: "User",
          version: "1.0.0",
          updatedAtText: "Just now",
          icon: "Layers",
          category: uploadCategory,
          isBuiltIn: false,
          isEnabled: true,
          scope: "user",
          files: uploadFilesMap,
          skillIds: subSkillIds,
        });

        toast.success(t("skillAddedSuccess", { name: uploadSkillName }));
      } else {
        // Save single skill
        await localDb.createSkill({
          name: uploadSkillName.trim(),
          slug: cleanSlug,
          description: uploadSkillDescription.trim() || "Custom agent skill.",
          content: uploadSkillContent.trim(),
          overview: uploadSkillOverview,
          author: "User",
          version: "1.0.0",
          updatedAtText: "Just now",
          files: uploadFilesMap,
          category: uploadCategory,
          icon: "PencilSparkles",
          isBuiltIn: false,
          isEnabled: true,
          scope: "user",
        });

        toast.success(t("skillAddedSuccess", { name: uploadSkillName }));
      }

      // Reset & go back to list
      setUploadFile(null);
      setScanStatus("idle");
      setViewMode("list");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save skill");
    }
  };

  const handleManualSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualSlug.trim()) {
      toast.error("Name and slug required");
      return;
    }

    try {
      const cleanSlug = manualSlug
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-")
        .replace(/-+/g, "-");
      const overview = generateSkillOverview(manualName, cleanSlug, manualContent, manualDescription);

      await localDb.createSkill({
        name: manualName.trim(),
        slug: cleanSlug,
        description: manualDescription.trim() || "Custom agent skill.",
        content: manualContent.trim() || `# ${manualName}\n\n${manualDescription}`,
        overview,
        author: "User",
        version: "1.0.0",
        updatedAtText: "Just now",
        category: manualCategory,
        icon: "PencilSparkles",
        isBuiltIn: false,
        isEnabled: true,
        scope: "user",
        files: { "SKILL.md": manualContent },
      });

      toast.success(t("skillAddedSuccess", { name: manualName }));
      setIsManualCreateOpen(false);
      setManualName("");
      setManualSlug("");
      setManualDescription("");
      setManualContent("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to create skill");
    }
  };

  const handleCopyContent = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t("contentCopied"));
  };

  // ---------------------------------------------------------------------------
  // RENDER: VIEW 4 — UPLOAD A SKILL (Image 4)
  // ---------------------------------------------------------------------------
  if (viewMode === "upload") {
    return (
      <div className="flex-1 h-full flex flex-col min-h-0 bg-[#ffffff] dark:bg-[#161616] text-[#262626] dark:text-[#d4d4d4] select-none">
        {/* Top Back Navigation Bar */}
        <div className="px-6 pt-5 pb-3 shrink-0 flex items-center justify-between border-b border-[#dedee2] dark:border-[#2e2e2e]">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#737373] dark:text-[#969696] hover:text-[#161616] dark:hover:text-white transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>{t("backToSkills")}</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-[#737373] hover:text-[#161616] dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Upload Container Body */}
        <ScrollArea className="flex-1 p-6">
          <div className="max-w-2xl mx-auto flex flex-col gap-6">
            {/* Header Titles */}
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#161616] dark:text-white">
                {t("uploadSkillTitle")}
              </h2>
              <p className="text-xs text-[#737373] dark:text-[#969696] mt-1 leading-relaxed">
                {t("uploadSkillSubtitle")}
              </p>
            </div>

            {/* Hidden File Input */}
            <input
              type="file"
              ref={uploadDropzoneInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) processUploadedFile(file);
                e.target.value = "";
              }}
              accept=".md,.markdown,.zip,text/markdown"
              className="hidden"
            />

            {/* Large Dashed Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => uploadDropzoneInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3",
                isDragOver
                  ? "border-[#0066ff] bg-[#0066ff]/5"
                  : "border-[#dedee2] dark:border-[#383838] hover:border-[#0066ff] dark:hover:border-[#0066ff] bg-[#f8f8fa] dark:bg-[#1a1a1a]"
              )}
            >
              <div className="w-12 h-12 rounded-full bg-[#ebebed] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838] flex items-center justify-center text-[#737373] dark:text-[#d4d4d4] mb-1">
                <Upload className="w-6 h-6 stroke-[1.8]" />
              </div>

              <div>
                <span className="text-sm font-semibold text-[#161616] dark:text-white block">
                  {t("dragAndDropFiles")}
                </span>
                <span className="text-xs text-[#737373] dark:text-[#969696] block mt-1">
                  {uploadFile ? (
                    <span className="font-medium text-[#0066ff] dark:text-blue-400">
                      Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                    </span>
                  ) : (
                    "Supports single markdown or bundled archive"
                  )}
                </span>
              </div>

              {/* Supported formats bullet points */}
              <div className="flex flex-col items-start text-left text-xs text-[#737373] dark:text-[#969696] gap-1.5 mt-2 bg-[#ffffff] dark:bg-[#222222] p-3 rounded-xl border border-[#dedee2] dark:border-[#2e2e2e] w-full max-w-md">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#737373] dark:bg-[#969696]" />
                  <span>{t("uploadMdSupport")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#737373] dark:bg-[#969696]" />
                  <span>{t("uploadZipSupport")}</span>
                </div>
              </div>
            </div>

            {/* Security Scan Card (Image 4) */}
            <div className="p-4 rounded-2xl bg-[#f8f8fa] dark:bg-[#1a1a1a] border border-[#dedee2] dark:border-[#2e2e2e] flex items-start gap-3.5">
              <div className="mt-0.5 shrink-0">
                {scanStatus === "passed" ? (
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                ) : scanStatus === "failed" ? (
                  <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-[#ebebed] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838] text-[#737373] dark:text-[#969696] flex items-center justify-center">
                    <Shield className="w-4 h-4" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#161616] dark:text-white">
                    {t("securityScanTitle")}
                  </span>
                  <span
                    className={cn(
                      "text-[11px] font-medium px-2 py-0.5 rounded-md",
                      scanStatus === "passed"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : scanStatus === "failed"
                        ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                        : scanStatus === "scanning"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse"
                        : "bg-[#ebebed] dark:bg-[#2b2b2b] text-[#737373] dark:text-[#969696] border border-[#dedee2] dark:border-[#383838]"
                    )}
                  >
                    {scanStatus === "passed"
                      ? t("securityScanPassed")
                      : scanStatus === "scanning"
                      ? t("scanScanning")
                      : scanStatus === "failed"
                      ? t("scanFailed")
                      : t("securityScanRunsOnUpload")}
                  </span>
                </div>

                <p className="text-xs text-[#737373] dark:text-[#969696] mt-1 leading-relaxed">
                  {scanStatus === "passed" ? scanMessage : t("securityScanDesc")}
                </p>
              </div>
            </div>

            {/* AI Generated Overview Box */}
            {uploadFile && scanStatus === "passed" && (
              <div className="flex flex-col gap-3 p-4 rounded-2xl bg-[#f8f8fa] dark:bg-[#1a1a1a] border border-[#dedee2] dark:border-[#2e2e2e]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PencilSparkles className="w-3.5 h-3.5 text-[#0066ff]" />
                    <span className="text-xs font-semibold text-[#161616] dark:text-white">
                      AI Overview & Configuration
                    </span>
                  </div>
                  <span className="text-[10px] text-[#737373] dark:text-[#5d5d5d]">
                    Auto-generated from content
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-[#737373] dark:text-[#969696]">
                      {t("skillName")}
                    </label>
                    <input
                      type="text"
                      value={uploadSkillName}
                      onChange={(e) => setUploadSkillName(e.target.value)}
                      className="w-full h-8 px-2.5 text-xs bg-[#ffffff] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] rounded-xl text-[#161616] dark:text-white focus:outline-none focus:border-[#0066ff]"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-[#737373] dark:text-[#969696]">
                      {t("skillSlug")}
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-2.5 text-xs text-[#737373] dark:text-[#969696] font-mono">
                        /
                      </span>
                      <input
                        type="text"
                        value={uploadSkillSlug}
                        onChange={(e) => setUploadSkillSlug(e.target.value)}
                        className="w-full h-8 pl-6 pr-2.5 text-xs font-mono bg-[#ffffff] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] rounded-xl text-[#161616] dark:text-white focus:outline-none focus:border-[#0066ff]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-[#737373] dark:text-[#969696]">
                    {t("skillDescription")}
                  </label>
                  <input
                    type="text"
                    value={uploadSkillDescription}
                    onChange={(e) => setUploadSkillDescription(e.target.value)}
                    className="w-full h-8 px-2.5 text-xs bg-[#ffffff] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] rounded-xl text-[#161616] dark:text-white focus:outline-none focus:border-[#0066ff]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-[#737373] dark:text-[#969696]">
                    Overview (Written by AI)
                  </label>
                  <textarea
                    rows={4}
                    value={uploadSkillOverview}
                    onChange={(e) => setUploadSkillOverview(e.target.value)}
                    className="w-full p-2.5 text-xs bg-[#ffffff] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] rounded-xl text-[#161616] dark:text-white focus:outline-none focus:border-[#0066ff] resize-y leading-relaxed font-sans"
                  />
                </div>
              </div>
            )}

            {/* Bottom Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className="px-4 py-2 rounded-xl border border-[#dedee2] dark:border-[#383838] text-xs font-medium text-[#737373] dark:text-[#d4d4d4] hover:bg-[#f0f0f2] dark:hover:bg-[#2b2b2b] transition-colors cursor-pointer"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleUploadSubmit}
                disabled={!uploadFile || scanStatus !== "passed"}
                className="px-5 py-2 rounded-xl bg-[#161616] dark:bg-white text-white dark:text-[#161616] hover:bg-[#2b2b2b] dark:hover:bg-[#e2e2e5] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                {t("uploadBtn")}
              </button>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: VIEW 1 & 3 — BUNDLE DETAIL (Image 1 & Image 3)
  // ---------------------------------------------------------------------------
  if (viewMode === "bundle-detail" && selectedBundle) {
    const Icon = getSkillIcon(selectedBundle.icon, selectedBundle.category);
    const activeFileContent = bundleFilesMap[selectedFileName] || "";

    return (
      <div className="flex-1 h-full flex flex-col min-h-0 bg-[#ffffff] dark:bg-[#161616] text-[#262626] dark:text-[#d4d4d4] select-none">
        {/* Top Back Navigation Bar */}
        <div className="px-6 pt-5 pb-3 shrink-0 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#737373] dark:text-[#969696] hover:text-[#161616] dark:hover:text-white transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>{t("backToSkills")}</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-[#737373] hover:text-[#161616] dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Bundle Header Strip (Image 1) */}
        <div className="px-6 pb-4 shrink-0 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Icon */}
            <div className="w-12 h-12 rounded-2xl bg-[#f4f4f6] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] flex items-center justify-center text-[#161616] dark:text-white shrink-0 shadow-xs">
              <Icon className="w-6 h-6 stroke-[1.8]" />
            </div>

            <div className="flex flex-col min-w-0">
              <h2 className="text-xl font-semibold tracking-tight text-[#161616] dark:text-white truncate">
                {selectedBundle.name}
              </h2>
              {/* Meta row: Author · Version · Skills Count · Updated */}
              <div className="flex items-center gap-2 text-xs text-[#737373] dark:text-[#969696] mt-0.5 flex-wrap">
                {selectedBundle.author && <span>{selectedBundle.author}</span>}
                {selectedBundle.version && (
                  <>
                    <span>·</span>
                    <span>{selectedBundle.version}</span>
                  </>
                )}
                <span>·</span>
                <span>{bundleSubSkills.length} skills</span>
                {selectedBundle.updatedAtText && (
                  <>
                    <span>·</span>
                    <span>Updated {selectedBundle.updatedAtText}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action button: Add / Enabled */}
          <div className="shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleToggleBundle(selectedBundle.id, !selectedBundle.isEnabled)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs",
                selectedBundle.isEnabled
                  ? "bg-[#ebebed] dark:bg-[#2b2b2b] text-[#161616] dark:text-white border border-[#dedee2] dark:border-[#383838]"
                  : "bg-[#161616] dark:bg-white text-white dark:text-[#161616] hover:bg-[#2b2b2b] dark:hover:bg-[#e2e2e5]"
              )}
            >
              {selectedBundle.isEnabled ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Enabled</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3 Tabs Row (Overview, Content, Skills · N) — Explicitly NO connectors */}
        <div className="px-6 shrink-0 border-b border-[#dedee2] dark:border-[#2e2e2e] flex items-center gap-6 text-xs font-medium">
          <button
            type="button"
            onClick={() => setBundleActiveTab("overview")}
            className={cn(
              "pb-2.5 transition-colors cursor-pointer border-b-2 -mb-[1px]",
              bundleActiveTab === "overview"
                ? "border-[#161616] dark:border-white text-[#161616] dark:text-white font-semibold"
                : "border-transparent text-[#737373] dark:text-[#969696] hover:text-[#161616] dark:hover:text-white"
            )}
          >
            {t("tabOverview")}
          </button>
          <button
            type="button"
            onClick={() => setBundleActiveTab("content")}
            className={cn(
              "pb-2.5 transition-colors cursor-pointer border-b-2 -mb-[1px]",
              bundleActiveTab === "content"
                ? "border-[#161616] dark:border-white text-[#161616] dark:text-white font-semibold"
                : "border-transparent text-[#737373] dark:text-[#969696] hover:text-[#161616] dark:hover:text-white"
            )}
          >
            {t("tabContent")}
          </button>
          <button
            type="button"
            onClick={() => setBundleActiveTab("skills")}
            className={cn(
              "pb-2.5 transition-colors cursor-pointer border-b-2 -mb-[1px]",
              bundleActiveTab === "skills"
                ? "border-[#161616] dark:border-white text-[#161616] dark:text-white font-semibold"
                : "border-transparent text-[#737373] dark:text-[#969696] hover:text-[#161616] dark:hover:text-white"
            )}
          >
            {t("tabSkills")} · {bundleSubSkills.length}
          </button>
        </div>

        {/* Tab 1: OVERVIEW */}
        {bundleActiveTab === "overview" && (
          <ScrollArea className="flex-1 p-6">
            <div className="max-w-3xl flex flex-col gap-6">
              <div
                className="prose dark:prose-invert max-w-none text-xs leading-relaxed select-text [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h2]:text-xs [&_h2]:font-semibold [&_h2]:mt-2.5 [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_code]:font-mono [&_code]:text-[11px] [&_code]:bg-[#ebebed] dark:[&_code]:bg-[#2a2a2a] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded-md [&_strong]:text-[#161616] dark:[&_strong]:text-white"
                dangerouslySetInnerHTML={{
                  __html: marked.parse(selectedBundle.overview || selectedBundle.description) as string,
                }}
              />

              {/* Skills included list (Image 1) */}
              <div className="flex flex-col gap-2 pt-2">
                <span className="text-xs font-semibold text-[#161616] dark:text-white uppercase tracking-wider">
                  Included Skills ({bundleSubSkills.length})
                </span>
                <div className="flex flex-col divide-y divide-[#dedee2]/60 dark:divide-[#2e2e2e]/60 border border-[#dedee2] dark:border-[#2e2e2e] rounded-2xl bg-[#ffffff] dark:bg-[#1a1a1a] overflow-hidden">
                  {bundleSubSkills.map((sub) => (
                    <div
                      key={sub.id}
                      onClick={() => {
                        setSelectedSkill(sub);
                        setOriginBundle(selectedBundle);
                        setViewMode("skill-detail");
                      }}
                      className="p-3.5 hover:bg-[#f8f8fa] dark:hover:bg-[#222222]/60 transition-colors cursor-pointer flex items-start gap-3 group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-[#f4f4f6] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] flex items-center justify-center text-[#737373] dark:text-[#d4d4d4] shrink-0 mt-0.5 group-hover:border-[#0066ff]/40 transition-colors">
                        <FileCode className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#161616] dark:text-white">
                            {sub.name}
                          </span>
                          <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-md bg-[#ebebed] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838] text-[#555555] dark:text-[#a0a0a0]">
                            /{sub.slug}
                          </span>
                        </div>
                        <p className="text-xs text-[#737373] dark:text-[#969696] line-clamp-2 mt-0.5 leading-relaxed">
                          {sub.description}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#737373] dark:text-[#5d5d5d] shrink-0 mt-2 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        )}

        {/* Tab 2: CONTENT (Split Pane - Image 3) */}
        {bundleActiveTab === "content" && (
          <div className="flex-1 min-h-0 flex overflow-hidden">
            {/* Left File Tree Sidebar */}
            <div className="w-56 shrink-0 border-r border-[#dedee2] dark:border-[#2e2e2e] bg-[#f8f8fa] dark:bg-[#1a1a1a] flex flex-col">
              <div className="px-3.5 py-2.5 border-b border-[#dedee2] dark:border-[#2e2e2e] text-[11px] font-semibold text-[#737373] dark:text-[#969696] uppercase tracking-wider">
                Files ({Object.keys(bundleFilesMap).length})
              </div>
              <ScrollArea className="flex-1 p-2">
                <div className="flex flex-col gap-0.5">
                  {Object.keys(bundleFilesMap).map((fileName) => {
                    const isSelected = selectedFileName === fileName;
                    return (
                      <button
                        key={fileName}
                        type="button"
                        onClick={() => setSelectedFileName(fileName)}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center gap-2 transition-colors cursor-pointer truncate",
                          isSelected
                            ? "bg-[#161616] dark:bg-white text-white dark:text-[#161616] font-medium"
                            : "text-[#737373] dark:text-[#d4d4d4] hover:bg-[#ebebed] dark:hover:bg-[#252525]"
                        )}
                      >
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{fileName}</span>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Right Content Viewer */}
            <div className="flex-1 min-w-0 flex flex-col bg-[#ffffff] dark:bg-[#161616]">
              {/* File header bar */}
              <div className="px-4 py-2.5 border-b border-[#dedee2] dark:border-[#2e2e2e] flex items-center justify-between gap-3">
                <span className="text-xs font-mono font-medium text-[#161616] dark:text-white truncate">
                  /{selectedFileName}
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Preview / Code Toggle */}
                  <div className="flex items-center rounded-lg bg-[#f4f4f6] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] p-0.5">
                    <button
                      type="button"
                      onClick={() => setContentViewMode("preview")}
                      className={cn(
                        "p-1 rounded-md text-xs transition-colors cursor-pointer flex items-center gap-1 px-2",
                        contentViewMode === "preview"
                          ? "bg-[#ffffff] dark:bg-[#161616] text-[#161616] dark:text-white shadow-2xs font-medium"
                          : "text-[#737373] hover:text-[#161616] dark:hover:text-white"
                      )}
                      title="Preview"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="text-[11px]">{t("previewMode")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setContentViewMode("code")}
                      className={cn(
                        "p-1 rounded-md text-xs transition-colors cursor-pointer flex items-center gap-1 px-2",
                        contentViewMode === "code"
                          ? "bg-[#ffffff] dark:bg-[#161616] text-[#161616] dark:text-white shadow-2xs font-medium"
                          : "text-[#737373] hover:text-[#161616] dark:hover:text-white"
                      )}
                      title="Raw Code"
                    >
                      <Code className="w-3.5 h-3.5" />
                      <span className="text-[11px]">{t("rawCodeMode")}</span>
                    </button>
                  </div>

                  {/* Copy button */}
                  <button
                    type="button"
                    onClick={() => handleCopyContent(activeFileContent)}
                    className="p-1.5 rounded-lg border border-[#dedee2] dark:border-[#383838] bg-[#f4f4f6] dark:bg-[#222222] hover:bg-[#e9e9ec] dark:hover:bg-[#2b2b2b] text-[#737373] dark:text-[#d4d4d4] hover:text-[#161616] dark:hover:text-white transition-colors cursor-pointer"
                    title={t("copyCode")}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Viewer body */}
              <ScrollArea className="flex-1 p-5">
                {contentViewMode === "preview" ? (
                  <div
                    className="prose dark:prose-invert max-w-none text-xs leading-relaxed select-text [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_pre]:p-3 [&_pre]:bg-[#f4f4f6] dark:[&_pre]:bg-[#202020] [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-[#dedee2] dark:[&_pre]:border-[#2e2e2e] [&_pre]:overflow-x-auto [&_code]:font-mono [&_code]:text-[11px] [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-[#dedee2] dark:[&_th]:border-[#383838] [&_th]:p-1.5 [&_th]:bg-[#f4f4f6] dark:[&_th]:bg-[#222222] [&_td]:border [&_td]:border-[#dedee2] dark:[&_td]:border-[#383838] [&_td]:p-1.5"
                    dangerouslySetInnerHTML={{ __html: marked.parse(activeFileContent) as string }}
                  />
                ) : (
                  <pre className="p-4 text-xs font-mono text-[#161616] dark:text-[#d4d4d4] bg-[#f8f8fa] dark:bg-[#1a1a1a] rounded-xl border border-[#dedee2] dark:border-[#2e2e2e] overflow-x-auto whitespace-pre-wrap leading-relaxed select-text">
                    {activeFileContent}
                  </pre>
                )}
              </ScrollArea>
            </div>
          </div>
        )}

        {/* Tab 3: SKILLS (Image 1) */}
        {bundleActiveTab === "skills" && (
          <ScrollArea className="flex-1 p-6">
            <div className="max-w-3xl flex flex-col gap-3">
              <span className="text-xs font-semibold text-[#161616] dark:text-white uppercase tracking-wider">
                Skills in this bundle ({bundleSubSkills.length})
              </span>
              <div className="flex flex-col divide-y divide-[#dedee2]/60 dark:divide-[#2e2e2e]/60 border border-[#dedee2] dark:border-[#2e2e2e] rounded-2xl bg-[#ffffff] dark:bg-[#1a1a1a] overflow-hidden shadow-xs">
                {bundleSubSkills.map((sub) => (
                  <div
                    key={sub.id}
                    onClick={() => {
                      setSelectedSkill(sub);
                      setOriginBundle(selectedBundle);
                      setViewMode("skill-detail");
                    }}
                    className="p-3.5 hover:bg-[#f8f8fa] dark:hover:bg-[#222222]/60 transition-colors cursor-pointer flex items-start gap-3.5 group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#f4f4f6] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] flex items-center justify-center text-[#737373] dark:text-[#d4d4d4] shrink-0 mt-0.5 group-hover:border-[#0066ff]/40 transition-colors">
                      <FileCode className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-[#161616] dark:text-white">
                          {sub.name}
                        </span>
                        <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-md bg-[#ebebed] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838] text-[#555555] dark:text-[#a0a0a0]">
                          /{sub.slug}
                        </span>
                      </div>
                      <p className="text-xs text-[#737373] dark:text-[#969696] line-clamp-2 mt-0.5 leading-relaxed">
                        {sub.description}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#737373] dark:text-[#5d5d5d] shrink-0 mt-2 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: VIEW 2 — SINGLE SKILL DETAIL (Image 2)
  // ---------------------------------------------------------------------------
  if (viewMode === "skill-detail" && selectedSkill) {
    const Icon = getSkillIcon(selectedSkill.icon, selectedSkill.category);
    const activeFileContent = skillFilesMap[selectedFileName] || selectedSkill.content || "";
    const filesList = Object.keys(skillFilesMap);

    return (
      <div className="flex-1 h-full flex flex-col min-h-0 bg-[#ffffff] dark:bg-[#161616] text-[#262626] dark:text-[#d4d4d4] select-none">
        {/* Top Back Navigation Bar */}
        <div className="px-6 pt-5 pb-3 shrink-0 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (originBundle) {
                setSelectedBundle(originBundle);
                setViewMode("bundle-detail");
              } else {
                setViewMode("list");
              }
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#737373] dark:text-[#969696] hover:text-[#161616] dark:hover:text-white transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>{originBundle ? originBundle.name : t("backToSkills")}</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-[#737373] hover:text-[#161616] dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Skill Header Strip (Image 2) */}
        <div className="px-6 pb-4 shrink-0 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-[#f4f4f6] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] flex items-center justify-center text-[#161616] dark:text-white shrink-0 shadow-xs">
              <Icon className="w-6 h-6 stroke-[1.8]" />
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight text-[#161616] dark:text-white truncate">
                  {selectedSkill.name}
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#ebebed] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838] text-[#555555] dark:text-[#a0a0a0]">
                  /{selectedSkill.slug}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#737373] dark:text-[#969696] mt-0.5 flex-wrap">
                {selectedSkill.author && <span>{selectedSkill.author}</span>}
                {selectedSkill.version && (
                  <>
                    <span>·</span>
                    <span>{selectedSkill.version}</span>
                  </>
                )}
                {selectedSkill.updatedAtText && (
                  <>
                    <span>·</span>
                    <span>Updated {selectedSkill.updatedAtText}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action button: Enabled Switch */}
          <div className="shrink-0 flex items-center gap-3">
            <span className="text-xs text-[#737373] dark:text-[#969696]">
              {selectedSkill.isEnabled ? "Enabled" : "Disabled"}
            </span>
            <Switch
              checked={selectedSkill.isEnabled}
              onCheckedChange={(checked) => handleToggleSkill(selectedSkill.id, checked)}
              className="data-[state=checked]:bg-[#161616] dark:data-[state=checked]:bg-white data-[state=unchecked]:bg-[#dedee2] dark:data-[state=unchecked]:bg-[#383838]"
            />
          </div>
        </div>

        {/* 2 Tabs Row (Overview, Content · N) — exactly 2 tabs for single skill! */}
        <div className="px-6 shrink-0 border-b border-[#dedee2] dark:border-[#2e2e2e] flex items-center gap-6 text-xs font-medium">
          <button
            type="button"
            onClick={() => setSkillActiveTab("overview")}
            className={cn(
              "pb-2.5 transition-colors cursor-pointer border-b-2 -mb-[1px]",
              skillActiveTab === "overview"
                ? "border-[#161616] dark:border-white text-[#161616] dark:text-white font-semibold"
                : "border-transparent text-[#737373] dark:text-[#969696] hover:text-[#161616] dark:hover:text-white"
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
                ? "border-[#161616] dark:border-white text-[#161616] dark:text-white font-semibold"
                : "border-transparent text-[#737373] dark:text-[#969696] hover:text-[#161616] dark:hover:text-white"
            )}
          >
            {t("tabContent")} · {filesList.length}
          </button>
        </div>

        {/* Tab 1: OVERVIEW */}
        {skillActiveTab === "overview" && (
          <ScrollArea className="flex-1 p-6">
            <div className="max-w-3xl flex flex-col gap-6">
              <div>
                <span className="text-xs font-semibold text-[#161616] dark:text-white uppercase tracking-wider block mb-2">
                  {t("skillDescription")}
                </span>
                <p className="text-xs text-[#555555] dark:text-[#b0b0b0] leading-relaxed">
                  {selectedSkill.description}
                </p>
              </div>

              {selectedSkill.overview && (
                <div>
                  <span className="text-xs font-semibold text-[#161616] dark:text-white uppercase tracking-wider block mb-2">
                    {t("tabOverview")}
                  </span>
                  <div
                    className="prose dark:prose-invert max-w-none text-xs leading-relaxed select-text [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-4 [&_code]:font-mono [&_code]:text-[11px]"
                    dangerouslySetInnerHTML={{ __html: marked.parse(selectedSkill.overview) as string }}
                  />
                </div>
              )}

              {/* Slash Command Usage card */}
              <div className="p-4 rounded-2xl bg-[#f8f8fa] dark:bg-[#1a1a1a] border border-[#dedee2] dark:border-[#2e2e2e] flex flex-col gap-2">
                <span className="text-xs font-semibold text-[#161616] dark:text-white">
                  {t("slashCommandSkills")}
                </span>
                <p className="text-xs text-[#737373] dark:text-[#969696] leading-relaxed">
                  Trigger this skill manually by starting your message with{" "}
                  <code className="font-mono text-[#161616] dark:text-white px-1.5 py-0.5 rounded-md bg-[#ebebed] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838]">
                    /{selectedSkill.slug}
                  </code>
                  , or let Const AI autonomously choose and apply it when relevant to your study request.
                </p>
              </div>
            </div>
          </ScrollArea>
        )}

        {/* Tab 2: CONTENT (Split Pane - Image 2) */}
        {skillActiveTab === "content" && (
          <div className="flex-1 min-h-0 flex overflow-hidden">
            {/* Left File Tree Sidebar */}
            <div className="w-52 shrink-0 border-r border-[#dedee2] dark:border-[#2e2e2e] bg-[#f8f8fa] dark:bg-[#1a1a1a] flex flex-col">
              <div className="px-3.5 py-2.5 border-b border-[#dedee2] dark:border-[#2e2e2e] text-[11px] font-semibold text-[#737373] dark:text-[#969696] uppercase tracking-wider">
                Files ({filesList.length})
              </div>
              <ScrollArea className="flex-1 p-2">
                <div className="flex flex-col gap-0.5">
                  {filesList.map((fileName) => {
                    const isSelected = selectedFileName === fileName;
                    return (
                      <button
                        key={fileName}
                        type="button"
                        onClick={() => setSelectedFileName(fileName)}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center gap-2 transition-colors cursor-pointer truncate",
                          isSelected
                            ? "bg-[#161616] dark:bg-white text-white dark:text-[#161616] font-medium"
                            : "text-[#737373] dark:text-[#d4d4d4] hover:bg-[#ebebed] dark:hover:bg-[#252525]"
                        )}
                      >
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{fileName}</span>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Right Content Viewer */}
            <div className="flex-1 min-w-0 flex flex-col bg-[#ffffff] dark:bg-[#161616]">
              {/* Header bar */}
              <div className="px-4 py-2.5 border-b border-[#dedee2] dark:border-[#2e2e2e] flex items-center justify-between gap-3">
                <span className="text-xs font-mono font-medium text-[#161616] dark:text-white truncate">
                  /{selectedFileName || "SKILL.md"}
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex items-center rounded-lg bg-[#f4f4f6] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] p-0.5">
                    <button
                      type="button"
                      onClick={() => setContentViewMode("preview")}
                      className={cn(
                        "p-1 rounded-md text-xs transition-colors cursor-pointer flex items-center gap-1 px-2",
                        contentViewMode === "preview"
                          ? "bg-[#ffffff] dark:bg-[#161616] text-[#161616] dark:text-white shadow-2xs font-medium"
                          : "text-[#737373] hover:text-[#161616] dark:hover:text-white"
                      )}
                      title="Preview"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="text-[11px]">{t("previewMode")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setContentViewMode("code")}
                      className={cn(
                        "p-1 rounded-md text-xs transition-colors cursor-pointer flex items-center gap-1 px-2",
                        contentViewMode === "code"
                          ? "bg-[#ffffff] dark:bg-[#161616] text-[#161616] dark:text-white shadow-2xs font-medium"
                          : "text-[#737373] hover:text-[#161616] dark:hover:text-white"
                      )}
                      title="Raw Code"
                    >
                      <Code className="w-3.5 h-3.5" />
                      <span className="text-[11px]">{t("rawCodeMode")}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyContent(activeFileContent)}
                    className="p-1.5 rounded-lg border border-[#dedee2] dark:border-[#383838] bg-[#f4f4f6] dark:bg-[#222222] hover:bg-[#e9e9ec] dark:hover:bg-[#2b2b2b] text-[#737373] dark:text-[#d4d4d4] hover:text-[#161616] dark:hover:text-white transition-colors cursor-pointer"
                    title={t("copyCode")}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Viewer body */}
              <ScrollArea className="flex-1 p-5">
                {contentViewMode === "preview" ? (
                  <div
                    className="prose dark:prose-invert max-w-none text-xs leading-relaxed select-text [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_pre]:p-3 [&_pre]:bg-[#f4f4f6] dark:[&_pre]:bg-[#202020] [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-[#dedee2] dark:[&_pre]:border-[#2e2e2e] [&_pre]:overflow-x-auto [&_code]:font-mono [&_code]:text-[11px] [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-[#dedee2] dark:[&_th]:border-[#383838] [&_th]:p-1.5 [&_th]:bg-[#f4f4f6] dark:[&_th]:bg-[#222222] [&_td]:border [&_td]:border-[#dedee2] dark:[&_td]:border-[#383838] [&_td]:p-1.5"
                    dangerouslySetInnerHTML={{ __html: marked.parse(activeFileContent) as string }}
                  />
                ) : (
                  <pre className="p-4 text-xs font-mono text-[#161616] dark:text-[#d4d4d4] bg-[#f8f8fa] dark:bg-[#1a1a1a] rounded-xl border border-[#dedee2] dark:border-[#2e2e2e] overflow-x-auto whitespace-pre-wrap leading-relaxed select-text">
                    {activeFileContent}
                  </pre>
                )}
              </ScrollArea>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: VIEW 0 — MAIN SKILLS & BUNDLES LIST
  // ---------------------------------------------------------------------------
  return (
    <div className="flex-1 h-full flex flex-col min-h-0 bg-[#ffffff] dark:bg-[#161616] text-[#262626] dark:text-[#d4d4d4] select-none">
      {/* Top Header Bar */}
      <div className="px-6 pt-5 pb-4 shrink-0 flex flex-col gap-3">
        {/* Title & Search Row */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#161616] dark:text-white">
              {t("skillsTitle")}
            </h1>
            <p className="text-xs text-[#737373] dark:text-[#969696] mt-0.5">
              {t("skillsSubtitle")}
            </p>
          </div>

          {/* Search Bar & Close Button */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative w-56 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#737373] dark:text-[#969696]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("searchSkills")}
                className="w-full h-8 pl-8 pr-3 text-xs bg-[#f4f4f6] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] rounded-xl text-[#161616] dark:text-white placeholder-[#737373] dark:placeholder-[#5d5d5d] focus:outline-none focus:border-[#0066ff] dark:focus:border-[#0066ff] transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#161616] dark:hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white hover:bg-[#f0f0f2] dark:hover:bg-[#2b2b2b] transition-colors cursor-pointer outline-none focus:outline-none"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Scope Selector, Total Count & Controls Row */}
        <div className="flex items-center justify-between pt-1">
          {/* Left: Scope Pill & Count Badge */}
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#f4f4f6] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] text-xs font-medium text-[#161616] dark:text-white hover:bg-[#e9e9ec] dark:hover:bg-[#2b2b2b] transition-colors cursor-pointer"
                >
                  <User className="w-3.5 h-3.5 text-[#737373] dark:text-[#969696]" />
                  <span>
                    {selectedScope === "user"
                      ? t("userScope")
                      : selectedScope === "workspace"
                      ? t("workspaceScope")
                      : t("allScope")}
                  </span>
                  <ChevronDown className="w-3 h-3 text-[#737373] dark:text-[#969696] ml-0.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-36 bg-[#ffffff] dark:bg-[#222222] border-[#dedee2] dark:border-[#383838] text-[#161616] dark:text-white"
              >
                <DropdownMenuItem
                  onClick={() => setSelectedScope("user")}
                  className="text-xs cursor-pointer flex items-center justify-between"
                >
                  <span>{t("userScope")}</span>
                  {selectedScope === "user" && <Check className="w-3 h-3 text-[#0066ff]" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSelectedScope("workspace")}
                  className="text-xs cursor-pointer flex items-center justify-between"
                >
                  <span>{t("workspaceScope")}</span>
                  {selectedScope === "workspace" && <Check className="w-3 h-3 text-[#0066ff]" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#dedee2] dark:bg-[#383838]" />
                <DropdownMenuItem
                  onClick={() => setSelectedScope("all")}
                  className="text-xs cursor-pointer flex items-center justify-between"
                >
                  <span>{t("allScope")}</span>
                  {selectedScope === "all" && <Check className="w-3 h-3 text-[#0066ff]" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <span className="text-xs text-[#737373] dark:text-[#969696]">|</span>

            <span className="text-xs font-medium text-[#737373] dark:text-[#969696]">
              {t("skills")} <span className="text-[#161616] dark:text-white">{skills.length}</span>
            </span>
          </div>

          {/* Right: Sub-actions, Reset & Upload/New */}
          <div className="flex items-center gap-2">
            {/* More Options Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="p-1.5 rounded-lg border border-[#dedee2] dark:border-[#383838] bg-[#f4f4f6] dark:bg-[#222222] hover:bg-[#e9e9ec] dark:hover:bg-[#2b2b2b] text-[#737373] dark:text-[#d4d4d4] hover:text-[#161616] dark:hover:text-white transition-colors cursor-pointer"
                  title={t("moreOptions")}
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 bg-[#ffffff] dark:bg-[#222222] border-[#dedee2] dark:border-[#383838] text-[#161616] dark:text-white"
              >
                <DropdownMenuItem
                  onClick={() => setViewMode("upload")}
                  className="text-xs cursor-pointer flex items-center gap-2"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{t("uploadSkillTitle")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setIsManualCreateOpen(true)}
                  className="text-xs cursor-pointer flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create from Scratch</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#dedee2] dark:bg-[#383838]" />
                <DropdownMenuItem
                  onClick={handleResetToDefault}
                  className="text-xs cursor-pointer flex items-center gap-2 text-amber-500 hover:text-amber-400"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>{t("resetSkills")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => ensureDefaultSkillsSeeded()}
              className="p-1.5 rounded-lg border border-[#dedee2] dark:border-[#383838] bg-[#f4f4f6] dark:bg-[#222222] hover:bg-[#e9e9ec] dark:hover:bg-[#2b2b2b] text-[#737373] dark:text-[#d4d4d4] hover:text-[#161616] dark:hover:text-white transition-colors cursor-pointer"
              title={t("update")}
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            {/* Upload Button (Primary shortcut to Image 4) */}
            <button
              type="button"
              onClick={() => setViewMode("upload")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161616] dark:bg-white text-white dark:text-[#161616] hover:bg-[#2b2b2b] dark:hover:bg-[#e2e2e5] text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>{t("uploadBtn")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main List Scroll Area */}
      <ScrollArea className="flex-1 min-h-0 w-full px-6 pb-6">
        {filteredBundles.length === 0 && filteredStandaloneSkills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-[#737373] dark:text-[#969696]">
            <PencilSparkles className="w-8 h-8 stroke-1 text-[#737373] dark:text-[#5d5d5d] mb-3" />
            <p className="text-sm font-medium text-[#161616] dark:text-white">
              {t("noSkillsFound")}
            </p>
            <p className="text-xs text-[#737373] dark:text-[#969696] max-w-sm mt-1">
              {t("noSkillsFoundDesc")}
            </p>
            <button
              type="button"
              onClick={() => setViewMode("upload")}
              className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f4f4f6] dark:bg-[#222222] hover:bg-[#e9e9ec] dark:hover:bg-[#2b2b2b] text-xs font-medium text-[#161616] dark:text-white transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{t("uploadSkillTitle")}</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Bundles Section */}
            {filteredBundles.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold text-[#737373] dark:text-[#969696] uppercase tracking-wider">
                  Bundles & Toolkits ({filteredBundles.length})
                </span>
                <div className="flex flex-col divide-y divide-[#dedee2]/60 dark:divide-[#2e2e2e]/60 border border-[#dedee2] dark:border-[#2e2e2e] rounded-2xl bg-[#ffffff] dark:bg-[#1a1a1a] overflow-hidden shadow-xs">
                  {filteredBundles.map((bundle) => {
                    const Icon = getSkillIcon(bundle.icon, bundle.category);
                    const subCount = bundle.skillIds?.length || 0;
                    return (
                      <div
                        key={bundle.id}
                        className="flex items-center justify-between gap-4 p-3.5 hover:bg-[#f8f8fa] dark:hover:bg-[#222222]/60 transition-colors group cursor-pointer"
                        onClick={() => {
                          setSelectedBundle(bundle);
                          setBundleActiveTab("overview");
                          setViewMode("bundle-detail");
                        }}
                      >
                        {/* Icon & Info */}
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-xl bg-[#f4f4f6] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] flex items-center justify-center text-[#161616] dark:text-white shrink-0 group-hover:border-[#0066ff]/40 transition-colors">
                            <Icon className="w-5 h-5 stroke-[1.8]" />
                          </div>

                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-[#161616] dark:text-white tracking-tight">
                                {bundle.name}
                              </span>
                              <span className="text-[10px] font-medium px-2 py-0.2 rounded-md bg-[#ebebed] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838] text-[#555555] dark:text-[#a0a0a0]">
                                {subCount} skills
                              </span>
                              {bundle.author && (
                                <span className="text-[10px] text-[#737373] dark:text-[#5d5d5d]">
                                  by @{bundle.author}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#737373] dark:text-[#969696] line-clamp-1 truncate mt-0.5">
                              {bundle.description}
                            </p>
                          </div>
                        </div>

                        {/* Right: Switch & Chevron */}
                        <div
                          className="flex items-center gap-3 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Switch
                            checked={bundle.isEnabled}
                            onCheckedChange={(checked) => handleToggleBundle(bundle.id, checked)}
                            className="data-[state=checked]:bg-[#161616] dark:data-[state=checked]:bg-white data-[state=unchecked]:bg-[#dedee2] dark:data-[state=unchecked]:bg-[#383838]"
                          />
                          <ChevronRight
                            onClick={() => {
                              setSelectedBundle(bundle);
                              setBundleActiveTab("overview");
                              setViewMode("bundle-detail");
                            }}
                            className="w-4 h-4 text-[#737373] dark:text-[#5d5d5d] group-hover:translate-x-0.5 transition-transform cursor-pointer"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Standalone Skills Section */}
            {filteredStandaloneSkills.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold text-[#737373] dark:text-[#969696] uppercase tracking-wider">
                  Standalone Skills ({filteredStandaloneSkills.length})
                </span>
                <div className="flex flex-col divide-y divide-[#dedee2]/60 dark:divide-[#2e2e2e]/60 border border-[#dedee2] dark:border-[#2e2e2e] rounded-2xl bg-[#ffffff] dark:bg-[#1a1a1a] overflow-hidden shadow-xs">
                  {filteredStandaloneSkills.map((skill) => {
                    const Icon = getSkillIcon(skill.icon, skill.category);
                    return (
                      <div
                        key={skill.id}
                        className="flex items-center justify-between gap-4 p-3.5 hover:bg-[#f8f8fa] dark:hover:bg-[#222222]/60 transition-colors group cursor-pointer"
                        onClick={() => {
                          setSelectedSkill(skill);
                          setOriginBundle(null);
                          setSkillActiveTab("overview");
                          setViewMode("skill-detail");
                        }}
                      >
                        {/* Icon & Info */}
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-xl bg-[#f4f4f6] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] flex items-center justify-center text-[#161616] dark:text-white shrink-0 group-hover:border-[#0066ff]/40 transition-colors">
                            <Icon className="w-4 h-4" />
                          </div>

                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-[#161616] dark:text-white tracking-tight">
                                {skill.name}
                              </span>
                              <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-md bg-[#ebebed] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838] text-[#555555] dark:text-[#a0a0a0]">
                                /{skill.slug}
                              </span>
                              {skill.author && (
                                <span className="text-[10px] text-[#737373] dark:text-[#5d5d5d]">
                                  by @{skill.author}
                                </span>
                              )}
                              {!skill.isBuiltIn && (
                                <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                  {t("customBadge")}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#737373] dark:text-[#969696] line-clamp-1 truncate mt-0.5">
                              {skill.description}
                            </p>
                          </div>
                        </div>

                        {/* Right: Switch & Actions */}
                        <div
                          className="flex items-center gap-3 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Switch
                            checked={skill.isEnabled}
                            onCheckedChange={(checked) => handleToggleSkill(skill.id, checked)}
                            className="data-[state=checked]:bg-[#161616] dark:data-[state=checked]:bg-white data-[state=unchecked]:bg-[#dedee2] dark:data-[state=unchecked]:bg-[#383838]"
                          />
                          {!skill.isBuiltIn ? (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmSkill(skill)}
                              className="p-1 rounded-lg hover:bg-red-500/10 text-[#737373] dark:text-[#969696] hover:text-red-500 transition-colors cursor-pointer"
                              title={t("delete")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <div className="w-6" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Manual Create Dialog (Scratch Fallback) */}
      {isManualCreateOpen && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setIsManualCreateOpen(false)}
        >
          <div
            className="w-[560px] max-w-[95vw] max-h-[85vh] bg-[#ffffff] dark:bg-[#1f1f1f] border border-[#dedee2] dark:border-[#383838] rounded-2xl flex flex-col overflow-hidden text-[#262626] dark:text-[#d4d4d4] shadow-2xl animate-in zoom-in-[0.985] duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[#dedee2] dark:border-[#383838] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#161616] dark:text-white">
                  Create Skill from Scratch
                </h3>
                <p className="text-xs text-[#737373] dark:text-[#969696] mt-0.5">
                  Write customized instructions and prompt triggers for your agent.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsManualCreateOpen(false)}
                className="p-1 rounded-lg text-[#737373] hover:text-[#161616] dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleManualSave} className="flex-1 min-h-0 flex flex-col">
              <ScrollArea className="flex-1 p-5">
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium text-[#737373] dark:text-[#969696]">
                        {t("skillName")} *
                      </label>
                      <input
                        type="text"
                        required
                        value={manualName}
                        onChange={(e) => {
                          setManualName(e.target.value);
                          if (!manualSlug) {
                            setManualSlug(
                              e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "-")
                            );
                          }
                        }}
                        placeholder="e.g. Code Reviewer"
                        className="w-full h-8 px-2.5 text-xs bg-[#f4f4f6] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838] rounded-lg text-[#161616] dark:text-white focus:outline-none focus:border-[#0066ff]"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium text-[#737373] dark:text-[#969696]">
                        {t("skillSlug")} *
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-2.5 text-xs text-[#737373] dark:text-[#969696] font-mono">
                          /
                        </span>
                        <input
                          type="text"
                          required
                          value={manualSlug}
                          onChange={(e) => setManualSlug(e.target.value)}
                          placeholder="code-review"
                          className="w-full h-8 pl-6 pr-2.5 text-xs font-mono bg-[#f4f4f6] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838] rounded-lg text-[#161616] dark:text-white focus:outline-none focus:border-[#0066ff]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-[#737373] dark:text-[#969696]">
                      {t("skillDescription")}
                    </label>
                    <input
                      type="text"
                      value={manualDescription}
                      onChange={(e) => setManualDescription(e.target.value)}
                      placeholder="Summary of when AI should trigger this skill..."
                      className="w-full h-8 px-2.5 text-xs bg-[#f4f4f6] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838] rounded-lg text-[#161616] dark:text-white focus:outline-none focus:border-[#0066ff]"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-[#737373] dark:text-[#969696]">
                      {t("skillContent")}
                    </label>
                    <textarea
                      rows={8}
                      value={manualContent}
                      onChange={(e) => setManualContent(e.target.value)}
                      placeholder="# Skill Instructions&#10;&#10;Explain step-by-step rules and prompt instructions here..."
                      className="w-full p-2.5 text-xs font-mono bg-[#f4f4f6] dark:bg-[#161616] border border-[#dedee2] dark:border-[#383838] rounded-lg text-[#161616] dark:text-white focus:outline-none focus:border-[#0066ff] resize-y"
                    />
                  </div>
                </div>
              </ScrollArea>

              <div className="p-4 border-t border-[#dedee2] dark:border-[#383838] flex items-center justify-end gap-2 bg-[#f4f4f6]/50 dark:bg-[#161616]/50">
                <button
                  type="button"
                  onClick={() => setIsManualCreateOpen(false)}
                  className="px-3 py-1.5 rounded-xl border border-[#dedee2] dark:border-[#383838] text-xs font-medium text-[#737373] dark:text-[#d4d4d4] hover:bg-[#e9e9ec] dark:hover:bg-[#2b2b2b] transition-colors"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-xl bg-[#161616] dark:bg-white text-white dark:text-[#161616] hover:bg-[#2b2b2b] dark:hover:bg-[#e2e2e5] text-xs font-semibold shadow-xs transition-colors"
                >
                  {t("saveSkill")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmSkill && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setDeleteConfirmSkill(null)}
        >
          <div
            className="w-96 max-w-[90vw] bg-[#ffffff] dark:bg-[#1f1f1f] border border-[#dedee2] dark:border-[#383838] rounded-2xl p-5 flex flex-col gap-4 text-[#262626] dark:text-[#d4d4d4] shadow-2xl animate-in zoom-in-[0.985] duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[#161616] dark:text-white">
                  {t("deleteSkillConfirm")}
                </h4>
                <p className="text-xs text-[#737373] dark:text-[#969696] mt-0.5">
                  {t("deleteSkillConfirmDesc", { name: deleteConfirmSkill.name })}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmSkill(null)}
                className="px-3 py-1.5 rounded-xl border border-[#dedee2] dark:border-[#383838] text-xs font-medium text-[#737373] dark:text-[#d4d4d4] hover:bg-[#e9e9ec] dark:hover:bg-[#2b2b2b] transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await localDb.deleteSkill(deleteConfirmSkill.id);
                    toast.success(t("skillDeletedSuccess"));
                    setDeleteConfirmSkill(null);
                  } catch (err: any) {
                    toast.error(err?.message || "Failed to delete skill");
                  }
                }}
                className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                {t("delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { SkillsSettings as SkillsView };

