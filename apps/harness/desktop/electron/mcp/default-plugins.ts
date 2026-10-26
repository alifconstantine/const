import fs from "node:fs";
import path from "node:path";
import { atomicJson } from "./store";

/** Initialization history is separate from enablement: user uninstall/disable choices survive restarts. */
export function initializeDefaultPlugins(
  home: string,
  catalog: Array<{ name: string; defaultInstalled?: boolean }>,
  installed: Array<{ name: string; scope: "user" | "workspace" }>,
  install: (name: string) => void,
) {
  const file = path.join(home, "default-plugins.json");
  const history: unknown = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : [];
  if (
    !Array.isArray(history) ||
    history.some((name) => typeof name !== "string")
  )
    throw new Error("Invalid default plugin history");
  const initialized = new Set<string>(history);
  for (const plugin of catalog) {
    if (!plugin.defaultInstalled || initialized.has(plugin.name)) continue;
    if (
      !installed.some(
        (item) => item.name === plugin.name && item.scope === "user",
      )
    )
      install(plugin.name);
    initialized.add(plugin.name);
  }
  atomicJson(file, [...initialized]);
}
