import { app, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

export interface InstalledSkillRecord {
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
    // Automatically ensure default essential skills (docx, pdf, pptx) are pre-installed
    void this.ensureDefaultSkillsInstalled();
  }

  public getGlobalSkillsDir(): string {
    return this.globalSkillsDir;
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

  public async ensureDefaultSkillsInstalled(): Promise<void> {
    const defaultSlugs = ["docx", "pdf", "pptx", "computer-use"];
    for (const slug of defaultSlugs) {
      const destDir = path.join(this.globalSkillsDir, slug);
      const skillMd = path.join(destDir, "SKILL.md");
      if (!fs.existsSync(destDir) || !fs.existsSync(skillMd)) {
        try {
          await this.installSkill(slug, "user");
          console.log(`[MarketplaceService] Pre-installed default skill: ${slug}`);
        } catch (err) {
          console.warn(`[MarketplaceService] Failed to pre-install default skill ${slug}:`, err);
        }
      }
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
    const results: InstalledSkillRecord[] = [];
    const seenSlugs = new Set<string>();

    // 1. Workspace skills (highest priority)
    if (workspacePath && workspacePath !== "Outside Project") {
      const wsAgentsSkills = path.join(workspacePath, ".agents", "skills");
      const wsConstSkills = path.join(workspacePath, ".const", "skills");
      for (const dir of [wsAgentsSkills, wsConstSkills]) {
        if (fs.existsSync(dir)) {
          this.scanSkillsDirectory(dir, "workspace", results, seenSlugs);
        }
      }
    }

    // 2. Global skills (~/.const/harness/skills)
    if (fs.existsSync(this.globalSkillsDir)) {
      this.scanSkillsDirectory(this.globalSkillsDir, "user", results, seenSlugs);
    }

    // 3. User standard agents skills (~/.agents/skills)
    const userAgentsDir = path.join(os.homedir(), ".agents", "skills");
    if (fs.existsSync(userAgentsDir)) {
      this.scanSkillsDirectory(userAgentsDir, "user", results, seenSlugs);
    }

    return results;
  }

  public async getSkillContent(
    slug: string,
    workspacePath?: string
  ): Promise<SkillContentResult | null> {
    const cleanSlug = slug.toLowerCase().trim();

    // 1. Workspace installed
    if (workspacePath && workspacePath !== "Outside Project") {
      const wsDir = path.join(workspacePath, ".agents", "skills", cleanSlug);
      if (fs.existsSync(path.join(wsDir, "SKILL.md"))) {
        return this.loadSkillDetailsFromDir(wsDir, cleanSlug, true, "workspace");
      }
    }

    // 2. Global installed (~/.const/harness/skills/<slug>)
    const userDir = path.join(this.globalSkillsDir, cleanSlug);
    if (fs.existsSync(path.join(userDir, "SKILL.md"))) {
      return this.loadSkillDetailsFromDir(userDir, cleanSlug, true, "user");
    }

    // 3. User .agents/skills
    const agentDir = path.join(os.homedir(), ".agents", "skills", cleanSlug);
    if (fs.existsSync(path.join(agentDir, "SKILL.md"))) {
      return this.loadSkillDetailsFromDir(agentDir, cleanSlug, true, "user");
    }

    // 4. Bundled repository / catalog source
    const bundledDir = path.join(this.getBundledSkillsDir(), cleanSlug);
    if (fs.existsSync(path.join(bundledDir, "SKILL.md"))) {
      return this.loadSkillDetailsFromDir(bundledDir, cleanSlug, false);
    }

    // 5. Remote fetch fallback
    try {
      const baseUrl = this.getRemoteRegistryBaseUrl();
      const skillMdUrl = `${baseUrl}/${cleanSlug}/SKILL.md`;
      const resp = await fetch(skillMdUrl, { signal: AbortSignal.timeout(10000) });
      if (resp.ok) {
        const content = await resp.text();
        const parsed = this.parseFrontmatter(content);
        return {
          slug: cleanSlug,
          name: parsed.name || cleanSlug,
          description: parsed.description || "Agent skill.",
          content,
          author: parsed.author,
          version: parsed.version || "1.0.0",
          files: { "SKILL.md": content },
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

  private scanSkillsDirectory(
    dir: string,
    scope: "user" | "workspace",
    results: InstalledSkillRecord[],
    seenSlugs: Set<string>
  ): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const slug = entry.name.toLowerCase().trim();
        if (seenSlugs.has(slug)) continue;

        const skillDirPath = path.join(dir, entry.name);
        const skillMdPath = path.join(skillDirPath, "SKILL.md");
        if (!fs.existsSync(skillMdPath)) continue;

        try {
          const content = fs.readFileSync(skillMdPath, "utf8");
          const parsed = this.parseFrontmatter(content);
          const files = this.readSkillFiles(skillDirPath);

          seenSlugs.add(slug);
          results.push({
            slug,
            name: parsed.name || entry.name,
            description: parsed.description || "Installed agent skill.",
            content,
            path: skillDirPath,
            scope,
            author: parsed.author,
            version: parsed.version || "1.0.0",
            files,
          });
        } catch (err) {
          console.warn(`[MarketplaceService] Error reading skill ${slug}:`, err);
        }
      }
    } catch (err) {
      console.warn(`[MarketplaceService] Failed to scan ${dir}:`, err);
    }
  }

  public async installSkill(
    slug: string,
    targetScope: "user" | "workspace" = "user",
    workspacePath?: string
  ): Promise<InstalledSkillRecord | null> {
    const cleanSlug = slug.toLowerCase().trim();

    // Check candidate sources for real skill files locally
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

    const targetBaseDir =
      targetScope === "workspace" && workspacePath && workspacePath !== "Outside Project"
        ? path.join(workspacePath, ".agents", "skills")
        : this.globalSkillsDir;

    if (!fs.existsSync(targetBaseDir)) {
      fs.mkdirSync(targetBaseDir, { recursive: true });
    }

    const destDir = path.join(targetBaseDir, cleanSlug);

    if (sourceDir && fs.existsSync(sourceDir)) {
      // Copy directory recursively with all real files
      this.copyDirRecursive(sourceDir, destDir);
    } else {
      console.log(`[MarketplaceService] Local source not found for '${cleanSlug}', downloading from registry...`);
      const downloaded = await this.downloadSkillFromRemote(cleanSlug, destDir);
      if (!downloaded) {
        console.error(
          `[MarketplaceService] Cannot install '${cleanSlug}': source directory not found locally and remote download failed`
        );
        return null;
      }
    }

    const skillMdPath = path.join(destDir, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) return null;

    const content = fs.readFileSync(skillMdPath, "utf8");
    const parsed = this.parseFrontmatter(content);
    const files = this.readSkillFiles(destDir);

    return {
      slug: cleanSlug,
      name: parsed.name || cleanSlug,
      description: parsed.description || "Installed agent skill.",
      content,
      path: destDir,
      scope: targetScope,
      author: parsed.author,
      version: parsed.version || "1.0.0",
      files,
    };
  }

  public uninstallSkill(
    slug: string,
    scope: "user" | "workspace" = "user",
    workspacePath?: string
  ): boolean {
    const cleanSlug = slug.toLowerCase().trim();
    const targetBaseDir =
      scope === "workspace" && workspacePath && workspacePath !== "Outside Project"
        ? path.join(workspacePath, ".agents", "skills")
        : this.globalSkillsDir;

    const destDir = path.join(targetBaseDir, cleanSlug);
    if (fs.existsSync(destDir)) {
      try {
        fs.rmSync(destDir, { recursive: true, force: true });
        return true;
      } catch (err) {
        console.error(`[MarketplaceService] Failed to delete ${destDir}:`, err);
        return false;
      }
    }
    return false;
  }

  private readSkillFiles(dir: string, prefix = ""): Record<string, string> {
    const files: Record<string, string> = {};
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
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
