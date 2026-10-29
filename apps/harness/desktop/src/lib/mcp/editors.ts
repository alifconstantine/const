export const EDITOR_IDS = ["blender", "godot", "unity", "unreal"] as const;
export type EditorApp = (typeof EDITOR_IDS)[number];
export const EDITORS = {
  blender: {
    name: "Blender",
    version: "5.1+",
    guide: "https://www.blender.org/lab/mcp-server/",
    port: 9876,
  },
  godot: {
    name: "Godot",
    version: "4.2+",
    guide: "https://github.com/NPGameDev/godot-mcp-toolkit",
    port: 6550,
  },
  unity: {
    name: "Unity",
    version: "6+",
    guide: "https://docs.unity.com/en-us/unity-cli/use-unity-cli",
    port: 0,
  },
  unreal: {
    name: "Unreal Engine",
    version: "5.8+",
    guide:
      "https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-mcp-in-unreal-editor",
    port: 8000,
  },
} satisfies Record<
  EditorApp,
  { name: string; version: string; guide: string; port: number }
>;
export function isEditorApp(value: unknown): value is EditorApp {
  return typeof value === "string" && EDITOR_IDS.includes(value as EditorApp);
}
export type EditorAction =
  "project" | "install" | "cancel" | "reveal" | "login" | "pipeline";
