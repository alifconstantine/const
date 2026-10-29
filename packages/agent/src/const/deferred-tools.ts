import type { NativeToolDefinition } from "./types.js";

export type NativeCapability = "browser-use" | "computer-use";
export function nativeCapabilityForTool(name: string): NativeCapability | undefined {
  return name.startsWith("browser_") ? "browser-use" : name.startsWith("computer_") ? "computer-use" : undefined;
}

export function nativePluginLoader(capabilities: NativeCapability[]): NativeToolDefinition {
  return {
    type: "function",
    requiresApproval: false,
    function: {
      name: "load_plugin_tools",
      description: "Load the native tools of an enabled plugin for the next model request, only when the task needs website interaction (browser-use) or OS desktop interaction (computer-use). Read its available skill for the workflow. Disabled plugins cannot be loaded.",
      parameters: {
        type: "object",
        properties: { plugin: { type: "string", enum: capabilities } },
        required: ["plugin"],
        additionalProperties: false,
      },
    },
  };
}
