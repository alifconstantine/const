import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  installPluginFromDirectory,
  pluginInvocationInstructions,
  readPluginManifest,
  resolveSkillRegistry,
  setCapabilityEnabled,
  uninstallPlugin,
  uninstallRegisteredSkill,
} from "../src/const/skill-registry.js";

let root: string;
let source: string;
let options: { userRoot: string; userSkillsDir: string };
const skillText = (name: string) =>
  `---\nname: ${name}\ndescription: Create videos and motion graphics.\n---\nRead references/guide.md.\n`;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "const-plugin-test-"));
  source = path.join(root, "source");
  options = {
    userRoot: path.join(root, "user"),
    userSkillsDir: path.join(root, "agents"),
  };
  fs.mkdirSync(path.join(source, "skills", "hyperframes", "references"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(source, "plugin.json"),
    JSON.stringify({
      name: "hyperframes",
      version: "1.2.3",
      description: "Video workflows",
      author: { name: "HyperFrames" },
      interface: { displayName: "HyperFrames", icon: "./assets/icon.svg" },
      entrypoint: "hyperframes",
    }),
  );
  fs.writeFileSync(
    path.join(source, "skills", "hyperframes", "SKILL.md"),
    skillText("hyperframes"),
  );
  fs.writeFileSync(
    path.join(source, "skills", "hyperframes", "references", "guide.md"),
    "Bundled reference",
  );
  fs.writeFileSync(
    path.join(source, "skills", "hyperframes", "asset.bin"),
    Buffer.from([0, 255, 123, 0]),
  );
});
afterEach(() => {
  if (path.basename(root).startsWith("const-plugin-test-"))
    fs.rmSync(root, { recursive: true, force: true });
});

describe("plugin lifecycle and shared skill resolution", () => {
  it("installs full files and exposes namespaced skills without an explicit mention", () => {
    const plugin = installPluginFromDirectory(
      source,
      "user",
      undefined,
      options,
    );
    const registry = resolveSkillRegistry(undefined, options);
    expect(registry.plugins).toHaveLength(1);
    expect(registry.skills[0]).toMatchObject({
      slug: "hyperframes:hyperframes",
      isEnabled: true,
      pluginId: plugin.id,
    });
    expect(
      fs.readFileSync(path.join(plugin.path, "skills/hyperframes/asset.bin")),
    ).toEqual(Buffer.from([0, 255, 123, 0]));
    expect(
      fs.readFileSync(
        path.join(plugin.path, "skills/hyperframes/references/guide.md"),
        "utf8",
      ),
    ).toBe("Bundled reference");
    expect(pluginInvocationInstructions("Make a video", registry.plugins)).toBe(
      "",
    );
    expect(
      pluginInvocationInstructions(
        "@[HyperFrames](plugin://hyperframes) Make a video",
        registry.plugins,
      ),
    ).toContain(registry.skills[0]!.filePath.replaceAll("\\", "\\\\"));
    expect(
      pluginInvocationInstructions("Use @HyperFrames please", registry.plugins),
    ).toContain("explicitly selected");
  });

  it("persists disablement and prevents legacy standalone copies bypassing a disabled plugin", () => {
    const plugin = installPluginFromDirectory(
      source,
      "user",
      undefined,
      options,
    );
    const legacy = path.join(options.userRoot, "skills", "hyperframes");
    fs.mkdirSync(legacy, { recursive: true });
    fs.writeFileSync(path.join(legacy, "SKILL.md"), skillText("hyperframes"));
    setCapabilityEnabled(plugin.id, false, undefined, options);
    const registry = resolveSkillRegistry(undefined, options);
    expect(registry.plugins[0]!.isEnabled).toBe(false);
    expect(registry.skills).toHaveLength(1);
    expect(registry.skills.filter((skill) => skill.isEnabled)).toHaveLength(0);
    expect(() =>
      pluginInvocationInstructions(
        "@[HyperFrames](plugin://hyperframes)",
        registry.plugins,
      ),
    ).toThrow("disabled");
    setCapabilityEnabled(plugin.id, true, undefined, options);
    expect(resolveSkillRegistry(undefined, options).skills[0]!.isEnabled).toBe(
      true,
    );
  });

  it("keeps workspace installs isolated and applies workspace enablement before user enablement", () => {
    const workspace = path.join(root, "project");
    const global = installPluginFromDirectory(
      source,
      "user",
      undefined,
      options,
    );
    const local = installPluginFromDirectory(
      source,
      "workspace",
      workspace,
      options,
    );
    expect(global.id).not.toBe(local.id);
    setCapabilityEnabled(local.id, false, workspace, options);
    expect(resolveSkillRegistry(workspace, options).plugins.map((plugin) => plugin.isEffective)).toEqual([true, false]);
    expect(
      resolveSkillRegistry(workspace, options).skills.filter(
        (skill) => skill.isEnabled,
      ),
    ).toHaveLength(0);
    expect(
      resolveSkillRegistry(path.join(root, "other-project"), options).skills[0]!
        .pluginId,
    ).toBe(global.id);
    uninstallPlugin(local.id, workspace, options);
    expect(resolveSkillRegistry(workspace, options).skills[0]!.pluginId).toBe(
      global.id,
    );
    const reinstalled = installPluginFromDirectory(
      source,
      "workspace",
      workspace,
      options,
    );
    expect(reinstalled.isEnabled).toBe(true);
    expect(fs.existsSync(global.path)).toBe(true);
    expect(() =>
      installPluginFromDirectory(source, "workspace", undefined, options),
    ).toThrow("workspace");
  });

  it("rejects incomplete packages before publishing an installation", () => {
    fs.writeFileSync(
      path.join(source, "skills/hyperframes/SKILL.md"),
      "No frontmatter",
    );
    expect(() =>
      installPluginFromDirectory(source, "user", undefined, options),
    ).toThrow("frontmatter");
    expect(resolveSkillRegistry(undefined, options).plugins).toHaveLength(0);
    expect(
      fs.existsSync(path.join(options.userRoot, "plugins/hyperframes")),
    ).toBe(false);
  });

  it("disables a standalone skill using the same persisted state as plugin skills", () => {
    const dir = path.join(options.userSkillsDir, "pdf");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "SKILL.md"), skillText("pdf"));
    const skill = resolveSkillRegistry(undefined, options).skills[0]!;
    setCapabilityEnabled(skill.id, false, undefined, options);
    expect(resolveSkillRegistry(undefined, options).skills[0]!.isEnabled).toBe(
      false,
    );
    expect(() =>
      setCapabilityEnabled(
        path.join(root, "unregistered"),
        false,
        undefined,
        options,
      ),
    ).toThrow("no longer installed");
  });

  it("validates and installs all 21 shipped HyperFrames skills", () => {
    const bundled = fileURLToPath(
      new URL(
        "../../../apps/harness/desktop/plugins/hyperframes",
        import.meta.url,
      ),
    );
    expect(readPluginManifest(bundled).name).toBe("hyperframes");
    const plugin = installPluginFromDirectory(
      bundled,
      "user",
      undefined,
      options,
    );
    expect(plugin.skills).toHaveLength(21);
    expect(
      plugin.skills.every(
        (skill) =>
          skill.filePath.startsWith(plugin.path) &&
          fs.existsSync(skill.filePath),
      ),
    ).toBe(true);
    expect(
      plugin.skills.some((skill) => skill.slug === "hyperframes:media-use"),
    ).toBe(true);
    expect(
      plugin.skills.some(
        (skill) => skill.slug === "hyperframes:talking-head-recut",
      ),
    ).toBe(true);
    uninstallPlugin(plugin.id, undefined, options);
    expect(resolveSkillRegistry(undefined, options).skills).toHaveLength(0);
  });

  it("preserves independently managed skills with the same name as a plugin component", () => {
    const plugin = installPluginFromDirectory(source, "user", undefined, options);
    const independent = path.join(options.userSkillsDir, "hyperframes");
    fs.mkdirSync(independent, { recursive: true });
    fs.writeFileSync(path.join(independent, "SKILL.md"), skillText("hyperframes"));
    setCapabilityEnabled(plugin.id, false, undefined, options);
    const standalone = resolveSkillRegistry(undefined, options).skills.find((skill) => skill.slug === "hyperframes");
    expect(standalone?.isEnabled).toBe(true);
    uninstallRegisteredSkill(standalone!.id, undefined, options);
    expect(fs.existsSync(independent)).toBe(false);
    expect(fs.existsSync(plugin.path)).toBe(true);
    expect(() => uninstallRegisteredSkill(plugin.skills[0]!.id, undefined, options)).toThrow("Standalone skill");
    const workspace = path.join(root, "project");
    installPluginFromDirectory(source, "workspace", workspace, options);
    const projectSkill = path.join(workspace, ".agents", "skills", "hyperframes");
    fs.mkdirSync(projectSkill, { recursive: true });
    fs.writeFileSync(path.join(projectSkill, "SKILL.md"), skillText("hyperframes"));
    expect(resolveSkillRegistry(workspace, options).skills.find((skill) => skill.slug === "hyperframes")?.path).toBe(projectSkill);
  });

  it("keeps a customized managed skill alongside the plugin", () => {
    installPluginFromDirectory(source, "user", undefined, options);
    const independent = path.join(options.userRoot, "skills", "hyperframes");
    fs.mkdirSync(independent, { recursive: true });
    fs.writeFileSync(path.join(independent, "SKILL.md"), skillText("hyperframes") + "Custom instructions");
    expect(resolveSkillRegistry(undefined, options).skills.map((skill) => skill.slug)).toEqual(["hyperframes", "hyperframes:hyperframes"]);
  });

  it("rejects manifests with missing or wrongly typed fields", () => {
    const file = path.join(source, "plugin.json");
    const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const value of [{ ...manifest, name: undefined }, { ...manifest, description: 123 }, { ...manifest, entrypoint: 123 }, null]) {
      fs.writeFileSync(file, JSON.stringify(value));
      expect(() => readPluginManifest(source)).toThrow("Invalid plugin manifest");
    }
  });

  it("installs MCP-only and empty guide plugins without dummy skill entrypoints", () => {
    const file = path.join(source, "plugin.json");
    const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
    delete manifest.entrypoint;
    fs.rmSync(path.join(source, "skills"), { recursive: true });
    manifest.name = "docs";
    manifest.mcpServers = { docs: { transport: "http", url: "https://example.com/mcp", auth: "oauth" } };
    fs.writeFileSync(file, JSON.stringify(manifest));
    const installed = installPluginFromDirectory(source, "user", undefined, options);
    expect(installed.skills).toEqual([]);
    expect(pluginInvocationInstructions("@docs", [installed])).toContain("connected tools");
    expect(pluginInvocationInstructions("@docs", [{ ...installed, placeholder: true }])).toContain("has not been provided");
  });

  it("validates every bundled plugin and keeps Const Guide free of invented content", () => {
    const bundled = fileURLToPath(new URL("../../../apps/harness/desktop/plugins/", import.meta.url));
    for (const name of fs.readdirSync(bundled)) {
      const dir = path.join(bundled, name);
      const manifest = readPluginManifest(dir);
      expect(manifest.name).toBe(name);
      if (manifest.entrypoint) expect(fs.existsSync(path.join(dir, "skills", manifest.entrypoint, "SKILL.md"))).toBe(true);
    }
    expect(readPluginManifest(path.join(bundled, "const-guide"))).toMatchObject({ placeholder: true, interface: { icon: "const" } });
    expect(fs.existsSync(path.join(bundled, "const-guide", "skills"))).toBe(false);
  });
});
