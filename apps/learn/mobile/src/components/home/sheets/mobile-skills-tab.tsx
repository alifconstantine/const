import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Search,
  Plus,
  RotateCw,
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
  X,
  Check,
  ArrowLeft,
  ChevronRight,
  Eye,
  Code,
  Copy,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Layers,
} from "lucide-react";
import { Switch, ScrollArea, toast, cn } from "@const/ui";
import { marked } from "marked";
import JSZip from "jszip";
import {
  db,
  localDb,
  type LocalSkill,
  type LocalSkillBundle,
  type SkillCategory,
} from "../../../lib/db";
import { useI18n } from "../../../lib/i18n";
import {
  ensureDefaultSkillsSeeded,
  parseSkillMarkdown,
  generateSkillOverview,
  runSecurityScan,
} from "../../../lib/skills/skills-service";
import {
  DEFAULT_BUILTIN_SKILLS,
  DEFAULT_BUILTIN_BUNDLES,
} from "../../../lib/skills/default-skills";

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

export function MobileSkillsTab() {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const skills = useLiveQuery(() => db.skills.toArray(), [], [] as LocalSkill[]);
  const bundles = useLiveQuery(() => db.skillBundles.toArray(), [], [] as LocalSkillBundle[]);

  // Navigation states
  const [viewMode, setViewMode] = useState<"list" | "bundle-detail" | "skill-detail" | "upload">("list");
  const [selectedBundle, setSelectedBundle] = useState<LocalSkillBundle | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<LocalSkill | null>(null);
  const [originBundle, setOriginBundle] = useState<LocalSkillBundle | null>(null);

  // Detail tab states
  const [bundleActiveTab, setBundleActiveTab] = useState<"overview" | "content" | "skills">("overview");
  const [skillActiveTab, setSkillActiveTab] = useState<"overview" | "content">("overview");
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [contentViewMode, setContentViewMode] = useState<"preview" | "code">("preview");

  // List filter state
  const [searchQuery, setSearchQuery] = useState("");

  // Upload view state
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

  useEffect(() => {
    ensureDefaultSkillsSeeded();
  }, []);

  // Sync selection with DB updates
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

  // Compute bundle sub-skills
  const bundleSubSkills = useMemo(() => {
    if (!selectedBundle) return [];
    const skillIdSet = new Set(selectedBundle.skillIds || []);
    return skills.filter((s) => skillIdSet.has(s.id) || s.bundleId === selectedBundle.id);
  }, [selectedBundle, skills]);

  // Compute files maps
  const bundleFilesMap = useMemo(() => {
    if (!selectedBundle) return {};
    const files: Record<string, string> = { ...(selectedBundle.files || {}) };
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

  const skillFilesMap = useMemo(() => {
    if (!selectedSkill) return {};
    if (selectedSkill.files && Object.keys(selectedSkill.files).length > 0) {
      return selectedSkill.files;
    }
    return {
      "SKILL.md": selectedSkill.content || `# ${selectedSkill.name}\n\n${selectedSkill.description}`,
    };
  }, [selectedSkill]);

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

  // Filter bundles and standalone skills
  const filteredBundles = useMemo(() => {
    return bundles.filter((bundle) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          bundle.name.toLowerCase().includes(q) ||
          bundle.slug.toLowerCase().includes(q) ||
          bundle.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [bundles, searchQuery]);

  const filteredStandaloneSkills = useMemo(() => {
    return skills.filter((skill) => {
      if (skill.bundleId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          skill.name.toLowerCase().includes(q) ||
          skill.slug.toLowerCase().includes(q) ||
          skill.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [skills, searchQuery]);

  // Toggle handlers
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

  // Upload processor
  const processUploadedFile = async (file: File) => {
    setUploadFile(file);
    setScanStatus("scanning");
    setScanMessage(t("scanScanning"));

    try {
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith(".zip")) {
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
      setScanMessage(err?.message || "Failed to process file");
      toast.error("Failed to parse file: " + (err?.message || ""));
    }
  };

  const handleUploadSubmit = async () => {
    if (!uploadSkillName.trim() || !uploadSkillSlug.trim()) {
      toast.error("Skill name and slug required");
      return;
    }
    if (scanStatus !== "passed") {
      toast.error("File must pass security scan");
      return;
    }

    try {
      const cleanSlug = uploadSkillSlug
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-")
        .replace(/-+/g, "-");

      if (uploadIsBundle) {
        const bundleId = "bundle_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
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
          skillIds: [],
        });
        toast.success(t("skillAddedSuccess", { name: uploadSkillName }));
      } else {
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

      setUploadFile(null);
      setScanStatus("idle");
      setViewMode("list");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save skill");
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t("contentCopied"));
  };

  // ---------------------------------------------------------------------------
  // MOBILE: UPLOAD VIEW (Image 4)
  // ---------------------------------------------------------------------------
  if (viewMode === "upload") {
    return (
      <div className="flex flex-col gap-4 pb-12 select-none">
        <button
          type="button"
          onClick={() => setViewMode("list")}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t("backToSkills")}</span>
        </button>

        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {t("uploadSkillTitle")}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {t("uploadSkillSubtitle")}
          </p>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processUploadedFile(file);
            e.target.value = "";
          }}
          accept=".md,.markdown,.zip,text/markdown"
          className="hidden"
        />

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border hover:border-primary rounded-2xl p-6 text-center cursor-pointer transition-all bg-secondary/30 flex flex-col items-center justify-center gap-2"
        >
          <div className="w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground">
            <Upload className="w-5 h-5 stroke-[1.8]" />
          </div>
          <span className="text-xs font-semibold text-foreground">
            {t("dragAndDropFiles")}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {uploadFile ? uploadFile.name : ".md with YAML frontmatter or .zip bundle"}
          </span>
        </div>

        {/* Security Scan card */}
        <div className="p-3.5 rounded-xl bg-secondary/40 border border-border flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            {scanStatus === "passed" ? (
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
            ) : scanStatus === "failed" ? (
              <ShieldAlert className="w-5 h-5 text-red-500" />
            ) : (
              <Shield className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">
                {t("securityScanTitle")}
              </span>
              <span
                className={cn(
                  "text-[10px] font-medium px-1.5 py-0.5 rounded",
                  scanStatus === "passed"
                    ? "bg-emerald-500/10 text-emerald-500"
                    : scanStatus === "failed"
                    ? "bg-red-500/10 text-red-500"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {scanStatus === "passed"
                  ? t("securityScanPassed")
                  : scanStatus === "scanning"
                  ? t("scanScanning")
                  : t("securityScanRunsOnUpload")}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {scanStatus === "passed" ? scanMessage : t("securityScanDesc")}
            </p>
          </div>
        </div>

        {/* AI Overview details */}
        {uploadFile && scanStatus === "passed" && (
          <div className="flex flex-col gap-2.5 p-3.5 rounded-xl bg-secondary/20 border border-border">
            <div className="flex items-center gap-1.5">
              <PencilSparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground">AI Overview</span>
            </div>
            <div className="text-xs font-semibold text-foreground">{uploadSkillName}</div>
            <p className="text-[11px] text-muted-foreground">{uploadSkillDescription}</p>
            <div className="p-2 rounded-lg bg-card border border-border text-[11px] leading-relaxed max-h-32 overflow-y-auto">
              {uploadSkillOverview}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className="px-3 py-1.5 rounded-xl border border-border text-xs text-muted-foreground"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={handleUploadSubmit}
            disabled={!uploadFile || scanStatus !== "passed"}
            className="px-4 py-1.5 rounded-xl bg-foreground text-background font-semibold text-xs disabled:opacity-40"
          >
            {t("uploadBtn")}
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // MOBILE: BUNDLE DETAIL (Image 1 & 3)
  // ---------------------------------------------------------------------------
  if (viewMode === "bundle-detail" && selectedBundle) {
    const Icon = getSkillIcon(selectedBundle.icon, selectedBundle.category);
    const activeFileContent = bundleFilesMap[selectedFileName] || "";

    return (
      <div className="flex flex-col gap-3 pb-12 select-none">
        <button
          type="button"
          onClick={() => setViewMode("list")}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t("backToSkills")}</span>
        </button>

        {/* Header */}
        <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-card border border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center text-foreground shrink-0">
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-foreground truncate">
                {selectedBundle.name}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {selectedBundle.author} · {bundleSubSkills.length} skills
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleToggleBundle(selectedBundle.id, !selectedBundle.isEnabled)}
            className={cn(
              "px-3 py-1 rounded-xl text-xs font-semibold shrink-0",
              selectedBundle.isEnabled
                ? "bg-secondary text-foreground border border-border"
                : "bg-foreground text-background"
            )}
          >
            {selectedBundle.isEnabled ? "Enabled" : "Add"}
          </button>
        </div>

        {/* 3 Tabs (Overview, Content, Skills) */}
        <div className="flex items-center gap-4 border-b border-border text-xs font-medium px-1">
          <button
            type="button"
            onClick={() => setBundleActiveTab("overview")}
            className={cn(
              "pb-2 border-b-2 -mb-[1px]",
              bundleActiveTab === "overview"
                ? "border-foreground text-foreground font-semibold"
                : "border-transparent text-muted-foreground"
            )}
          >
            {t("tabOverview")}
          </button>
          <button
            type="button"
            onClick={() => setBundleActiveTab("content")}
            className={cn(
              "pb-2 border-b-2 -mb-[1px]",
              bundleActiveTab === "content"
                ? "border-foreground text-foreground font-semibold"
                : "border-transparent text-muted-foreground"
            )}
          >
            {t("tabContent")}
          </button>
          <button
            type="button"
            onClick={() => setBundleActiveTab("skills")}
            className={cn(
              "pb-2 border-b-2 -mb-[1px]",
              bundleActiveTab === "skills"
                ? "border-foreground text-foreground font-semibold"
                : "border-transparent text-muted-foreground"
            )}
          >
            {t("tabSkills")} · {bundleSubSkills.length}
          </button>
        </div>

        {bundleActiveTab === "overview" && (
          <div className="flex flex-col gap-3">
            <div
              className="prose dark:prose-invert max-w-none text-xs leading-relaxed select-text [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:mt-2.5 [&_h1]:mb-1 [&_h2]:text-xs [&_h2]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mt-1.5 [&_h3]:mb-1 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_code]:font-mono [&_code]:text-[11px] [&_code]:bg-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded-md [&_strong]:text-foreground"
              dangerouslySetInnerHTML={{
                __html: marked.parse(selectedBundle.overview || selectedBundle.description) as string,
              }}
            />
            <div className="flex flex-col divide-y divide-border/60 border border-border rounded-xl bg-card overflow-hidden">
              {bundleSubSkills.map((sub) => (
                <div
                  key={sub.id}
                  onClick={() => {
                    setSelectedSkill(sub);
                    setOriginBundle(selectedBundle);
                    setViewMode("skill-detail");
                  }}
                  className="p-2.5 flex items-center justify-between gap-2"
                >
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground">{sub.name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">/{sub.slug}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground line-clamp-1">{sub.description}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {bundleActiveTab === "content" && (
          <div className="flex flex-col gap-2">
            {/* File selector pill list */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {Object.keys(bundleFilesMap).map((fileName) => (
                <button
                  key={fileName}
                  type="button"
                  onClick={() => setSelectedFileName(fileName)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-mono whitespace-nowrap shrink-0 border",
                    selectedFileName === fileName
                      ? "bg-foreground text-background border-foreground font-semibold"
                      : "bg-secondary text-muted-foreground border-border"
                  )}
                >
                  {fileName.split("/").pop()}
                </button>
              ))}
            </div>

            {/* Viewer controls */}
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-mono text-muted-foreground truncate">
                /{selectedFileName}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setContentViewMode(contentViewMode === "preview" ? "code" : "preview")}
                  className="p-1 px-2 rounded-lg bg-secondary text-[10px] font-medium border border-border"
                >
                  {contentViewMode === "preview" ? "Code" : "Preview"}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(activeFileContent)}
                  className="p-1 rounded-lg bg-secondary border border-border text-muted-foreground"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Viewer */}
            <div className="p-3 rounded-xl bg-card border border-border max-h-80 overflow-y-auto">
              {contentViewMode === "preview" ? (
                <div
                  className="prose dark:prose-invert max-w-none text-xs leading-relaxed select-text [&_h1]:text-sm [&_h2]:text-xs [&_p]:my-1"
                  dangerouslySetInnerHTML={{ __html: marked.parse(activeFileContent) as string }}
                />
              ) : (
                <pre className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed">
                  {activeFileContent}
                </pre>
              )}
            </div>
          </div>
        )}

        {bundleActiveTab === "skills" && (
          <div className="flex flex-col divide-y divide-border/60 border border-border rounded-xl bg-card overflow-hidden">
            {bundleSubSkills.map((sub) => (
              <div
                key={sub.id}
                onClick={() => {
                  setSelectedSkill(sub);
                  setOriginBundle(selectedBundle);
                  setViewMode("skill-detail");
                }}
                className="p-3 flex items-center justify-between gap-2.5 cursor-pointer"
              >
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground">{sub.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">/{sub.slug}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground line-clamp-1">{sub.description}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // MOBILE: SINGLE SKILL DETAIL (Image 2)
  // ---------------------------------------------------------------------------
  if (viewMode === "skill-detail" && selectedSkill) {
    const Icon = getSkillIcon(selectedSkill.icon, selectedSkill.category);
    const activeFileContent = skillFilesMap[selectedFileName] || selectedSkill.content || "";
    const filesList = Object.keys(skillFilesMap);

    return (
      <div className="flex flex-col gap-3 pb-12 select-none">
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
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{originBundle ? originBundle.name : t("backToSkills")}</span>
        </button>

        {/* Header */}
        <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-card border border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center text-foreground shrink-0">
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground truncate">{selectedSkill.name}</span>
                <span className="text-[10px] font-mono text-muted-foreground">/{selectedSkill.slug}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {selectedSkill.author || "Const"} · {selectedSkill.version || "1.0.0"}
              </span>
            </div>
          </div>

          <Switch
            checked={selectedSkill.isEnabled}
            onCheckedChange={(checked) => handleToggleSkill(selectedSkill.id, checked)}
          />
        </div>

        {/* 2 Tabs (Overview, Content · N) */}
        <div className="flex items-center gap-4 border-b border-border text-xs font-medium px-1">
          <button
            type="button"
            onClick={() => setSkillActiveTab("overview")}
            className={cn(
              "pb-2 border-b-2 -mb-[1px]",
              skillActiveTab === "overview"
                ? "border-foreground text-foreground font-semibold"
                : "border-transparent text-muted-foreground"
            )}
          >
            {t("tabOverview")}
          </button>
          <button
            type="button"
            onClick={() => setSkillActiveTab("content")}
            className={cn(
              "pb-2 border-b-2 -mb-[1px]",
              skillActiveTab === "content"
                ? "border-foreground text-foreground font-semibold"
                : "border-transparent text-muted-foreground"
            )}
          >
            {t("tabContent")} · {filesList.length}
          </button>
        </div>

        {skillActiveTab === "overview" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground leading-relaxed">{selectedSkill.description}</p>
            {selectedSkill.overview && (
              <div
                className="prose dark:prose-invert max-w-none text-xs leading-relaxed select-text"
                dangerouslySetInnerHTML={{ __html: marked.parse(selectedSkill.overview) as string }}
              />
            )}
            <div className="p-3 rounded-xl bg-secondary/30 border border-border text-xs text-muted-foreground">
              Trigger command: <code className="font-mono text-foreground font-semibold">/{selectedSkill.slug}</code>
            </div>
          </div>
        )}

        {skillActiveTab === "content" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-mono text-muted-foreground truncate">
                /{selectedFileName || "SKILL.md"}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setContentViewMode(contentViewMode === "preview" ? "code" : "preview")}
                  className="p-1 px-2 rounded-lg bg-secondary text-[10px] font-medium border border-border"
                >
                  {contentViewMode === "preview" ? "Code" : "Preview"}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(activeFileContent)}
                  className="p-1 rounded-lg bg-secondary border border-border text-muted-foreground"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-card border border-border max-h-80 overflow-y-auto">
              {contentViewMode === "preview" ? (
                <div
                  className="prose dark:prose-invert max-w-none text-xs leading-relaxed select-text [&_h1]:text-sm [&_h2]:text-xs [&_p]:my-1"
                  dangerouslySetInnerHTML={{ __html: marked.parse(activeFileContent) as string }}
                />
              ) : (
                <pre className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed">
                  {activeFileContent}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // MOBILE: MAIN LIST
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-3 pb-8 select-none">
      {/* Top Search & Actions Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchSkills")}
            className="w-full h-8 pl-8 pr-3 text-xs bg-secondary border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Upload Button */}
        <button
          type="button"
          onClick={() => setViewMode("upload")}
          className="h-8 px-2.5 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-foreground flex items-center gap-1.5 text-xs font-medium cursor-pointer active:scale-95"
          title={t("uploadSkillTitle")}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload</span>
        </button>
      </div>

      {/* Subheader Count info */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
        <span>{t("installedCount", { count: skills.length })}</span>
        <button
          type="button"
          onClick={async () => {
            await db.skillBundles.clear();
            await db.skills.clear();
            await db.skillBundles.bulkPut(DEFAULT_BUILTIN_BUNDLES);
            await db.skills.bulkPut(DEFAULT_BUILTIN_SKILLS);
            toast.success(t("skillsResetSuccess"));
          }}
          className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
        >
          <RotateCw className="w-3 h-3" />
          <span>{t("resetSkills")}</span>
        </button>
      </div>

      {/* Main List */}
      <div className="flex flex-col gap-4">
        {/* Bundles */}
        {filteredBundles.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Bundles ({filteredBundles.length})
            </span>
            <div className="flex flex-col divide-y divide-border/60 border border-border rounded-2xl bg-card overflow-hidden">
              {filteredBundles.map((bundle) => {
                const Icon = getSkillIcon(bundle.icon, bundle.category);
                return (
                  <div
                    key={bundle.id}
                    className="flex items-center justify-between gap-3 p-3 hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedBundle(bundle);
                      setBundleActiveTab("overview");
                      setViewMode("bundle-detail");
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center text-foreground shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground tracking-tight">
                            {bundle.name}
                          </span>
                          <span className="text-[9px] font-medium px-1 rounded bg-secondary text-muted-foreground">
                            {bundle.skillIds?.length || 0} skills
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-1 truncate mt-0.5">
                          {bundle.description}
                        </p>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Switch
                        checked={bundle.isEnabled}
                        onCheckedChange={(checked) => handleToggleBundle(bundle.id, checked)}
                      />
                      <ChevronRight
                        onClick={() => {
                          setSelectedBundle(bundle);
                          setBundleActiveTab("overview");
                          setViewMode("bundle-detail");
                        }}
                        className="w-4 h-4 text-muted-foreground"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Standalone skills */}
        {filteredStandaloneSkills.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Standalone Skills ({filteredStandaloneSkills.length})
            </span>
            <div className="flex flex-col divide-y divide-border/60 border border-border rounded-2xl bg-card overflow-hidden">
              {filteredStandaloneSkills.map((skill) => {
                const Icon = getSkillIcon(skill.icon, skill.category);
                return (
                  <div
                    key={skill.id}
                    className="flex items-center justify-between gap-3 p-3 hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedSkill(skill);
                      setOriginBundle(null);
                      setSkillActiveTab("overview");
                      setViewMode("skill-detail");
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center text-foreground shrink-0">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-foreground tracking-tight">
                            {skill.name}
                          </span>
                          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-muted text-muted-foreground border border-border/60">
                            /{skill.slug}
                          </span>
                          {!skill.isBuiltIn && (
                            <span className="text-[9px] font-medium px-1 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                              {t("customBadge")}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-1 truncate mt-0.5">
                          {skill.description}
                        </p>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Switch
                        checked={skill.isEnabled}
                        onCheckedChange={(checked) => handleToggleSkill(skill.id, checked)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
