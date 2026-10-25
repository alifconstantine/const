// Isolated UI fixture. All native mutations are in memory; no user files change.
import React from "react";
import { createRoot } from "react-dom/client";
import { ScrollArea } from "@const/ui";
import { I18nProvider } from "../src/lib/i18n";
import { SkillsSettings } from "../src/components/settings/skills-settings";
import type { SkillsShItem } from "../src/lib/skills/skills-sh-service";
import type { LocalSkill, SkillInstallProgress } from "../src/lib/skills/types";
import "../src/index.css";

const items: SkillsShItem[] = [
  {
    id: "anthropics/skills/pdf",
    source: "anthropics/skills",
    skillId: "pdf",
    name: "pdf",
    installs: 216443,
  },
  {
    id: "openai/skills/pdf",
    source: "openai/skills",
    skillId: "pdf",
    name: "pdf",
    installs: 198211,
  },
  {
    id: "vercel-labs/agent-skills/react-best-practices",
    source: "vercel-labs/agent-skills",
    skillId: "react-best-practices",
    name: "react-best-practices",
    installs: 120312,
  },
  {
    id: "anthropics/skills/frontend-design",
    source: "anthropics/skills",
    skillId: "frontend-design",
    name: "frontend-design",
    installs: 102244,
  },
];
let installed: LocalSkill[] = [];
const changed = new Set<() => void>();
const listeners = new Set<(progress: SkillInstallProgress) => void>();
const cancelled = new Set<string>();
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const content = (source: string) =>
  `---\nname: pdf\ndescription: Read and create documents.\n---\n# Original instructions\n\nSource: ${source}\n\n## Workflow\n\nRead the input document, preserve its layout, and verify the exported file.\n`;
const bridge = {
  listInstalled: async () => installed,
  listPlugins: async () => ({ catalog: [], installed: [] }),
  onChanged: (callback: () => void) => {
    changed.add(callback);
    return () => changed.delete(callback);
  },
  onInstallProgress: (callback: (progress: SkillInstallProgress) => void) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },
  searchSkills: async (query: string) => {
    await wait(query === "slow" ? 1800 : 250);
    if (query === "offline") throw new Error("offline");
    if (query.length === 1) return [];
    return items.filter((item) =>
      `${item.name} ${item.source}`.includes(query.toLowerCase()),
    );
  },
  previewRemoteSkill: async (source: string) => {
    await wait(150);
    return { content: content(source), files: { "SKILL.md": content(source) } };
  },
  getSkillContent: async (slug: string) => {
    const skill = installed.find((item) => item.slug === slug)!;
    return {
      ...skill,
      isInstalled: true,
      files: { "SKILL.md": skill.content },
    };
  },
  installSkill: async (payload: {
    slug: string;
    source: string;
    requestId: string;
    scope: "user" | "workspace";
    workspacePath?: string;
  }) => {
    for (let completed = 0; completed <= 4; completed++) {
      if (cancelled.has(payload.requestId))
        throw new Error("SKILL_INSTALL_CANCELLED");
      listeners.forEach((callback) =>
        callback({
          requestId: payload.requestId,
          phase: "downloading",
          completed,
          total: 4,
          file: completed ? "references/guide.md" : undefined,
        }),
      );
      await wait(1000);
    }
    const now = Date.now();
    const sourceId = payload.source + "/" + payload.slug;
    const skill: LocalSkill = {
      id: "fixture:" + sourceId,
      slug: payload.slug,
      sourceId,
      source: payload.source,
      sourceSkillId: payload.slug,
      name: payload.slug,
      description: "Read and create documents.",
      content: content(payload.source),
      path: "fixture/" + sourceId,
      scope: payload.scope,
      category: "custom",
      isBuiltIn: false,
      isEnabled: true,
      createdAt: now,
      updatedAt: now,
    };
    installed = [...installed, skill];
    changed.forEach((callback) => callback());
    return skill;
  },
  cancelSkillInstall: async (requestId: string) => {
    cancelled.add(requestId);
  },
  setEnabled: async ({ id, enabled }: { id: string; enabled: boolean }) => {
    installed = installed.map((skill) =>
      skill.id === id ? { ...skill, isEnabled: enabled } : skill,
    );
    changed.forEach((callback) => callback());
  },
  uninstallSkill: async ({ id }: { id: string }) => {
    installed = installed.filter((skill) => skill.id !== id);
    changed.forEach((callback) => callback());
    return true;
  },
  openSkillsFolder: async () => "",
};
window.electron = { marketplace: bridge } as unknown as NonNullable<
  Window["electron"]
>;
createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <ScrollArea
      className="h-screen bg-[#161616]"
      thumbClassName="bg-white/20 hover:bg-white/30"
    >
      <main className="max-w-5xl mx-auto p-8">
        <SkillsSettings
          workspacePath={
            new URLSearchParams(window.location.search).has("noWorkspace")
              ? undefined
              : "D:\\fixture-project"
          }
        />
      </main>
    </ScrollArea>
  </I18nProvider>,
);
