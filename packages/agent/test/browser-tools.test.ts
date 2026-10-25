import { describe, expect, it, vi } from "vitest";
import { CONST_DEFAULT_TOOLS, executeNativeTool, NATIVE_BROWSER_TOOLS } from "../src/const/tools.js";
import { extractFallbackToolCalls } from "../src/const/const-agent.js";

const tools = ["browser_wait_for", "browser_verify_text", "browser_find", "browser_hover", "browser_paste"];

describe("Desktop browser tool integration", () => {
  it.each(tools)("registers %s exactly once in both tool lists", (name) => {
    for (const registry of [NATIVE_BROWSER_TOOLS, CONST_DEFAULT_TOOLS]) {
      expect(registry.filter((tool) => tool.function.name === name)).toHaveLength(1);
    }
  });

  it.each(tools)("recognizes %s in fallback tool calls", (name) => {
    const args = { text: "Confirm result", tabId: "selected-tab" };
    const calls = extractFallbackToolCalls(`<tool_call>${JSON.stringify({ name, arguments: args })}</tool_call>`);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.function.name).toBe(name);
    expect(JSON.parse(calls[0]!.function.arguments)).toEqual(args);
  });

  it.each(tools)("forwards %s to the desktop handler and preserves errors", async (name) => {
    const args = { text: "Confirm result", tabId: "selected-tab" };
    const response = { result: "Expected text was missing", isError: true };
    const browserHandler = vi.fn().mockResolvedValue(response);
    const result = await executeNativeTool(name, args, process.cwd(), { browserHandler });
    expect(browserHandler).toHaveBeenCalledExactlyOnceWith(name, args);
    expect(result).toEqual(response);
  });
});
