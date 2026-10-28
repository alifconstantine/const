import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { parse } from "yaml";

export type CapabilityScope = "user" | "workspace";
export interface RegistryOptions {
  userRoot?: string;
  userSkillsDir?: string;
}
export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: { name: string };
  interface: { displayName: string; icon: string };
  entrypoint?: string;
  defaultInstalled?: boolean;
  placeholder?: boolean;
  nativeCapabilities?: Array<"browser-use" | "computer-use">;
  mcpServers?: Record<string, PluginMcpServer>;
  ui?: { chat?: string; panel?: string; sidebar?: boolean };
}
export interface PluginMcpServer {
  transport: "http" | "stdio" | "builtin";
  builtin?: "obsidian" | "artcraft";
  artcraftApp?: string;
  url?: string;
  command?: string;
  args?: string[];
  auth: "none" | "oauth" | "api-key";
  authOptions?: Array<"none" | "oauth" | "api-key">;
  apiKeyUrl?: string;
  oauthUrl?: string;
  oauthClientRequired?: boolean;
  setupUrl?: string;
}
export interface RegisteredSkill {
  id: string;
  slug: string;
  name: string;
  description: string;
  content: string;
  path: string;
  filePath: string;
  scope: CapabilityScope;
  workspacePath?: string;
  isEnabled: boolean;
  disableModelInvocation?: boolean;
  author?: string;
  version?: string;
  pluginId?: string;
  pluginName?: string;
}
export interface InstalledPlugin extends PluginManifest {
  id: string;
  path: string;
  scope: CapabilityScope;
  workspacePath?: string;
  isEnabled: boolean;
  isEffective: boolean;
  skills: RegisteredSkill[];
}

const validName = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const userRoot = (options: RegistryOptions) =>
  options.userRoot ?? path.join(os.homedir(), ".const", "harness");
const identity = (file: string) =>
  process.platform === "win32"
    ? path.resolve(file).toLowerCase()
    : path.resolve(file);

export function capabilityDirectory(
  scope: CapabilityScope,
  workspacePath: string | undefined,
  kind: "skills" | "plugins",
  options: RegistryOptions = {},
): string {
  if (scope === "workspace") {
    if (
      !workspacePath ||
      workspacePath === "Outside Project" ||
      !path.isAbsolute(workspacePath)
    ) {
      throw new Error(
        "A workspace installation requires an absolute workspace path.",
      );
    }
    return path.join(
      workspacePath,
      kind === "skills" ? ".agents" : ".const",
      kind,
    );
  }
  return path.join(userRoot(options), kind);
}

export function readPluginManifest(root: string): PluginManifest {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "plugin.json"), "utf8"),
  ) as PluginManifest;
  if (
    !manifest ||
    typeof manifest.name !== "string" ||
    !validName.test(manifest.name) ||
    typeof manifest.version !== "string" ||
    !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(manifest.version) ||
    typeof manifest.description !== "string" || !manifest.description.trim() ||
    typeof manifest.author?.name !== "string" || !manifest.author.name.trim() ||
    typeof manifest.interface?.displayName !== "string" || !manifest.interface.displayName.trim() ||
    (manifest.entrypoint !== undefined &&
      (typeof manifest.entrypoint !== "string" || !validName.test(manifest.entrypoint)))
  ) {
    throw new Error(`Invalid plugin manifest: ${root}`);
  }
  for (const flag of [manifest.defaultInstalled, manifest.placeholder]) {
    if (flag !== undefined && typeof flag !== "boolean") throw new Error(`Invalid plugin flag: ${root}`);
  }
  if (manifest.nativeCapabilities !== undefined && (!Array.isArray(manifest.nativeCapabilities) ||
    manifest.nativeCapabilities.some((value) => value !== "browser-use" && value !== "computer-use")))
    throw new Error(`Invalid native capabilities: ${root}`);
  if (manifest.mcpServers !== undefined) {
    if (!manifest.mcpServers || typeof manifest.mcpServers !== "object" || Array.isArray(manifest.mcpServers))
      throw new Error(`Invalid plugin MCP servers: ${root}`);
    for (const [name, server] of Object.entries(manifest.mcpServers)) {
      if (!validName.test(name) || !server || !["none", "oauth", "api-key"].includes(server.auth) ||
        !["http", "stdio", "builtin"].includes(server.transport) ||
        (server.transport === "builtin" && (!["obsidian", "artcraft"].includes(server.builtin ?? "") || server.auth !== "none" || server.url !== undefined || server.command !== undefined)) ||
        (server.builtin === "artcraft" && (!/^(photo|vector|film|light|pdf|effect|design|fig|word|sound|deck|cad|grid)craft$/.test(server.artcraftApp ?? "") || manifest.name !== server.artcraftApp)) ||
        (server.builtin !== "artcraft" && server.artcraftApp !== undefined) ||
        (server.transport !== "builtin" && server.builtin !== undefined) ||
        (server.transport === "http" && (typeof server.url !== "string" || !/^https?:\/\//.test(server.url))) ||
        (server.transport === "stdio" && (typeof server.command !== "string" || !server.command.trim())) ||
        (server.args !== undefined && (!Array.isArray(server.args) || server.args.some((arg) => typeof arg !== "string"))))
        throw new Error(`Invalid plugin MCP server: ${root}/${name}`);
      if (server.authOptions !== undefined && (!Array.isArray(server.authOptions) || server.authOptions.some((value) => !["none", "oauth", "api-key"].includes(value))))
        throw new Error(`Invalid plugin authentication options: ${root}/${name}`);
      if (server.oauthClientRequired !== undefined && typeof server.oauthClientRequired !== "boolean") throw new Error("Invalid OAuth client requirement");
      for (const value of [server.url, server.apiKeyUrl, server.oauthUrl, server.setupUrl].filter((value): value is string => value !== undefined)) {
        const endpoint = new URL(value);
        if (!["http:", "https:"].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new Error(`Invalid plugin endpoint: ${root}/${name}`);
      }
    }
  }
  return manifest;
}

function preferences(options: RegistryOptions): Record<string, boolean> {
  try {
    const value = JSON.parse(
      fs.readFileSync(
        path.join(userRoot(options), "capabilities.json"),
        "utf8",
      ),
    );
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

function directories(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => path.join(root, entry.name))
    .sort();
}

function readSkill(
  dir: string,
  scope: CapabilityScope,
  state: Record<string, boolean>,
  workspacePath?: string,
): RegisteredSkill {
  const filePath = path.join(dir, "SKILL.md");
  const content = fs.readFileSync(filePath, "utf8");
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const meta = match ? parse(match[1]!) : null;
  if (
    !meta ||
    typeof meta.name !== "string" ||
    !meta.name.trim() ||
    typeof meta.description !== "string" ||
    !meta.description.trim()
  ) {
    throw new Error(`Invalid skill frontmatter: ${filePath}`);
  }
  return {
    id: identity(filePath),
    slug: path.basename(dir),
    name: meta.name.trim(),
    description: meta.description.trim(),
    content,
    path: dir,
    filePath,
    scope,
    workspacePath,
    isEnabled: state[identity(filePath)] !== false,
    disableModelInvocation:
      meta["disable-model-invocation"] === true ||
      meta.disable_model_invocation === true,
    author: typeof meta.author === "string" ? meta.author : undefined,
    version: typeof meta.version === "string" ? meta.version : undefined,
  };
}

function readPlugin(
  root: string,
  scope: CapabilityScope,
  state: Record<string, boolean>,
  workspacePath?: string,
): InstalledPlugin {
  const manifest = readPluginManifest(root);
  const id = identity(root);
  const isEnabled = state[id] !== false;
  const skills = directories(path.join(root, "skills")).map((dir) => {
    const skill = readSkill(dir, scope, state, workspacePath);
    return {
      ...skill,
      slug: `${manifest.name}:${skill.slug}`,
      name: `${manifest.name}:${skill.name}`,
      pluginId: id,
      pluginName: manifest.interface.displayName,
      isEnabled: isEnabled && skill.isEnabled,
    };
  });
  if (manifest.entrypoint &&
    !skills.some(
      (skill) => skill.slug === `${manifest.name}:${manifest.entrypoint}`,
    )
  ) {
    throw new Error(`Plugin entrypoint is missing: ${manifest.name}`);
  }
  return {
    ...manifest,
    id,
    path: root,
    scope,
    workspacePath,
    isEnabled,
    isEffective: true,
    skills,
  };
}

/** UI and runtime use this same filesystem and configuration resolver. */
export function resolveSkillRegistry(
  workspacePath?: string,
  options: RegistryOptions = {},
): { skills: RegisteredSkill[]; plugins: InstalledPlugin[] } {
  const state = preferences(options);
  const roots: Array<{ scope: CapabilityScope; workspacePath?: string }> = [];
  if (workspacePath && workspacePath !== "Outside Project")
    roots.push({ scope: "workspace", workspacePath });
  roots.push({ scope: "user" });
  const plugins: InstalledPlugin[] = [];
  const effectivePlugins = new Map<string, InstalledPlugin>();
  const skills: RegisteredSkill[] = [];
  const seen = new Set<string>();
  for (const root of roots) {
    for (const dir of directories(
      capabilityDirectory(root.scope, root.workspacePath, "plugins", options),
    )) {
      try {
        const plugin = readPlugin(dir, root.scope, state, root.workspacePath);
        plugins.push(plugin);
        if (!effectivePlugins.has(plugin.name))
          effectivePlugins.set(plugin.name, plugin);
      } catch (error) {
        console.warn("[Skills] Invalid plugin:", dir, error);
      }
    }
  }
  // Suppress identical copies installed by the old Marketplace, while preserving
  // independently authored or externally managed standalone skills.
  const legacyComponents = new Map(
    [...effectivePlugins.values()].flatMap((plugin) =>
      plugin.skills.map((skill) => [skill.slug.split(":")[1]!, skill.content] as const),
    ),
  );
  for (const root of roots) {
    const skillRoots =
      root.scope === "workspace"
        ? [
            capabilityDirectory(
              "workspace",
              root.workspacePath,
              "skills",
              options,
            ),
            path.join(root.workspacePath!, ".const", "skills"),
          ]
        : [
            capabilityDirectory("user", undefined, "skills", options),
            options.userSkillsDir ??
              path.join(os.homedir(), ".agents", "skills"),
          ];
    for (const skillRoot of skillRoots) {
      for (const dir of directories(skillRoot)) {
        const slug = path.basename(dir).toLowerCase();
        if (
          seen.has(slug) ||
          !fs.existsSync(path.join(dir, "SKILL.md"))
        )
          continue;
        try {
          const skill = readSkill(dir, root.scope, state, root.workspacePath);
          if (root.scope === "user" && identity(skillRoot) === identity(capabilityDirectory("user", undefined, "skills", options)) &&
              legacyComponents.get(slug) === skill.content) continue;
          skills.push(skill);
          seen.add(slug);
        } catch (error) {
          console.warn("[Skills] Invalid skill:", dir, error);
        }
      }
    }
  }
  for (const plugin of effectivePlugins.values()) skills.push(...plugin.skills);
  for (const plugin of plugins) plugin.isEffective = effectivePlugins.get(plugin.name)?.id === plugin.id;
  return { skills, plugins };
}

export function setCapabilityEnabled(
  id: string,
  enabled: boolean,
  workspacePath?: string,
  options: RegistryOptions = {},
): void {
  if (typeof enabled !== "boolean")
    throw new Error("Enablement must be a boolean.");
  const registry = resolveSkillRegistry(workspacePath, options);
  if (![...registry.skills, ...registry.plugins].some((item) => item.id === id))
    throw new Error("Capability is no longer installed.");
  const state = preferences(options);
  state[id] = enabled;
  writePreferences(state, options);
}

function writePreferences(
  state: Record<string, boolean>,
  options: RegistryOptions,
): void {
  fs.mkdirSync(userRoot(options), { recursive: true });
  const destination = path.join(userRoot(options), "capabilities.json");
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(state, null, 2));
    fs.renameSync(temporary, destination);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function assertPackageFiles(root: string): void {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    if (entry.isSymbolicLink())
      throw new Error(`Plugin packages cannot contain symbolic links: ${file}`);
    if (entry.isDirectory()) assertPackageFiles(file);
  }
}

export function installPluginFromDirectory(
  source: string,
  scope: CapabilityScope,
  workspacePath?: string,
  options: RegistryOptions = {},
): InstalledPlugin {
  assertPackageFiles(source);
  const manifest = readPlugin(source, scope, {}, workspacePath);
  const parent = capabilityDirectory(scope, workspacePath, "plugins", options);
  fs.mkdirSync(parent, { recursive: true });
  const destination = path.join(parent, manifest.name);
  if (fs.existsSync(destination))
    return readPlugin(destination, scope, preferences(options), workspacePath);
  const staging = path.join(parent, `.install-${randomUUID()}`);
  try {
    fs.cpSync(source, staging, {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
    readPlugin(staging, scope, {}, workspacePath);
    fs.renameSync(staging, destination);
  } finally {
    // staging is generated directly beneath the verified capability directory.
    fs.rmSync(staging, { recursive: true, force: true });
  }
  return readPlugin(destination, scope, preferences(options), workspacePath);
}

export function uninstallPlugin(
  id: string,
  workspacePath?: string,
  options: RegistryOptions = {},
): void {
  const plugin = resolveSkillRegistry(workspacePath, options).plugins.find(
    (item) => item.id === id,
  );
  if (!plugin) throw new Error("Plugin is no longer installed.");
  const parent = capabilityDirectory(
    plugin.scope,
    plugin.workspacePath,
    "plugins",
    options,
  );
  if (
    identity(path.dirname(plugin.path)) !== identity(parent) ||
    !validName.test(path.basename(plugin.path))
  )
    throw new Error("Invalid plugin location.");
  fs.rmSync(plugin.path, { recursive: true, force: true });
  const state = preferences(options);
  delete state[plugin.id];
  for (const skill of plugin.skills) delete state[skill.id];
  writePreferences(state, options);
}

export function uninstallRegisteredSkill(id: string, workspacePath?: string, options: RegistryOptions = {}): void {
  const skill = resolveSkillRegistry(workspacePath, options).skills.find((item) => item.id === id && !item.pluginId);
  if (!skill) throw new Error("Standalone skill is no longer installed.");
  // The path comes from discovery, not from an arbitrary renderer-supplied path.
  if (identity(path.dirname(skill.filePath)) !== identity(skill.path)) throw new Error("Invalid skill location.");
  fs.rmSync(skill.path, { recursive: true, force: true });
  const state = preferences(options);
  delete state[skill.id];
  writePreferences(state, options);
}

export function pluginInvocationInstructions(
  prompt: string,
  plugins: InstalledPlugin[],
): string {
  const selected = new Map<string, InstalledPlugin>();
  const effective = new Map<string, InstalledPlugin>();
  for (const plugin of plugins)
    if (!effective.has(plugin.name)) effective.set(plugin.name, plugin);
  for (const match of prompt.matchAll(
    /@\[[^\]]+\]\(plugin:\/\/([a-z0-9-]+)\)/gi,
  )) {
    const plugin = effective.get(match[1]!.toLowerCase());
    if (!plugin?.isEnabled)
      throw new Error(`Plugin '${match[1]}' is not installed or is disabled.`);
    selected.set(plugin.name, plugin);
  }
  for (const plugin of effective.values()) {
    if (
      plugin.isEnabled &&
      new RegExp(`(?:^|\\s)@${plugin.name}(?=$|[\\s.,!?])`, "i").test(prompt)
    )
      selected.set(plugin.name, plugin);
  }
  return [...selected.values()]
    .map((plugin) => {
      if (plugin.placeholder) return `The user selected ${plugin.interface.displayName}. Its documentation has not been provided yet. Explain that it is not available; do not invent guide content.`;
      if (!plugin.entrypoint) return `The user explicitly selected ${plugin.interface.displayName}. Use its available connected tools. If authentication or dependencies are missing, ask the user to configure the plugin in Settings > MCP Servers. Do not invent results.`;
      const entry = plugin.skills.find(
        (skill) => skill.slug === `${plugin.name}:${plugin.entrypoint}`,
      );
      if (!entry?.isEnabled)
        throw new Error(`Plugin entrypoint is disabled: ${plugin.name}`);
      return `The user explicitly selected the ${plugin.interface.displayName} plugin. Read ${JSON.stringify(entry.filePath)} before following its workflow. Resolve all related skills within ${JSON.stringify(path.join(plugin.path, "skills"))}; load only the instructions needed for the task.`;
    })
    .join("\n");
}
