import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createConstAgent, extractFallbackToolCalls } from "../src/const/const-agent.js";
import { getToolActionKind, normalizeToolName } from "../src/const/tool-policy.js";
import type { AgentConfig, AgentEvent } from "../src/const/types.js";

vi.mock("../src/const/skill-registry.js", () => ({
  resolveSkillRegistry: () => ({ skills: [], plugins: [] }),
  pluginInvocationInstructions: () => "",
}));

let workspace: string;
beforeEach(async () => { workspace = await mkdtemp(path.join(tmpdir(), "const-approval-test-")); });
afterEach(async () => { vi.unstubAllGlobals(); await rm(workspace, { recursive: true, force: true }); });

function call(name: string, args: Record<string, unknown>, index: number) {
  return { index, id: `call_${index}`, type: "function", function: { name, arguments: JSON.stringify(args) } };
}

function fixture(calls: ReturnType<typeof call>[], config: Partial<AgentConfig> = {}) {
  const requests: Array<{ messages: Array<{ role: string; tool_call_id?: string; content: string }> }> = [];
  const events: AgentEvent[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init: RequestInit) => {
    requests.push(JSON.parse(String(init.body)));
    const delta = requests.length === 1 ? { tool_calls: calls } : { content: "Replanned." };
    return new Response(`data: ${JSON.stringify({ choices: [{ delta, finish_reason: requests.length === 1 ? "tool_calls" : "stop" }] })}\n\ndata: [DONE]\n\n`, { status: 200 });
  }));
  const agent = createConstAgent({ model: "test-model", baseUrl: "http://fixture.invalid/v1", apiKey: "", mode: "request_review", maxTurns: 2, workspacePath: workspace, ...config });
  const run = (onEvent: (event: AgentEvent) => void) => agent.run([{ role: "user", content: "Run the fixture" }], event => { events.push(event); onEvent(event); });
  return { agent, requests, events, run };
}

describe("approval flow", () => {
  it.each(["request_review", "ask_before_changes", "full_access"] as const)("routes namespaced MCP tools through the external registry and respects mode (%s)", async mode => {
    const handler = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({ result: "provider result", isError: false }));
    const name = "mcp_fixture_query_docs";
    const { agent, requests, events, run } = fixture([call(name, { query: "documentation" }, 0)], {
      mode, externalTools: async () => [{ type: "function", requiresApproval: true, function: { name, description: "Fixture", parameters: { type: "object" } } }], externalToolHandler: handler,
    });
    await run(event => {
      if (event.type === "approval_request") queueMicrotask(() => agent.resolveApproval(event.approvalId!, { approvalId: event.approvalId!, decision: "approve_once" }));
    });
    expect(handler).toHaveBeenCalledOnce();
    expect(JSON.stringify(requests[0])).not.toContain("requiresApproval");
    expect(handler.mock.calls[0]?.[0]).toBe(name);
    expect(events.filter(event => event.type === "approval_request")).toHaveLength(mode === "full_access" ? 0 : 1);
    expect(events.some(event => event.type === "tool_result" && event.result === "provider result")).toBe(true);
  });

  it("recognizes declared MCP names in fallback calls without accepting invented connections", () => {
    const text = '<tool_call>{"name":"mcp_fixture_docs","arguments":{"query":"test"}}</tool_call>';
    expect(extractFallbackToolCalls(text)).toEqual([]);
    expect(extractFallbackToolCalls(text, new Set(["mcp_fixture_docs"]))[0]?.function.name).toBe("mcp_fixture_docs");
  });

  it.each(["browser_snapshot", "BrowserNavigate"])("rejects a model's native browser call when its plugin is disabled (%s)", async name => {
    const browserHandler = vi.fn(async () => ({ result: "must not execute", isError: false }));
    const { events, run } = fixture([call(name, {}, 0)], { mode: "full_access", nativeCapabilityEnabled: () => false, browserHandler });
    await run(() => {});
    expect(browserHandler).not.toHaveBeenCalled();
    expect(events.some(event => event.type === "tool_result" && event.isError)).toBe(true);
  });

  it.each(["request_review", "ask_before_changes"] as const)("replans after denial without requesting or executing the old batch (%s)", async mode => {
    const { agent, requests, events, run } = fixture([
      call("bash", { command: "echo A" }, 0),
      call("write", { path: "never-written.txt", content: "stale plan" }, 1),
      call("bash", { command: "echo C" }, 2),
    ], { mode });
    await run(event => {
      if (event.type !== "approval_request") return;
      queueMicrotask(() => agent.resolveApproval(event.approvalId!, { approvalId: event.approvalId!, decision: "deny", feedback: "Read the documentation instead." }));
    });
    expect(events.filter(event => event.type === "approval_request").map(event => event.toolCallId)).toEqual(["call_0"]);
    expect(requests).toHaveLength(2);
    const results = requests[1]!.messages.filter(message => message.role === "tool");
    expect(results.map(message => message.tool_call_id)).toEqual(["call_0", "call_1", "call_2"]);
    expect(results[0]!.content).toContain("Read the documentation instead.");
    expect(results.slice(1).every(message => message.content.includes("ACTION CANCELLED"))).toBe(true);
    await expect(readFile(path.join(workspace, "never-written.txt"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("registers before publishing, accepts once, and presents batch approvals sequentially", async () => {
    const { agent, events, run } = fixture([
      call("write_file", { path: "a.txt", content: "A" }, 0),
      call("write", { path: "b.txt", content: "B" }, 1),
    ]);
    await run(event => {
      if (event.type !== "approval_request") return;
      const response = { approvalId: event.approvalId!, decision: "allow_once" as const };
      expect(agent.resolveApproval(event.approvalId!, response)).toBe(true);
      expect(agent.resolveApproval(event.approvalId!, response)).toBe(false);
    });
    expect(events.filter(event => event.type.startsWith("approval_")).map(event => `${event.type}:${event.toolCallId || event.decision}`)).toEqual([
      "approval_request:call_0", "approval_resolved:allow_once", "approval_request:call_1", "approval_resolved:allow_once",
    ]);
    expect(await readFile(path.join(workspace, "a.txt"), "utf8")).toBe("A");
    expect(await readFile(path.join(workspace, "b.txt"), "utf8")).toBe("B");
  });

  it("denying a later call after a skip supplies exactly one result per call", async () => {
    const { agent, requests, run } = fixture([0, 1, 2].map(index => call("bash", { command: `echo ${index}` }, index)));
    await run(event => {
      if (event.type === "approval_request") agent.resolveApproval(event.approvalId!, { approvalId: event.approvalId!, decision: event.toolCallId === "call_0" ? "skip" : "deny" });
    });
    expect(requests[1]!.messages.filter(message => message.role === "tool").map(message => message.tool_call_id)).toEqual(["call_0", "call_1", "call_2"]);
  });

  it.each(["write_file", "write-to-file", "apply_patch", "edit_file", "replace_file_content", "create_directory", "pwsh", "run-command", "run_python"])("requires review for alias %s", async name => {
    const { agent, events, run } = fixture([call(name, { path: "fixture.txt", command: "echo fixture", content: "fixture" }, 0)]);
    await run(event => {
      if (event.type === "approval_request") agent.resolveApproval(event.approvalId!, { approvalId: event.approvalId!, decision: "deny" });
    });
    expect(events.filter(event => event.type === "approval_request")).toHaveLength(1);
    await expect(readFile(path.join(workspace, "fixture.txt"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("requires permission before applying a real patch, then executes it on allow_once", async () => {
    await writeFile(path.join(workspace, "patch.txt"), "before");
    const { agent, run } = fixture([call("apply_patch", { path: "patch.txt", patch: "--- a/patch.txt\n+++ b/patch.txt\n@@ -1 +1 @@\n-before\n+after" }, 0)]);
    await run(event => {
      if (event.type === "approval_request") agent.resolveApproval(event.approvalId!, { approvalId: event.approvalId!, decision: "allow_once" });
    });
    expect(await readFile(path.join(workspace, "patch.txt"), "utf8")).toBe("after");
  });

  it.each(["write_file", "apply_patch"])("requires review for out-of-workspace %s in ask_before_changes", async name => {
    const { agent, events, run } = fixture([call(name, { path: path.join(workspace, "..", "outside.txt"), content: "denied" }, 0)], { mode: "ask_before_changes" });
    await run(event => {
      if (event.type === "approval_request") agent.resolveApproval(event.approvalId!, { approvalId: event.approvalId!, decision: "deny" });
    });
    expect(events.filter(event => event.type === "approval_request")).toHaveLength(1);
  });

  it("rejects a response for another approval without consuming the current request", async () => {
    const { agent, run } = fixture([call("write", { path: "a.txt", content: "A" }, 0)]);
    await run(event => {
      if (event.type !== "approval_request") return;
      expect(agent.resolveApproval(event.approvalId!, { approvalId: "wrong", decision: "allow_once" })).toBe(false);
      expect(agent.resolveApproval(event.approvalId!, { approvalId: event.approvalId!, decision: "deny" })).toBe(true);
    });
    await expect(readFile(path.join(workspace, "a.txt"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("aborting immediately after allowing cannot execute the action", async () => {
    const { agent, events, run } = fixture([call("write", { path: "a.txt", content: "A" }, 0)]);
    await run(event => {
      if (event.type !== "approval_request") return;
      agent.resolveApproval(event.approvalId!, { approvalId: event.approvalId!, decision: "allow_once" });
      agent.abort();
    });
    expect(events.some(event => event.type === "error")).toBe(true);
    await expect(readFile(path.join(workspace, "a.txt"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("switching to full access resolves the registered approval and remaining batch", async () => {
    const { agent, events, run } = fixture([0, 1].map(index => call("write", { path: `${index}.txt`, content: "allowed" }, index)));
    await run(event => { if (event.type === "approval_request") agent.updateMode("full_access"); });
    expect(events.filter(event => event.type === "approval_request")).toHaveLength(1);
    expect(await readFile(path.join(workspace, "1.txt"), "utf8")).toBe("allowed");
  });

  it("does not publish an orphaned prompt when cancelled during waiting status", async () => {
    const { agent, events, run } = fixture([call("write", { path: "a.txt", content: "A" }, 0)]);
    await run(event => { if (event.type === "status" && event.status === "waiting_approval") agent.abort(); });
    expect(events.some(event => event.type === "approval_request")).toBe(false);
    await expect(readFile(path.join(workspace, "a.txt"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("normalizes persisted grants and tool calls using the same spelling", async () => {
    const { events, run } = fixture([call("write_file", { path: "a.txt", content: "A" }, 0)], { initialAllowedTools: ["write-file"] });
    await run(() => {});
    expect(events.some(event => event.type === "approval_request")).toBe(false);
    expect(await readFile(path.join(workspace, "a.txt"), "utf8")).toBe("A");
  });
});

describe("tool policy", () => {
  it("shares normalization for separators and legacy mutation names", () => {
    expect(normalizeToolName("WRITE_FILE")).toBe(normalizeToolName("write-file"));
    expect(normalizeToolName("write_to_file")).toBe("writefile");
    expect(normalizeToolName("replace_file_content")).toBe("replaceinfile");
    expect(getToolActionKind("apply_patch")).toBe("file_mutation");
    expect(getToolActionKind("pwsh")).toBe("terminal");
    expect(getToolActionKind("run_python")).toBe("python");
    expect(getToolActionKind("read_file")).toBeUndefined();
  });
});
