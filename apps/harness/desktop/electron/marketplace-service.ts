import { app, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { installRemoteSkill, resolveRemoteSkill, installError } from "./skill-installer";
import type { SkillSource, ResolvedRemoteSkill } from "./skill-installer";
import type { SkillInstallProgress } from "../src/lib/skills/types";
import { resolveSkillRegistry, readPluginManifest, installPluginFromDirectory, setCapabilityEnabled, uninstallRegisteredSkill, uninstallPlugin as removePlugin } from "@const/agent";
import type { PluginInventory } from "../src/lib/plugins/types";
import { initializeDefaultPlugins } from "./mcp/default-plugins";

export interface InstalledSkillRecord {
  sourceId?: string;
  source?: string;
  sourceSkillId?: string;
  id: string;
  isEnabled: boolean;
  workspacePath?: string;
  pluginId?: string;
  pluginName?: string;
  slug: string;
  name: string;
  description: string;
  content: string;
  path: string;
  scope: "user" | "workspace";
  author?: string;
  version?: string;
  files?: Record<string, string>;
}

export interface SkillContentResult {
  slug: string;
  name: string;
  description: string;
  content: string;
  author?: string;
  version?: string;
  files: Record<string, string>;
  isInstalled: boolean;
  scope?: "user" | "workspace";
}

interface SkillManifestEntry {
  id: string;
  slug: string;
  name: string;
  description: string;
  category?: string;
  author?: string;
  version?: string;
  icon?: string;
  files?: string[];
}

interface SkillManifest {
  version: string;
  skills: SkillManifestEntry[];
}

export class MarketplaceService {
  private globalSkillsDir: string;

  constructor() {
    this.globalSkillsDir = path.join(os.homedir(), ".const", "harness", "skills");
    if (!fs.existsSync(this.globalSkillsDir)) {
      try {
        fs.mkdirSync(this.globalSkillsDir, { recursive: true });
      } catch (err) {
        console.error("[MarketplaceService] Failed to create global skills dir:", err);
      }
    }
    // Defaults are installed once; uninstalling one must survive an app restart.
    void this.ensureDefaultPluginsInstalled();
  }

  public getBundledSkillsDir(): string {
    const candidates = [
      path.join(process.resourcesPath, "skills"),
      path.join(app.getAppPath(), "skills"),
      path.join(app.getAppPath(), "..", "skills"),
      path.join(__dirname, "..", "skills"),
      path.join(__dirname, "..", "..", "skills"),
      path.join(process.cwd(), "apps", "harness", "desktop", "skills"),
      path.join(process.cwd(), "skills"),
      path.join(process.cwd(), ".agents", "skills"),
      path.join(os.homedir(), ".agents", "skills"),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return candidates[0]!;
  }

  private getManifest(): SkillManifest | null {
    const candidates = [
      path.join(this.getBundledSkillsDir(), "index.json"),
      path.join(this.getBundledSkillsDir(), "skills-manifest.json"),
      path.join(app.getAppPath(), "skills", "index.json"),
      path.join(process.resourcesPath, "skills", "index.json"),
      path.join(__dirname, "..", "src", "lib", "skills", "skills-manifest.json"),
      path.join(process.cwd(), "apps", "harness", "desktop", "src", "lib", "skills", "skills-manifest.json"),
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        try {
          return JSON.parse(fs.readFileSync(cand, "utf8")) as SkillManifest;
        } catch {}
      }
    }
    return null;
  }

  private getRemoteRegistryBaseUrl(): string {
    return (
      process.env.CONST_SKILLS_REGISTRY_BASE_URL ||
      "https://raw.githubusercontent.com/alifconstantine/const/main/.agents/skills"
    );
  }

  private async downloadSkillFromRemote(slug: string, destDir: string): Promise<boolean> {
    const cleanSlug = slug.toLowerCase().trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) throw new Error("Invalid skill name.");
    const manifest = this.getManifest();
    const matched = manifest?.skills?.find((s) => s.slug === cleanSlug);
    const filesToDownload = matched?.files && matched.files.length > 0 ? matched.files : ["SKILL.md"];
    const baseUrl = this.getRemoteRegistryBaseUrl();

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    for (const relFile of filesToDownload) {
      const fileUrl = `${baseUrl}/${cleanSlug}/${relFile}`;
      const targetFilePath = path.join(destDir, relFile);
      try {
        const resp = await fetch(fileUrl, { signal: AbortSignal.timeout(15000) });
        if (resp.ok) {
          const text = await resp.text();
          fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
          fs.writeFileSync(targetFilePath, text, "utf8");
        } else {
          console.warn(`[MarketplaceService] Remote fetch returned ${resp.status} for ${fileUrl}`);
        }
      } catch (err) {
        console.warn(`[MarketplaceService] Failed to download ${fileUrl}:`, err);
      }
    }

    const skillMdPath = path.join(destDir, "SKILL.md");
    if (fs.existsSync(skillMdPath)) {
      return true;
    }

    // Cleanup if SKILL.md could not be downloaded
    try {
      fs.rmSync(destDir, { recursive: true, force: true });
    } catch {}
    return false;
  }

  private activeInstalls = new Map<string, AbortController>();
  private activeDestinations = new Set<string>();
  private resolvedSkills = new Map<string, { expires: number; skill: ResolvedRemoteSkill }>();

  private async resolveRemote(source: string, skillId: string, signal?: AbortSignal) {
    const key = `${source}/${skillId}`;
    const cached = this.resolvedSkills.get(key);
    if (cached && cached.expires > Date.now()) return cached.skill;
    const skill = await resolveRemoteSkill(source, skillId, signal);
    if (this.resolvedSkills.size >= 30) this.resolvedSkills.delete(this.resolvedSkills.keys().next().value!);
    this.resolvedSkills.set(key, { skill, expires: Date.now() + 5 * 60_000 });
    return skill;
  }

  public cancelSkillInstall(requestId: string): void {
    this.activeInstalls.get(requestId)?.abort();
  }

  public async previewRemoteSkill(source: string, skillId: string) {
    const skill = await this.resolveRemote(source, skillId);
    const parsed = this.parseFrontmatter(skill.content);
    return { ...parsed, content: skill.content, files: { "SKILL.md": skill.content } };
  }

  public async ensureDefaultPluginsInstalled(): Promise<void> {
    try {
      const inventory = this.listPlugins();
      initializeDefaultPlugins(path.join(os.homedir(), ".const", "harness"), inventory.catalog, inventory.installed,
        (name) => this.installPlugin(name, "user"));
    } catch (err) {
      console.warn("[MarketplaceService] Failed to initialize default plugins:", err);
    }
  }

  public openSkillsFolder(workspacePath?: string, scope: "user" | "workspace" = "user"): Promise<string> {
    const targetDir =
      scope === "workspace" && workspacePath && workspacePath !== "Outside Project"
        ? path.join(workspacePath, ".agents", "skills")
        : this.globalSkillsDir;

    if (!fs.existsSync(targetDir)) {
      try {
        fs.mkdirSync(targetDir, { recursive: true });
      } catch {}
    }
    return shell.openPath(targetDir);
  }

  public listInstalledSkills(workspacePath?: string): InstalledSkillRecord[] {
    return resolveSkillRegistry(workspacePath).skills.map((skill) => {
      let source: Partial<SkillSource> = {};
      try { source = JSON.parse(fs.readFileSync(path.join(skill.path, ".const-source.json"), "utf8")); } catch {}
      return { ...skill, sourceId: source.sourceId, source: source.source, sourceSkillId: source.sourceSkillId, files: undefined };
    });
  }

  private getBundledPluginsDir(): string {
    const candidates = [
      path.join(process.resourcesPath, "plugins"),
      path.join(app.getAppPath(), "plugins"),
      path.join(__dirname, "..", "plugins"),
      path.join(process.cwd(), "apps", "harness", "desktop", "plugins"),
    ];
    const root = candidates.find((candidate) =>
      fs.existsSync(candidate) &&
      fs.readdirSync(candidate, { withFileTypes: true }).some(
        (entry) => entry.isDirectory() && fs.existsSync(path.join(candidate, entry.name, "plugin.json"))
      )
    );
    if (!root) throw new Error("Bundled plugins are unavailable.");
    return root;
  }

  public listPlugins(workspacePath?: string): PluginInventory {
    const root = this.getBundledPluginsDir();
    const catalog = fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => {
      const dir = path.join(root, entry.name);
      const manifest = readPluginManifest(dir);
      const skillsDir = path.join(dir, "skills");
      const skillSlugs = fs.existsSync(skillsDir)
        ? fs.readdirSync(skillsDir).filter((slug) => fs.existsSync(path.join(skillsDir, slug, "SKILL.md"))).sort()
        : [];
      const skills = skillSlugs.map((slug) => {
        try {
          const fileContent = fs.readFileSync(path.join(skillsDir, slug, "SKILL.md"), "utf8");
          const parsed = this.parseFrontmatter(fileContent);
          return {
            slug,
            name: parsed.name || slug,
            description: parsed.description || "",
          };
        } catch {
          return { slug, name: slug, description: "" };
        }
      });
      let mcpServers: Record<string, any> | undefined = undefined;
      let overview: string | undefined = undefined;
      try {
        const rawJson = JSON.parse(fs.readFileSync(path.join(dir, "plugin.json"), "utf8"));
        mcpServers = rawJson.mcpServers || rawJson.mcp;
        overview = rawJson.overview;
      } catch {}
      if (!overview && fs.existsSync(path.join(dir, "README.md"))) {
        try {
          overview = fs.readFileSync(path.join(dir, "README.md"), "utf8");
        } catch {}
      }
      if (!mcpServers && fs.existsSync(path.join(dir, "mcp.json"))) {
        try {
          mcpServers = JSON.parse(fs.readFileSync(path.join(dir, "mcp.json"), "utf8"));
        } catch {}
      }
      return { ...manifest, skillSlugs, skills, overview, mcpServers };
    });
    const installed = resolveSkillRegistry(workspacePath).plugins.map(({ skills, ...plugin }) => {
      const pluginDir = plugin.path;
      let mcpServers: Record<string, any> | undefined = undefined;
      let overview: string | undefined = undefined;
      try {
        const rawJson = JSON.parse(fs.readFileSync(path.join(pluginDir, "plugin.json"), "utf8"));
        mcpServers = rawJson.mcpServers || rawJson.mcp;
        overview = rawJson.overview;
      } catch {}
      if (!overview && fs.existsSync(path.join(pluginDir, "README.md"))) {
        try {
          overview = fs.readFileSync(path.join(pluginDir, "README.md"), "utf8");
        } catch {}
      }
      if (!mcpServers && fs.existsSync(path.join(pluginDir, "mcp.json"))) {
        try {
          mcpServers = JSON.parse(fs.readFileSync(path.join(pluginDir, "mcp.json"), "utf8"));
        } catch {}
      }
      return {
        ...plugin,
        skillSlugs: skills.map((skill) => (skill.slug.includes(":") ? skill.slug.split(":")[1]! : skill.slug)),
        skills: skills.map((skill) => ({
          slug: skill.slug.includes(":") ? skill.slug.split(":")[1]! : skill.slug,
          name: skill.name.includes(":") ? skill.name.split(":")[1]! : skill.name,
          description: skill.description || "",
        })),
        overview,
        mcpServers,
      };
    });
    return { catalog, installed };
  }

  public installPlugin(name: string, scope: "user" | "workspace", workspacePath?: string): void {
    if (!this.listPlugins(workspacePath).catalog.some((plugin) => plugin.name === name)) throw new Error("Unknown plugin.");
    installPluginFromDirectory(path.join(this.getBundledPluginsDir(), name), scope, workspacePath);
  }

  public nativeEnabled(name: "browser-use" | "computer-use", workspacePath?: string): boolean {
    return resolveSkillRegistry(workspacePath).plugins.some((plugin) => plugin.name === name && plugin.isEnabled && plugin.isEffective);
  }

  public setEnabled(id: string, enabled: boolean, workspacePath?: string): void {
    setCapabilityEnabled(id, enabled, workspacePath);
  }

  public uninstallPlugin(id: string, workspacePath?: string): void {
    removePlugin(id, workspacePath);
  }

  public async getSkillContent(
    slug: string,
    workspacePath?: string
  ): Promise<SkillContentResult | null> {
    const cleanSlug = slug.toLowerCase().trim();
    const rawSubSlug = cleanSlug.includes(":") ? cleanSlug.split(":").pop()! : cleanSlug;

    // 1. Registered / installed skills (standalone or inside installed plugins)
    const registered = resolveSkillRegistry(workspacePath).skills.find(
      (skill) =>
        skill.slug.toLowerCase() === cleanSlug ||
        skill.slug.toLowerCase().endsWith(":" + rawSubSlug) ||
        skill.slug.toLowerCase().split(":").pop() === rawSubSlug
    );
    if (registered) return this.loadSkillDetailsFromDir(registered.path, cleanSlug, true, registered.scope);

    // 2. Bundled repository / catalog standalone skills
    const bundledDir = path.join(this.getBundledSkillsDir(), rawSubSlug);
    if (fs.existsSync(path.join(bundledDir, "SKILL.md"))) {
      return this.loadSkillDetailsFromDir(bundledDir, cleanSlug, false);
    }

    // 3. Bundled plugins skills (whether installed or available)
    try {
      const bundledPluginsDir = this.getBundledPluginsDir();
      if (fs.existsSync(bundledPluginsDir)) {
        const pluginEntries = fs.readdirSync(bundledPluginsDir, { withFileTypes: true });
        for (const entry of pluginEntries) {
          if (!entry.isDirectory()) continue;
          const candidateDir = path.join(bundledPluginsDir, entry.name, "skills", rawSubSlug);
          if (fs.existsSync(path.join(candidateDir, "SKILL.md"))) {
            return this.loadSkillDetailsFromDir(candidateDir, cleanSlug, false);
          }
        }
      }
    } catch {}

    // 4. Remote fetch fallback
    try {
      const baseUrl = this.getRemoteRegistryBaseUrl();
      const skillMdUrl = `${baseUrl}/${rawSubSlug}/SKILL.md`;
      const resp = await fetch(skillMdUrl, { signal: AbortSignal.timeout(10000) });
      if (resp.ok) {
        const fileContent = await resp.text();
        const parsed = this.parseFrontmatter(fileContent);
        return {
          slug: cleanSlug,
          name: parsed.name || cleanSlug,
          description: parsed.description || "Agent skill.",
          content: fileContent,
          author: parsed.author,
          version: parsed.version || "1.0.0",
          files: { "SKILL.md": fileContent },
          isInstalled: false,
        };
      }
    } catch {}

    return null;
  }

  private loadSkillDetailsFromDir(
    dir: string,
    slug: string,
    isInstalled: boolean,
    scope?: "user" | "workspace"
  ): SkillContentResult {
    const skillMdPath = path.join(dir, "SKILL.md");
    const content = fs.readFileSync(skillMdPath, "utf8");
    const parsed = this.parseFrontmatter(content);
    const files = this.readSkillFiles(dir);

    return {
      slug,
      name: parsed.name || slug,
      description: parsed.description || "Agent skill.",
      content,
      author: parsed.author,
      version: parsed.version || "1.0.0",
      files,
      isInstalled,
      scope,
    };
  }

  public async installSkill(
    slug: string,
    targetScope: "user" | "workspace" = "user",
    workspacePath?: string,
    sourceRepo?: string,
    skillSubId?: string,
    requestId?: string,
    onProgress?: (progress: SkillInstallProgress) => void
  ): Promise<InstalledSkillRecord | null> {
    let cleanSlug = slug.toLowerCase().trim();
    let effectiveSource = sourceRepo;
    let effectiveSkillId = skillSubId;

    // Detect if slug is a composite GitHub identifier (e.g., "anthropics/skills/pdf" or "prisma/skills/prisma-cli")
    if (cleanSlug.includes("/") && !effectiveSource) {
      const parts = cleanSlug.split("/").filter(Boolean);
      if (parts.length >= 2) {
        effectiveSource = `${parts[0]}/${parts[1]}`;
        effectiveSkillId = parts[2] || parts[1];
        cleanSlug = effectiveSkillId || parts[1] || "skill";
      }
    }

    // Clean destination directory name
    cleanSlug = cleanSlug.replace(/[^a-z0-9_-]/g, "-").replace(/^-+|-+$/g, "");
    if (!cleanSlug) cleanSlug = "custom-skill";

    // Destination path
    if (targetScope === "workspace" && (!workspacePath || workspacePath === "Outside Project" || !path.isAbsolute(workspacePath))) {
      throw new Error("Workspace is required.");
    }
    const targetBaseDir =
      targetScope === "workspace" && workspacePath && workspacePath !== "Outside Project"
        ? path.join(workspacePath, ".agents", "skills")
        : this.globalSkillsDir;

    if (!fs.existsSync(targetBaseDir)) {
      fs.mkdirSync(targetBaseDir, { recursive: true });
    }

    const destDir = path.join(targetBaseDir, cleanSlug);

    if (effectiveSource) {
      const key = path.resolve(targetBaseDir, effectiveSkillId || cleanSlug).toLowerCase();
      if (this.activeDestinations.has(key) || (requestId && this.activeInstalls.has(requestId))) throw installError("busy");
      const controller = new AbortController();
      this.activeDestinations.add(key);
      if (requestId) this.activeInstalls.set(requestId, controller);
      const report = (progress: Omit<SkillInstallProgress, "requestId">) => {
        if (requestId) onProgress?.({ ...progress, requestId });
      };
      try {
        report({ phase: "resolving", completed: 0, total: 0 });
        const resolved = await this.resolveRemote(effectiveSource, effectiveSkillId || cleanSlug, controller.signal);
        const installedPath = await installRemoteSkill(resolved, targetBaseDir, report, controller.signal);
        const record = this.listInstalledSkills(targetScope === "workspace" ? workspacePath : undefined).find(skill => path.resolve(skill.path).toLowerCase() === path.resolve(installedPath).toLowerCase());
        if (!record) throw installError("invalid");
        return { ...record, files: this.readSkillFiles(installedPath) };
      } catch (error) {
        if (controller.signal.aborted) throw installError("cancelled");
        throw error;
      } finally {
        this.activeDestinations.delete(key);
        if (requestId) this.activeInstalls.delete(requestId);
      }
    } else {
      // 2. Check candidate local sources
      const candidates = [
        path.join(this.getBundledSkillsDir(), cleanSlug),
        path.join(process.cwd(), ".agents", "skills", cleanSlug),
        path.join(os.homedir(), ".agents", "skills", cleanSlug),
      ];
      let sourceDir: string | null = null;
      for (const c of candidates) {
        if (fs.existsSync(c) && fs.existsSync(path.join(c, "SKILL.md"))) {
          sourceDir = c;
          break;
        }
      }

      if (sourceDir && fs.existsSync(sourceDir)) {
        this.copyDirRecursive(sourceDir, destDir);
      } else {
        // 3. Fallback: try download from remote registry
        console.log(`[MarketplaceService] Local source not found for '${cleanSlug}', downloading from registry...`);
        const downloaded = await this.downloadSkillFromRemote(cleanSlug, destDir);
        if (!downloaded) {
          console.error(
            `[MarketplaceService] Cannot install '${cleanSlug}': source directory not found locally and remote download failed`
          );
          return null;
        }
      }
    }

    const skillMdPath = path.join(destDir, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) return null;

    const files = this.readSkillFiles(destDir);

    const record = this.listInstalledSkills(targetScope === "workspace" ? workspacePath : undefined).find(
      (skill) => skill.path === destDir
    );
    return record ? { ...record, files } : null;
  }

  public uninstallSkill(id: string, workspacePath?: string): boolean {
    uninstallRegisteredSkill(id, workspacePath);
    return true;
  }

  private readSkillFiles(dir: string, prefix = ""): Record<string, string> {
    const files: Record<string, string> = {};
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === ".const-source.json") continue;
        const fullPath = path.join(dir, entry.name);
        const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          if (entry.name !== "node_modules" && entry.name !== ".git") {
            Object.assign(files, this.readSkillFiles(fullPath, relPath));
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if ([".md", ".txt", ".json", ".yaml", ".yml", ".ts", ".js", ".py", ".xml"].includes(ext)) {
            const stat = fs.statSync(fullPath);
            if (stat.size < 250000) {
              files[relPath] = fs.readFileSync(fullPath, "utf8");
            }
          }
        }
      }
    } catch {}
    return files;
  }

  private copyDirRecursive(src: string, dest: string): void {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        this.copyDirRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  private parseFrontmatter(content: string): {
    name?: string;
    description?: string;
    author?: string;
    version?: string;
  } {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match || !match[1]) return {};
    const metaBlock = match[1];
    const meta: Record<string, string> = {};
    const lines = metaBlock.split(/\r?\n/);
    let currentKey: string | null = null;
    let multilineVal: string[] = [];

    for (const line of lines) {
      const keyMatch = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
      if (keyMatch && keyMatch[1] && keyMatch[2] !== undefined) {
        if (currentKey) {
          meta[currentKey] = multilineVal.join(" ").trim();
        }
        currentKey = keyMatch[1].toLowerCase();
        const val = keyMatch[2].trim();
        if (val === ">" || val === "|" || val === ">-" || val === "|-") {
          multilineVal = [];
        } else {
          multilineVal = [val.replace(/^['"]|['"]$/g, "")];
        }
      } else if (currentKey && (line.startsWith("  ") || line.startsWith("\t"))) {
        multilineVal.push(line.trim().replace(/^['"]|['"]$/g, ""));
      }
    }
    if (currentKey) {
      meta[currentKey] = multilineVal.join(" ").trim();
    }

    return {
      name: meta.name,
      description: meta.description,
      author: meta.author,
      version: meta.version,
    };
  }
}

export const marketplaceService = new MarketplaceService();
