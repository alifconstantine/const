import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import githubMcp from "./legacy-github-mcp.json";
import legacy from "./legacy-presets.json";
import { atomicJson } from "./store";

/** Upgrade only the exact bundled v1 packages; preserve customized packages and preferences. */
export function upgradeBundledMcpPreset(
  installed: string,
  bundled: string,
): boolean {
  const root = path.resolve(installed);
  const name = path.basename(root) as keyof typeof legacy;
  if (!Object.hasOwn(legacy, name) || root === path.resolve(bundled))
    return false;
  const manifestFile = path.join(root, "plugin.json");
  const skills = path.join(root, "skills");
  const skillDir = path.join(skills, name);
  const skillFile = path.join(skillDir, "SKILL.md");
  const archive = path.join(root, ".const-v1-skills");
  // Both move targets must remain directly inside the validated installation.
  if (path.dirname(skills) !== root || path.dirname(archive) !== root)
    return false;
  try {
    const realRoot = fs.realpathSync(root);
    if (
      (process.platform === "win32" ? realRoot.toLowerCase() : realRoot) !==
      (process.platform === "win32" ? root.toLowerCase() : root)
    )
      return false;
    for (const file of [root, manifestFile]) {
      if (fs.lstatSync(file).isSymbolicLink()) return false;
    }
    const current = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    const next = JSON.parse(
      fs.readFileSync(path.join(bundled, "plugin.json"), "utf8"),
    );
    if (
      next.name !== name ||
      !["1.0.1", "1.1.0"].includes(next.version) ||
      next.entrypoint
    )
      return false;
    if (
      name === "github" &&
      isDeepStrictEqual(current, githubMcp) &&
      next.version === "1.1.0"
    ) {
      // Existing MCP-only installations have no active skills to archive.
      if (fs.existsSync(skills)) return false;
      atomicJson(manifestFile, next);
      return true;
    }
    if (
      !isDeepStrictEqual(current, legacy[name].manifest) ||
      fs.existsSync(archive)
    )
      return false;
    for (const file of [skills, skillDir, skillFile])
      if (fs.lstatSync(file).isSymbolicLink()) return false;
    if (
      !isDeepStrictEqual(fs.readdirSync(skills), [name]) ||
      !isDeepStrictEqual(fs.readdirSync(skillDir), ["SKILL.md"])
    )
      return false;
    const hash = createHash("sha256")
      .update(fs.readFileSync(skillFile, "utf8").replace(/\r\n/g, "\n"))
      .digest("hex");
    if (hash !== legacy[name].skillHash) return false;
    fs.renameSync(skills, archive);
    try {
      atomicJson(manifestFile, next);
    } catch (error) {
      fs.renameSync(archive, skills);
      throw error;
    }
    return true;
  } catch {
    return false;
  }
}
