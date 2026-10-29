// Real components with in-memory native/Convex adapters. No credentials, OS
// discovery, model calls, or user configuration are accessed by this fixture.
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import { ScrollArea, SonnerToaster } from "@const/ui";
import { I18nProvider, t } from "../src/lib/i18n";
import { SettingsView } from "../src/components/settings-view";
import { ComputerUseSettings } from "../src/components/settings/computer-use-settings";
import { SkillsSettings } from "../src/components/settings/skills-settings";
import { WeeklyQuotaCard } from "../src/components/settings/weekly-quota-card";
import type { LocalSkill } from "../src/lib/skills/types";
import "../src/index.css";

const params = new URLSearchParams(window.location.search);
const quota = params.has("missingQuota")
  ? null
  : {
      weeklyLimitTokens: 7_000_000,
      remainingTokens: params.has("exhaustedQuota") ? 0 : 5_250_000,
      resetsInText: "3d 8h",
    };
const state = {
  config: { enableComputerUse: true, enableBrowserUse: false },
  saves: [] as Record<string, unknown>[],
  nativeCalls: 0,
  profileMutations: [] as Record<string, unknown>[],
  memoryFiles: [
    {
      path: "/fixture/project/.const/memory/MEMORY.md",
      name: "MEMORY.md",
      preview: "Project conventions",
      formattedDate: "Oct 29, 2026",
    },
  ],
  rejectSaves: false,
  rejectLoads: params.has("failLoad"),
};
Object.assign(window, { __settingsTest: state });
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const skill: LocalSkill = {
  id: "fixture:pdf",
  slug: "pdf",
  name: "pdf",
  description: "Fixture document workflow",
  content:
    "---\nname: pdf\ndescription: Fixture document workflow\n---\nRead the fixture.",
  category: "custom",
  source: "fixture/skills",
  sourceId: "fixture/skills/pdf",
  path: "/fixture/skills/pdf",
  scope: "user",
  isBuiltIn: false,
  isEnabled: true,
  createdAt: 1,
  updatedAt: 1,
};
window.electron = {
  platform: "linux",
  getConfig: async () => {
    await pause(40);
    if (state.rejectLoads) throw new Error("Fixture load failure");
    return { ...state.config };
  },
  saveConfig: async (value: Record<string, unknown>) => {
    state.saves.push(value);
    await pause(180);
    if (state.rejectSaves) throw new Error("Fixture save failure");
    Object.assign(state.config, value);
    return { ...state.config };
  },
  memory: {
    getConfig: async () => ({ workspaceMemoryEnabled: true }),
    saveConfig: async () => ({}),
    list: async () => state.memoryFiles,
    read: async () => "# Project conventions\n\nUse the shared design tokens.",
    save: async () => true,
    delete: async () => true,
    openInFolder: async () => {},
  },
  getProjects: async () => [],
  computer: {
    getCapabilities: async () => {
      state.nativeCalls++;
      return { platform: "linux" };
    },
    listApps: async () => {
      state.nativeCalls++;
      return [];
    },
  },
  marketplace: {
    listInstalled: async () => [skill],
    listPlugins: async () => ({
      installed: [],
      catalog: [
        {
          name: "computer-use",
          version: "1.0.0",
          description: "Fixture native desktop tools",
          author: { name: "Const" },
          interface: { displayName: "Computer Use", icon: "blocks" },
          entrypoint: "computer-use",
          skillSlugs: ["computer-use"],
        },
      ],
    }),
    onChanged: () => () => {},
    onInstallProgress: () => () => {},
    searchSkills: async (query: string) => {
      await pause(query === "slow" ? 600 : 20);
      return [
        {
          id: "fixture/skills/pdf",
          source: "fixture/skills",
          skillId: "pdf",
          name: "pdf",
          installs: 1,
        },
      ].filter((value) => value.name.includes(query));
    },
  },
} as unknown as NonNullable<Window["electron"]>;

// The sole SettingsView query is the account quota. Mutation methods remain in
// memory so the profile can render without a signed-in Convex session.
const convex = {
  watchQuery: () => ({
    onUpdate: () => () => {},
    localQueryResult: () => quota,
    localQueryLogs: () => [],
    journal: () => undefined,
  }),
  mutation: async (_name: unknown, args: Record<string, unknown>) => {
    state.profileMutations.push(args);
    return null;
  },
} as unknown as ConvexReactClient;
function SettingsFixture({ view }: { view: string }) {
  const [profile, setProfile] = useState(() => {
    let local = {};
    try {
      local = JSON.parse(
        localStorage.getItem("const_custom_user_profile") || "{}",
      );
    } catch {
      /* Empty fixture profile. */
    }
    return {
      id: "fixture",
      name: "Settings fixture",
      email: "fixture@example.test",
      ...local,
    };
  });
  useEffect(() => {
    const update = (event: Event) =>
      setProfile((previous) => ({
        ...previous,
        ...(event as CustomEvent).detail,
      }));
    window.addEventListener("const:user-profile-updated", update);
    return () =>
      window.removeEventListener("const:user-profile-updated", update);
  }, []);
  return <SettingsView initialTab={view} user={profile} />;
}

const view = params.get("view") || "computer-use";
const inner =
  view === "computer-use" ? (
    <>
      <h1 className="text-xl font-medium text-[#262626] dark:text-white mb-6">
        {t("settings.computerUse")}
      </h1>
      <ComputerUseSettings />
    </>
  ) : view === "marketplace" ? (
    <SkillsSettings
      workspacePath="/fixture/project"
      initialTab={params.has("plugins") ? "plugins" : "skills"}
    />
  ) : view === "quota" ? (
    <WeeklyQuotaCard quota={params.has("loadingQuota") ? undefined : quota} />
  ) : (
    <SettingsFixture view={view} />
  );

createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <ConvexProvider client={convex}>
      <ScrollArea
        className="h-screen bg-white dark:bg-[#161616]"
        thumbClassName="bg-white/20 hover:bg-white/30"
      >
        <main className="max-w-3xl mx-auto p-5 sm:p-8">{inner}</main>
      </ScrollArea>
      <SonnerToaster />
    </ConvexProvider>
  </I18nProvider>,
);
