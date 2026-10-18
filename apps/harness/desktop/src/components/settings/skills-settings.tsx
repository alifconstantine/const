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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function highlightSyntax(code: string, language: string): string {
  const lang = (language || "").toLowerCase().trim();
  const lines = code.split("\n");

  return lines
    .map((line) => {
      if (lang === "python" || lang === "py") {
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

      if (lang === "bash" || lang === "sh" || lang === "shell" || lang === "zsh") {
        const regex =
          /(#.*$)|(["'](?:\\.|[^"'\\])*["'])|(\$[a-zA-Z0-9_]+|\$\{[^}]+\})|(\b(?:echo|cd|mkdir|rm|cp|mv|cat|grep|sed|awk|curl|wget|chmod|chown|git|npm|npx|pnpm|yarn|python|python3|pip|uv|if|then|else|elif|fi|for|in|do|done|while|case|esac|function)\b)|(\b\d+\b)|([^\s\w$]+)|(\s+)/g;

        return line.replace(regex, (match, comment, str, variable, kw, num, _symbol, spaces) => {
          if (comment) return `<span class="text-zinc-400 dark:text-zinc-500 italic">${escapeHtml(comment)}</span>`;
          if (str) return `<span class="text-emerald-600 dark:text-emerald-400">${escapeHtml(str)}</span>`;
          if (variable) return `<span class="text-sky-600 dark:text-sky-400 font-medium">${escapeHtml(variable)}</span>`;
          if (kw) return `<span class="text-purple-600 dark:text-purple-400 font-semibold">${escapeHtml(kw)}</span>`;
          if (num) return `<span class="text-amber-600 dark:text-amber-400">${escapeHtml(num)}</span>`;
          if (spaces) return spaces;
          return escapeHtml(match);
        });
      }

      if (lang === "json") {
        const regex =
          /("(?:\\.|[^"\\])*"(?=\s*:))|("(?:\\.|[^"\\])*")|(\b(?:true|false|null)\b)|(\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|([^\s\w"]+)|(\s+)/g;

        return line.replace(regex, (match, key, str, bool, num, _symbol, spaces) => {
          if (key) return `<span class="text-sky-600 dark:text-sky-400 font-medium">${escapeHtml(key)}</span>`;
          if (str) return `<span class="text-emerald-600 dark:text-emerald-400">${escapeHtml(str)}</span>`;
          if (bool) return `<span class="text-purple-600 dark:text-purple-400 font-semibold">${escapeHtml(bool)}</span>`;
          if (num) return `<span class="text-amber-600 dark:text-amber-400">${escapeHtml(num)}</span>`;
          if (spaces) return spaces;
          return escapeHtml(match);
        });
      }

      if (lang === "yaml" || lang === "yml") {
        const regex =
          /(#.*$)|(^[ \t]*[a-zA-Z0-9_-]+(?=\s*:))|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b(?:true|false|null|yes|no)\b)|(\b\d+(?:\.\d+)?\b)|([^\s\w"']+)|(\s+)/g;

        return line.replace(regex, (match, comment, key, str, bool, num, _symbol, spaces) => {
          if (comment) return `<span class="text-zinc-400 dark:text-zinc-500 italic">${escapeHtml(comment)}</span>`;
          if (key) return `<span class="text-sky-600 dark:text-sky-400 font-semibold">${escapeHtml(key)}</span>`;
          if (str) return `<span class="text-emerald-600 dark:text-emerald-400">${escapeHtml(str)}</span>`;
          if (bool) return `<span class="text-purple-600 dark:text-purple-400 font-semibold">${escapeHtml(bool)}</span>`;
          if (num) return `<span class="text-amber-600 dark:text-amber-400">${escapeHtml(num)}</span>`;
          if (spaces) return spaces;
          return escapeHtml(match);
        });
      }

      return escapeHtml(line);
    })
    .join("\n");
}

// Configure marked with syntax-highlighted code block renderer
marked.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const language = (lang || "text").toLowerCase();
      const highlighted = highlightSyntax(text, language);
      return `<div class="rounded-xl overflow-hidden bg-secondary/30 border border-border my-3 select-none">
        <div class="flex items-center justify-between px-3.5 py-1.5 bg-secondary/60 border-b border-border text-xs">
          <span class="font-mono text-[11px] text-muted-foreground uppercase font-semibold">${language}</span>
        </div>
        <pre class="p-3.5 overflow-x-auto text-xs leading-relaxed font-mono text-foreground select-text whitespace-pre"><code>${highlighted}</code></pre>
      </div>`;
    },
  },
});

function SkillCodeViewer({
  code,
  filename,
  onCopy,
}: {
  code: string;
  filename: string;
  onCopy?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const ext = filename.split(".").pop()?.toLowerCase() || "text";
  const lang =
    ext === "py"
      ? "python"
      : ext === "sh" || ext === "bash"
      ? "bash"
      : ext === "json"
      ? "json"
      : ext === "yaml" || ext === "yml"
      ? "yaml"
      : ext === "ts" || ext === "tsx"
      ? "typescript"
      : ext === "js" || ext === "jsx"
      ? "javascript"
      : ext === "md" || ext === "markdown"
      ? "markdown"
      : ext;

  const lines = code.split("\n");

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.();
  };

  return (
    <div className="w-full flex flex-col rounded-xl border border-border bg-secondary/15 overflow-hidden text-xs">
      <div className="flex items-center justify-between px-3.5 py-2 bg-secondary/40 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-semibold uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
            {lang}
          </span>
          <span className="text-[11px] font-mono text-muted-foreground">
            {lines.length} {lines.length === 1 ? "line" : "lines"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-500" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </Button>
      </div>

      <div className="flex overflow-x-auto select-text py-3">
        {/* Line numbers */}
        <div className="select-none text-right pr-3.5 pl-3 text-muted-foreground/40 border-r border-border shrink-0 leading-relaxed font-mono text-[11.5px]">
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        {/* Highlighted code lines */}
        <div className="flex-1 pl-3.5 pr-4 overflow-x-auto leading-relaxed font-mono text-[11.5px] text-foreground">
          {lines.map((line, i) => (
            <div
              key={i}
              className="whitespace-pre"
              dangerouslySetInnerHTML={{
                __html: highlightSyntax(line, lang) || "&nbsp;",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export interface SkillsSettingsProps {
  onClose?: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export function SkillsSettings({
  onClose,
  isSidebarOpen,
  onToggleSidebar,
}: SkillsSettingsProps = {}) {
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
  const [selectedScope, setSelectedScope] = useState<"all" | "user" | "workspace">("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [deleteConfirmSkill, setDeleteConfirmSkill] = useState<LocalSkill | null>(null);
  const [isManualCreateOpen, setIsManualCreateOpen] = useState(false);

  // Scope sliding tab indicator
  const allScopeRef = useRef<HTMLButtonElement>(null);
  const userScopeRef = useRef<HTMLButtonElement>(null);
  const workspaceScopeRef = useRef<HTMLButtonElement>(null);
  const [scopeIndicatorStyle, setScopeIndicatorStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  useEffect(() => {
    const updateIndicator = () => {
      let activeEl: HTMLButtonElement | null = null;
      if (selectedScope === "all") activeEl = allScopeRef.current;
      else if (selectedScope === "user") activeEl = userScopeRef.current;
      else if (selectedScope === "workspace") activeEl = workspaceScopeRef.current;

      if (activeEl) {
        setScopeIndicatorStyle({
          left: activeEl.offsetLeft,
          width: activeEl.offsetWidth,
        });
      }
    };

    updateIndicator();
    const timer = setTimeout(updateIndicator, 50);
    window.addEventListener("resize", updateIndicator);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateIndicator);
    };
  }, [selectedScope, viewMode]);

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

  const filteredSkills = useMemo(() => {
    return skills.filter((skill) => {
      if (selectedScope === "user" && skill.scope === "workspace") return false;
      if (selectedScope === "workspace" && skill.scope !== "workspace") return false;

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
  }, [skills, selectedScope, searchQuery]);

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
      await ensureDefaultSkillsSeeded(true);
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
        // Create bundle
        await localDb.createSkillBundle({
          slug: cleanSlug,
          name: uploadSkillName.trim(),
          description: uploadSkillDescription.trim(),
          overview: uploadSkillOverview,
          author: "User",
          version: "1.0.0",
          category: uploadCategory,
          isBuiltIn: false,
          isEnabled: true,
          scope: "user",
          files: uploadFilesMap,
          skillIds: [],
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
      <div className="w-full flex flex-col space-y-6 font-sans select-none">
        {/* Top Back Navigation Bar */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("list")}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer -ml-2 h-8"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t("backToSkills")}</span>
          </Button>

          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Upload Container Body */}
        <div className="max-w-2xl mx-auto w-full flex flex-col gap-6">
          {/* Header Titles */}
          <div>
            <h2 className="font-serif text-2xl sm:text-3xl font-normal tracking-tight text-foreground">
              {t("uploadSkillTitle")}
            </h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
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

          {/* Terminal CLI Command Box (skills.sh open standard) */}
          <div className="p-4 rounded-2xl bg-card border border-border flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">
                  Install via Terminal (skills.sh open standard)
                </span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">
                npx skills add
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Install skills directly into your workspace using the official skills CLI. Skills are managed as real directory trees containing <code className="text-primary font-mono text-[11px]">SKILL.md</code>.
            </p>
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-secondary/80 border border-border font-mono text-xs text-foreground select-text">
              <span className="truncate">npx skills add https://github.com/anthropics/skills --skill frontend-design</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText("npx skills add https://github.com/anthropics/skills --skill frontend-design");
                  toast.success("Command copied to clipboard!");
                }}
                className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
                title="Copy command"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
              <span className="font-medium">Popular:</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText("npx skills add adithya-s-k/manim_skill");
                  toast.success("Copied: npx skills add adithya-s-k/manim_skill");
                }}
                className="px-2 py-0.5 rounded-md bg-secondary hover:bg-secondary/70 border border-border cursor-pointer transition-colors"
              >
                manim_skill
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText("npx skills add hyperframes");
                  toast.success("Copied: npx skills add hyperframes");
                }}
                className="px-2 py-0.5 rounded-md bg-secondary hover:bg-secondary/70 border border-border cursor-pointer transition-colors"
              >
                hyperframes
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText("npx skills add anthropics/skills --skill frontend-design");
                  toast.success("Copied: npx skills add anthropics/skills --skill frontend-design");
                }}
                className="px-2 py-0.5 rounded-md bg-secondary hover:bg-secondary/70 border border-border cursor-pointer transition-colors"
              >
                frontend-design
              </button>
            </div>
          </div>

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
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/60 bg-card"
            )}
          >
            <div className="w-12 h-12 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground mb-1">
              <Upload className="w-6 h-6 stroke-[1.8]" />
            </div>

            <div>
              <span className="text-sm font-semibold text-foreground block">
                {t("dragAndDropFiles")}
              </span>
              <span className="text-xs text-muted-foreground block mt-1">
                {uploadFile ? (
                  <span className="font-medium text-primary">
                    Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                  </span>
                ) : (
                  "Supports single markdown or bundled archive"
                )}
              </span>
            </div>

            {/* Supported formats bullet points */}
            <div className="flex flex-col items-start text-left text-xs text-muted-foreground gap-1.5 mt-2 bg-secondary/50 p-3 rounded-xl border border-border w-full max-w-md">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                <span>{t("uploadMdSupport")}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                <span>{t("uploadZipSupport")}</span>
              </div>
            </div>
          </div>

            {/* Security Scan Card (Image 4) */}
            <div className="p-4 rounded-2xl bg-card border border-border flex items-start gap-3.5">
              <div className="mt-0.5 shrink-0">
                {scanStatus === "passed" ? (
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                ) : scanStatus === "failed" ? (
                  <div className="w-8 h-8 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-secondary border border-border text-muted-foreground flex items-center justify-center">
                    <Shield className="w-4 h-4" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    {t("securityScanTitle")}
                  </span>
                  <span
                    className={cn(
                      "text-[11px] font-medium px-2 py-0.5 rounded-md",
                      scanStatus === "passed"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : scanStatus === "failed"
                        ? "bg-destructive/10 text-destructive border border-destructive/20"
                        : scanStatus === "scanning"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse"
                        : "bg-secondary text-muted-foreground border border-border"
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

                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {scanStatus === "passed" ? scanMessage : t("securityScanDesc")}
                </p>
              </div>
            </div>

            {/* AI Generated Overview Box */}
            {uploadFile && scanStatus === "passed" && (
              <div className="flex flex-col gap-3 p-4 rounded-2xl bg-card border border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PencilSparkles className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold text-foreground">
                      AI Overview & Configuration
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    Auto-generated from content
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      {t("skillName")}
                    </label>
                    <Input
                      type="text"
                      value={uploadSkillName}
                      onChange={(e) => setUploadSkillName(e.target.value)}
                      className="h-8 px-2.5 text-xs bg-background border-border text-foreground rounded-xl"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      {t("skillSlug")}
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-2.5 text-xs text-muted-foreground font-mono">
                        /
                      </span>
                      <Input
                        type="text"
                        value={uploadSkillSlug}
                        onChange={(e) => setUploadSkillSlug(e.target.value)}
                        className="h-8 pl-6 pr-2.5 text-xs font-mono bg-background border-border text-foreground rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    {t("skillDescription")}
                  </label>
                  <Input
                    type="text"
                    value={uploadSkillDescription}
                    onChange={(e) => setUploadSkillDescription(e.target.value)}
                    className="h-8 px-2.5 text-xs bg-background border-border text-foreground rounded-xl"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Overview (Written by AI)
                  </label>
                  <textarea
                    rows={4}
                    value={uploadSkillOverview}
                    onChange={(e) => setUploadSkillOverview(e.target.value)}
                    className="w-full p-2.5 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 resize-y leading-relaxed font-sans"
                  />
                </div>
              </div>
            )}

            {/* Bottom Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode("list")}
                className="rounded-xl border-border text-muted-foreground hover:text-foreground"
              >
                {t("cancel")}
              </Button>
              <Button
                size="sm"
                onClick={handleUploadSubmit}
                disabled={!uploadFile || scanStatus !== "passed"}
                className="px-5 rounded-xl text-xs font-semibold shadow-xs"
              >
                {t("uploadBtn")}
              </Button>
            </div>
          </div>
        </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: VIEW 1 & 3 — BUNDLE DETAIL (Image 1 & Image 3)
  // ---------------------------------------------------------------------------
  if (viewMode === "bundle-detail" && selectedBundle) {
    const activeFileContent = bundleFilesMap[selectedFileName] || "";

    return (
      <div className="w-full flex flex-col space-y-6 font-sans select-none">
        {/* Top Back Navigation Bar */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("list")}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer -ml-2 h-8"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t("backToSkills")}</span>
          </Button>

          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Bundle Header Strip */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col min-w-0">
            <h2 className="font-serif text-2xl sm:text-3xl font-normal tracking-tight text-foreground truncate">
              {selectedBundle.name}
            </h2>
            {/* Meta row: Author · Version · Skills Count · Updated */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
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

          {/* Action button: Add / Enabled */}
          <div className="shrink-0 flex items-center gap-2">
            <Button
              size="sm"
              variant={selectedBundle.isEnabled ? "secondary" : "default"}
              onClick={() => handleToggleBundle(selectedBundle.id, !selectedBundle.isEnabled)}
              className="rounded-xl text-xs font-semibold gap-1.5 shadow-none"
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
            </Button>
          </div>
        </div>

        {/* 3 Tabs Row (Overview, Content, Skills · N) */}
        <div className="border-b border-border flex items-center gap-6 text-xs font-medium">
          <button
            type="button"
            onClick={() => setBundleActiveTab("overview")}
            className={cn(
              "pb-2.5 transition-colors cursor-pointer border-b-2 -mb-[1px]",
              bundleActiveTab === "overview"
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
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
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
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
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t("tabSkills")} · {bundleSubSkills.length}
          </button>
        </div>

        {/* Tab 1: OVERVIEW */}
        {bundleActiveTab === "overview" && (
          <div className="max-w-3xl flex flex-col gap-6 pt-2">
            <div
              className="prose dark:prose-invert max-w-none text-xs leading-relaxed select-text [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h2]:text-xs [&_h2]:font-semibold [&_h2]:mt-2.5 [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_code]:font-mono [&_code]:text-[11px] [&_code]:bg-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded-md [&_strong]:text-foreground"
              dangerouslySetInnerHTML={{
                __html: marked.parse(selectedBundle.overview || selectedBundle.description) as string,
              }}
            />

            {/* Skills included list */}
            <div className="flex flex-col gap-2 pt-2">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Included Skills ({bundleSubSkills.length})
              </span>
              <div className="flex flex-col divide-y divide-border/60 border border-border rounded-2xl bg-card overflow-hidden shadow-2xs">
                {bundleSubSkills.map((sub) => (
                  <div
                    key={sub.id}
                    onClick={() => {
                      setSelectedSkill(sub);
                      setOriginBundle(selectedBundle);
                      setViewMode("skill-detail");
                    }}
                    className="p-3.5 hover:bg-secondary/60 transition-colors cursor-pointer flex items-start gap-3 group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-secondary border border-border flex items-center justify-center text-muted-foreground shrink-0 mt-0.5 group-hover:border-primary/40 transition-colors">
                      <FileCode className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          {sub.name}
                        </span>
                        <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-md bg-secondary border border-border/60 text-muted-foreground">
                          /{sub.slug}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                        {sub.description}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-2 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: CONTENT (Split Pane) */}
        {bundleActiveTab === "content" && (
          <div className="w-full h-[520px] rounded-2xl border border-border overflow-hidden flex bg-card shadow-2xs">
            {/* Left File Tree Sidebar */}
            <div className="w-56 shrink-0 border-r border-border bg-secondary/30 flex flex-col">
              <div className="px-3.5 py-2.5 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
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
                            ? "bg-primary text-primary-foreground font-medium"
                            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
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
            <div className="flex-1 min-w-0 flex flex-col bg-card">
              {/* File header bar */}
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between gap-3">
                <span className="text-xs font-mono font-medium text-foreground truncate">
                  /{selectedFileName}
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  {selectedFileName.endsWith(".md") || selectedFileName.endsWith(".markdown") || selectedFileName === "README.md" || selectedFileName === "SKILL.md" ? (
                    <div className="flex items-center rounded-lg bg-muted/70 border border-border p-0.5">
                      <button
                        type="button"
                        onClick={() => setContentViewMode("preview")}
                        className={cn(
                          "p-1 rounded-md text-xs transition-colors cursor-pointer flex items-center gap-1 px-2",
                          contentViewMode === "preview"
                            ? "bg-background text-foreground shadow-2xs font-medium"
                            : "text-muted-foreground hover:text-foreground"
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
                            ? "bg-background text-foreground shadow-2xs font-medium"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        title="Raw Code"
                      >
                        <Code className="w-3.5 h-3.5" />
                        <span className="text-[11px]">{t("rawCodeMode")}</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] font-mono font-semibold uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                      {selectedFileName.split(".").pop() || "code"}
                    </span>
                  )}

                  {/* Copy button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyContent(activeFileContent)}
                    className="h-7 w-7 p-0 rounded-lg border-border text-muted-foreground hover:text-foreground cursor-pointer shadow-none"
                    title={t("copyCode")}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Viewer body */}
              <ScrollArea className="flex-1 p-5">
                {selectedFileName.endsWith(".md") || selectedFileName.endsWith(".markdown") || selectedFileName === "README.md" || selectedFileName === "SKILL.md" ? (
                  contentViewMode === "preview" ? (
                    <div
                      className="prose dark:prose-invert max-w-none text-xs leading-relaxed select-text [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_pre]:p-0 [&_pre]:bg-transparent [&_pre]:border-0 [&_code]:font-mono [&_code]:text-[11px] [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:p-1.5 [&_th]:bg-secondary/40 [&_td]:border [&_td]:border-border [&_td]:p-1.5"
                      dangerouslySetInnerHTML={{ __html: marked.parse(activeFileContent) as string }}
                    />
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

        {/* Tab 3: SKILLS */}
        {bundleActiveTab === "skills" && (
          <div className="max-w-3xl flex flex-col gap-3 pt-2">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Skills in this bundle ({bundleSubSkills.length})
            </span>
            <div className="flex flex-col divide-y divide-border/60 border border-border rounded-2xl bg-card overflow-hidden shadow-2xs">
              {bundleSubSkills.map((sub) => (
                <div
                  key={sub.id}
                  onClick={() => {
                    setSelectedSkill(sub);
                    setOriginBundle(selectedBundle);
                    setViewMode("skill-detail");
                  }}
                  className="p-3.5 hover:bg-secondary/60 transition-colors cursor-pointer flex items-start gap-3.5 group"
                >
                  <div className="w-8 h-8 rounded-xl bg-secondary border border-border flex items-center justify-center text-muted-foreground shrink-0 mt-0.5 group-hover:border-primary/40 transition-colors">
                    <FileCode className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-foreground">
                        {sub.name}
                      </span>
                      <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-md bg-secondary border border-border/60 text-muted-foreground">
                        /{sub.slug}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                      {sub.description}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-2 group-hover:translate-x-0.5 transition-transform" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: VIEW 2 — SINGLE SKILL DETAIL (Image 2)
  // ---------------------------------------------------------------------------
  if (viewMode === "skill-detail" && selectedSkill) {
    const activeFileContent = skillFilesMap[selectedFileName] || selectedSkill.content || "";
    const filesList = Object.keys(skillFilesMap);

    return (
      <div className="w-full flex flex-col space-y-6 font-sans select-none">
        {/* Top Back Navigation Bar */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (originBundle) {
                setSelectedBundle(originBundle);
                setViewMode("bundle-detail");
              } else {
                setViewMode("list");
              }
            }}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer -ml-2 h-8"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{originBundle ? originBundle.name : t("backToSkills")}</span>
          </Button>

          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Skill Header Strip */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-serif text-2xl sm:text-3xl font-normal tracking-tight text-foreground truncate">
                {selectedSkill.name}
              </h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-secondary border border-border/60 text-muted-foreground">
                /{selectedSkill.slug}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
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

          {/* Action button: Enabled Switch */}
          <div className="shrink-0 flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {selectedSkill.isEnabled ? "Enabled" : "Disabled"}
            </span>
            <Switch
              checked={selectedSkill.isEnabled}
              onCheckedChange={(checked) => handleToggleSkill(selectedSkill.id, checked)}
            />
          </div>
        </div>

        {/* 2 Tabs Row (Overview, Content · N) */}
        <div className="border-b border-border flex items-center gap-6 text-xs font-medium">
          <button
            type="button"
            onClick={() => setSkillActiveTab("overview")}
            className={cn(
              "pb-2.5 transition-colors cursor-pointer border-b-2 -mb-[1px]",
              skillActiveTab === "overview"
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
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
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t("tabContent")} · {filesList.length}
          </button>
        </div>

        {/* Tab 1: OVERVIEW */}
        {skillActiveTab === "overview" && (
          <div className="max-w-3xl flex flex-col gap-6 pt-2">
            {selectedSkill.overview && (
              <div>
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-2">
                  {t("tabOverview")}
                </span>
                <div
                  className="prose dark:prose-invert max-w-none text-xs leading-relaxed select-text [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-4 [&_code]:font-mono [&_code]:text-[11px] [&_code]:bg-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded-md [&_strong]:text-foreground"
                  dangerouslySetInnerHTML={{ __html: marked.parse(selectedSkill.overview) as string }}
                />
              </div>
            )}

            {/* Slash Command Usage card */}
            <div className="p-4 rounded-2xl bg-card border border-border flex flex-col gap-2 shadow-2xs">
              <span className="text-xs font-semibold text-foreground">
                {t("slashCommandSkills")}
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Trigger this skill manually by starting your message with{" "}
                <code className="font-mono text-foreground px-1.5 py-0.5 rounded-md bg-secondary border border-border/60">
                  /{selectedSkill.slug}
                </code>
                , or let Const AI autonomously choose and apply it when relevant to your study request.
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: CONTENT (Split Pane) */}
        {skillActiveTab === "content" && (
          <div className="w-full h-[520px] rounded-2xl border border-border overflow-hidden flex bg-card shadow-2xs">
            {/* Left File Tree Sidebar */}
            <div className="w-52 shrink-0 border-r border-border bg-secondary/30 flex flex-col">
              <div className="px-3.5 py-2.5 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Files ({filesList.length})
              </div>
              <ScrollArea className="flex-1 p-2">
                <div className="flex flex-col gap-0.5">
                  {filesList.map((fileName) => {
                    const isSelected = selectedFileName === fileName;
                    const isPy = fileName.endsWith(".py");
                    return (
                      <button
                        key={fileName}
                        type="button"
                        onClick={() => setSelectedFileName(fileName)}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center gap-2 transition-colors cursor-pointer truncate",
                          isSelected
                            ? "bg-primary text-primary-foreground font-medium"
                            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                        )}
                      >
                        {isPy ? (
                          <Code className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span className="truncate">{fileName}</span>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Right Content Viewer */}
            <div className="flex-1 min-w-0 flex flex-col bg-card">
              {/* Header bar */}
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between gap-3">
                <span className="text-xs font-mono font-medium text-foreground truncate">
                  /{selectedFileName || "SKILL.md"}
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  {selectedFileName.endsWith(".md") || selectedFileName.endsWith(".markdown") || selectedFileName === "README.md" || selectedFileName === "SKILL.md" ? (
                    <div className="flex items-center rounded-lg bg-muted/70 border border-border p-0.5">
                      <button
                        type="button"
                        onClick={() => setContentViewMode("preview")}
                        className={cn(
                          "p-1 rounded-md text-xs transition-colors cursor-pointer flex items-center gap-1 px-2",
                          contentViewMode === "preview"
                            ? "bg-background text-foreground shadow-2xs font-medium"
                            : "text-muted-foreground hover:text-foreground"
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
                            ? "bg-background text-foreground shadow-2xs font-medium"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        title="Raw Code"
                      >
                        <Code className="w-3.5 h-3.5" />
                        <span className="text-[11px]">{t("rawCodeMode")}</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] font-mono font-semibold uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                      {selectedFileName.split(".").pop() || "code"}
                    </span>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyContent(activeFileContent)}
                    className="h-7 w-7 p-0 rounded-lg border-border text-muted-foreground hover:text-foreground cursor-pointer shadow-none"
                    title={t("copyCode")}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Viewer body */}
              <ScrollArea className="flex-1 p-5">
                {selectedFileName.endsWith(".md") || selectedFileName.endsWith(".markdown") || selectedFileName === "README.md" || selectedFileName === "SKILL.md" ? (
                  contentViewMode === "preview" ? (
                    <div
                      className="prose dark:prose-invert max-w-none text-xs leading-relaxed select-text [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_pre]:p-0 [&_pre]:bg-transparent [&_pre]:border-0 [&_code]:font-mono [&_code]:text-[11px] [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:p-1.5 [&_th]:bg-secondary/40 [&_td]:border [&_td]:border-border [&_td]:p-1.5"
                      dangerouslySetInnerHTML={{ __html: marked.parse(activeFileContent) as string }}
                    />
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
  // RENDER: VIEW 0 — MAIN SKILLS & BUNDLES LIST
  // ---------------------------------------------------------------------------
  return (
    <div className="w-full flex flex-col space-y-6 font-sans select-none">
      {/* 1. Header Section - Strict match with sources-view, models-view & learn-home */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            {!isSidebarOpen && onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                className="p-1.5 -ml-1 rounded-xl bg-muted hover:bg-secondary text-muted-foreground hover:text-foreground transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-none"
                title="Open sidebar"
                aria-label="Open sidebar"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            )}
            <h1 className="font-serif text-2xl sm:text-3xl font-normal tracking-tight text-foreground">
              {t("skillsTitle")}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-sans tabular-nums">
              {skills.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("skillsSubtitle")}
          </p>
        </div>

        {/* Search Bar & Primary Actions */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchSkills")}
              className="h-8 w-44 sm:w-56 pl-8 pr-7 text-xs rounded-xl bg-card border-border text-foreground placeholder-muted-foreground focus-visible:ring-1 focus-visible:ring-primary/40 shadow-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Upload Skill Button (Primary) */}
          <Button
            size="sm"
            onClick={() => setViewMode("upload")}
            className="h-8 px-3.5 rounded-xl text-xs font-medium gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-none"
          >
            <Upload className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>{t("uploadBtn")}</span>
          </Button>

          {/* More Options Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-8 w-8 rounded-xl border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center cursor-pointer shadow-none"
                title={t("moreOptions")}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 bg-card border-border text-foreground p-1 rounded-xl shadow-xl"
            >
              <DropdownMenuItem
                onClick={() => setIsManualCreateOpen(true)}
                className="text-xs px-3 py-2 rounded-lg cursor-pointer hover:bg-secondary/70 focus:bg-secondary/70 flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Create from Scratch</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => ensureDefaultSkillsSeeded()}
                className="text-xs px-3 py-2 rounded-lg cursor-pointer hover:bg-secondary/70 focus:bg-secondary/70 flex items-center gap-2"
              >
                <RotateCw className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{t("update")}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onClick={handleResetToDefault}
                className="text-xs px-3 py-2 rounded-lg cursor-pointer text-amber-500 hover:text-amber-400 hover:bg-secondary/70 focus:bg-secondary/70 flex items-center gap-2"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>{t("resetSkills")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Scope Switcher Sliding Pill */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative flex items-center h-9 p-0.5 rounded-xl bg-muted/70 border border-border w-fit">
          <div
            className="absolute top-0.5 bottom-0.5 left-0 rounded-lg bg-background shadow-2xs pointer-events-none transition-all duration-300"
            style={{
              transform: `translateX(${scopeIndicatorStyle.left}px)`,
              width: `${scopeIndicatorStyle.width}px`,
              opacity: scopeIndicatorStyle.width > 0 ? 1 : 0,
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />

          <button
            ref={allScopeRef}
            type="button"
            onClick={() => setSelectedScope("all")}
            className={cn(
              "relative z-10 px-4 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none flex items-center justify-center",
              selectedScope === "all"
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t("allScope") || "All"}
          </button>
          <button
            ref={userScopeRef}
            type="button"
            onClick={() => setSelectedScope("user")}
            className={cn(
              "relative z-10 px-4 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none flex items-center justify-center",
              selectedScope === "user"
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t("userScope") || "Personal"}
          </button>
          <button
            ref={workspaceScopeRef}
            type="button"
            onClick={() => setSelectedScope("workspace")}
            className={cn(
              "relative z-10 px-4 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none flex items-center justify-center",
              selectedScope === "workspace"
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t("workspaceScope") || "Workspace"}
          </button>
        </div>
      </div>

      {/* 3. Main List Content (Natural scroll flowing with parent page) */}
      {filteredSkills.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 rounded-2xl border border-dashed border-border bg-card/40 text-center space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-secondary border border-border flex items-center justify-center mx-auto text-muted-foreground">
            <PencilSparkles className="w-5 h-5 stroke-[1.5]" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="font-serif text-lg text-foreground font-medium">
              {t("noSkillsFound")}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("noSkillsFoundDesc")}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setViewMode("upload")}
            className="h-8 px-3.5 rounded-xl text-xs font-medium gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-none"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{t("uploadSkillTitle")}</span>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>{filteredSkills.length} skills</span>
          </div>
          <div className="flex flex-col divide-y divide-border border border-border rounded-2xl bg-card overflow-hidden shadow-none">
            {filteredSkills.map((skill) => {
              return (
                <div
                  key={skill.id}
                  className="flex items-center justify-between gap-4 p-3 hover:bg-secondary/60 transition-colors group cursor-pointer"
                  onClick={() => {
                    setSelectedSkill(skill);
                    setOriginBundle(null);
                    setSkillActiveTab("overview");
                    setViewMode("skill-detail");
                  }}
                >
                  {/* Skill Item Info (No icon, No description) */}
                  <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                    <span className="text-xs font-semibold text-foreground tracking-tight">
                      {skill.name}
                    </span>
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-secondary border border-border text-muted-foreground">
                      /{skill.slug}
                    </span>
                    {skill.author && (
                      <span className="text-[10px] text-muted-foreground">
                        by @{skill.author}
                      </span>
                    )}
                    {!skill.isBuiltIn && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                        {t("customBadge")}
                      </span>
                    )}
                  </div>

                  {/* Right: Switch & Actions */}
                  <div
                    className="flex items-center gap-3 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Switch
                      checked={skill.isEnabled}
                      onCheckedChange={(checked) => handleToggleSkill(skill.id, checked)}
                    />
                    <ChevronRight
                      onClick={() => {
                        setSelectedSkill(skill);
                        setOriginBundle(null);
                        setSkillActiveTab("overview");
                        setViewMode("skill-detail");
                      }}
                      className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all cursor-pointer"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Manual Create Dialog (Scratch Fallback) */}
      {isManualCreateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setIsManualCreateOpen(false)}
        >
          <div
            className="w-[560px] max-w-[95vw] max-h-[85vh] bg-card border border-border rounded-2xl flex flex-col overflow-hidden text-foreground shadow-2xl animate-in zoom-in-[0.985] duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Create Skill from Scratch
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Write customized instructions and prompt triggers for your agent.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsManualCreateOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleManualSave} className="flex-1 min-h-0 flex flex-col">
              <ScrollArea className="flex-1 p-5">
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground">
                        {t("skillName")} *
                      </label>
                      <Input
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
                        className="h-8 px-2.5 text-xs bg-secondary/30 border-border text-foreground rounded-xl"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground">
                        {t("skillSlug")} *
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-2.5 text-xs text-muted-foreground font-mono">
                          /
                        </span>
                        <Input
                          type="text"
                          required
                          value={manualSlug}
                          onChange={(e) => setManualSlug(e.target.value)}
                          placeholder="code-review"
                          className="h-8 pl-6 pr-2.5 text-xs font-mono bg-secondary/30 border-border text-foreground rounded-xl"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">
                      {t("skillDescription")}
                    </label>
                    <Input
                      type="text"
                      value={manualDescription}
                      onChange={(e) => setManualDescription(e.target.value)}
                      placeholder="Summary of when AI should trigger this skill..."
                      className="h-8 px-2.5 text-xs bg-secondary/30 border-border text-foreground rounded-xl"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">
                      {t("skillContent")}
                    </label>
                    <textarea
                      rows={8}
                      value={manualContent}
                      onChange={(e) => setManualContent(e.target.value)}
                      placeholder="# Skill Instructions&#10;&#10;Explain step-by-step rules and prompt instructions here..."
                      className="w-full p-3 text-xs font-mono bg-secondary/30 border border-border rounded-xl text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground/30 resize-y"
                    />
                  </div>
                </div>
              </ScrollArea>

              <div className="p-4 border-t border-border flex items-center justify-end gap-2 bg-secondary/20">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsManualCreateOpen(false)}
                  className="rounded-xl border-border text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {t("cancel")}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-none"
                >
                  {t("saveSkill")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmSkill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setDeleteConfirmSkill(null)}
        >
          <div
            className="w-96 max-w-[90vw] bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 text-foreground shadow-2xl animate-in zoom-in-[0.985] duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  {t("deleteSkillConfirm")}
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("deleteSkillConfirmDesc", { name: deleteConfirmSkill.name })}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirmSkill(null)}
                className="rounded-xl border-border text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {t("cancel")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={async () => {
                  try {
                    await localDb.deleteSkill(deleteConfirmSkill.id);
                    toast.success(t("skillDeletedSuccess"));
                    setDeleteConfirmSkill(null);
                  } catch (err: any) {
                    toast.error(err?.message || "Failed to delete skill");
                  }
                }}
                className="rounded-xl cursor-pointer"
              >
                {t("delete")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { SkillsSettings as SkillsView };

