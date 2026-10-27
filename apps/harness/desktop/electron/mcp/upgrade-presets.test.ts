import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { readPluginManifest, resolveSkillRegistry } from "@const/agent";
import legacy from "./legacy-presets.json";
import { upgradeBundledMcpPreset } from "./upgrade-presets";

for (const name of ["github", "canva"] as const) {
  test(`${name} upgrades an unchanged bundled package without losing enablement or modifying customized skills`, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "const-preset-"));
    const home = path.join(root, "user");
    const dir = path.join(home, "plugins", name);
    const skillDir = path.join(dir, "skills", name);
    const bundled = fileURLToPath(
      new URL(`../../plugins/${name}/`, import.meta.url),
    );
    try {
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, "plugin.json"),
        JSON.stringify(legacy[name].manifest),
      );
      const skill = fs.readFileSync(
        new URL(`./fixtures/legacy-${name}.md`, import.meta.url),
      );
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), skill);
      const id = process.platform === "win32" ? dir.toLowerCase() : dir;
      fs.writeFileSync(
        path.join(home, "capabilities.json"),
        JSON.stringify({ [id]: false }),
      );
      assert.equal(upgradeBundledMcpPreset(dir, bundled), true);
      assert.equal(upgradeBundledMcpPreset(dir, bundled), false);
      assert.equal(readPluginManifest(dir).version, "1.0.1");
      assert.equal(readPluginManifest(dir).entrypoint, undefined);
      const registry = resolveSkillRegistry(undefined, {
        userRoot: home,
        userSkillsDir: path.join(root, "empty"),
      });
      assert.equal(registry.plugins[0]!.skills.length, 0);
      assert.equal(registry.plugins[0]!.isEnabled, false);
      assert.equal(
        fs.readFileSync(
          path.join(dir, ".const-v1-skills", name, "SKILL.md"),
          "utf8",
        ),
        skill.toString(),
      );

      fs.writeFileSync(
        path.join(dir, "plugin.json"),
        JSON.stringify(legacy[name].manifest),
      );
      fs.renameSync(
        path.join(dir, ".const-v1-skills"),
        path.join(dir, "skills"),
      );
      fs.appendFileSync(
        path.join(skillDir, "SKILL.md"),
        "\nCustom user instruction\n",
      );
      assert.equal(upgradeBundledMcpPreset(dir, bundled), false);
      assert.equal(readPluginManifest(dir).version, "1.0.0");
    } finally {
      // root is created above under the system temp directory, never a user-selected path.
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}
