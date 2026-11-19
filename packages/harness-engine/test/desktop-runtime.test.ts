import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import type { AgentEvent } from "@const/agent/const";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPiHarnessAgent } from "../src/index.js";

function sseChunk(delta: object, finishReason: string | null = null) {
  return `data: ${JSON.stringify({
    id: "test-completion",
    object: "chat.completion.chunk",
    created: 1,
    model: "test-model",
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  })}\n\n`;
}

describe("PiHarnessAgent desktop runtime resilience", () => {
  let workspace: string;
  const cleanups: Array<() => Promise<void>> = [];

  beforeEach(async () => {
    workspace = await mkdtemp(path.join(os.tmpdir(), "const-pi-desktop-"));
  });

  afterEach(async () => {
    await Promise.allSettled(cleanups.splice(0).map((fn) => fn()));
    vi.restoreAllMocks();
    await rm(workspace, { recursive: true, force: true });
  });

  async function startServer(
    handler: (reqIndex: number, body: any, res: import("node:http").ServerResponse) => void | Promise<void>,
  ) {
    const requests: any[] = [];
    const server = createServer(async (req, res) => {
      try {
        req.setEncoding("utf8");
        let raw = "";
        for await (const chunk of req) raw += chunk;
        const body = JSON.parse(raw);
        const idx = requests.length;
        requests.push(body);
        await handler(idx, body, res);
      } catch (err: any) {
        res.writeHead(500).end(String(err));
      }
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    cleanups.push(() => new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
      server.closeAllConnections();
    }));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("No address");
    return { baseUrl: `http://127.0.0.1:${addr.port}/v1`, requests };
  }

  it("fails fast on Router HTTP 503 price/budget limit without blind retries and preserves the real message", async () => {
    const budgetMsg = "No available offer met the effective request price limits. A saved account or API-key budget tightened the catalogue ceiling.";
    const { baseUrl, requests } = await startServer((_idx, _body, res) => {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: budgetMsg } }));
    });

    const events: AgentEvent[] = [];
    const agent = createPiHarnessAgent({
      preset: "harness",
      baseUrl,
      apiKey: "fixture",
      model: "deepseek-v4.1-flash",
      workspacePath: workspace,
      mode: "full_access",
      nativeCapabilityEnabled: () => false,
    });

    await agent.run([{ role: "user", content: "Hello" }], (e) => events.push(e), { returnPartialOnFailure: true });

    expect(requests).toHaveLength(1);
    const runEnd = events.find((e) => e.type === "run_end");
    expect(runEnd).toMatchObject({ outcome: "failed", errorCategory: "model" });
    expect(runEnd?.type === "run_end" && runEnd.error).toContain("No available offer met the effective request price limits");
  });

  it("fails fast on SSE chunk.error 503 price/budget limit without retrying", async () => {
    const budgetMsg = "[openai-compatible-chat/ali/deepseek-v4.1-flash] [503]: No available offer met the effective request price limits.";
    const { baseUrl, requests } = await startServer((_idx, _body, res) => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(`data: ${JSON.stringify({ error: { code: "service_unavailable", message: budgetMsg } })}\n\n`);
    });

    const events: AgentEvent[] = [];
    const agent = createPiHarnessAgent({
      preset: "harness",
      baseUrl,
      apiKey: "fixture",
      model: "deepseek-v4.1-flash",
      workspacePath: workspace,
      mode: "full_access",
      nativeCapabilityEnabled: () => false,
    });

    await agent.run([{ role: "user", content: "Hello" }], (e) => events.push(e), { returnPartialOnFailure: true });

    expect(requests).toHaveLength(1);
    const runEnd = events.find((e) => e.type === "run_end");
    expect(runEnd).toMatchObject({ outcome: "failed", errorCategory: "model" });
  });

  it("retries once with downgraded thinkingLevel when a reasoning-only stream drops without output", async () => {
    const { baseUrl, requests } = await startServer((idx, _body, res) => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      if (idx === 0) {
        // Thinking-only stream that drops without finish_reason or content
        res.end(sseChunk({ role: "assistant", reasoning_content: "thinking deeply..." }, null));
        return;
      }
      res.end(
        sseChunk({ role: "assistant", content: "Recovered cleanly." }) +
        sseChunk({}, "stop") +
        "data: [DONE]\n\n",
      );
    });

    const events: AgentEvent[] = [];
    const agent = createPiHarnessAgent({
      preset: "harness",
      baseUrl,
      apiKey: "fixture",
      model: "glm-5.3-flash",
      thinkingLevel: "xhigh",
      workspacePath: workspace,
      mode: "full_access",
      nativeCapabilityEnabled: () => false,
    });

    const history = await agent.run([{ role: "user", content: "Build feature" }], (e) => events.push(e), { returnPartialOnFailure: true });

    expect(requests).toHaveLength(2);
    expect(requests[0].reasoning_effort).toBe("xhigh");
    expect(requests[1].reasoning_effort).toBe("medium");
    // Must not have injected an empty assistant message with raw thinking between user and retry
    expect(history.filter((m) => m.role === "assistant")).toHaveLength(1);
    expect(history.at(-1)?.content).toBe("Recovered cleanly.");
    expect(events.find((e) => e.type === "run_end")).toMatchObject({ outcome: "completed" });
  });

  it("compacts old thinking and large tool output on HTTP 413 and succeeds with a strictly smaller retry", async () => {
    const bodySizes: number[] = [];
    const { baseUrl, requests } = await startServer((idx, body, res) => {
      bodySizes.push(Buffer.byteLength(JSON.stringify(body)));
      if (idx === 0) {
        res.writeHead(413, { "content-type": "text/plain" });
        res.end("FUNCTION_PAYLOAD_TOO_LARGE");
        return;
      }
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(sseChunk({ role: "assistant", content: "Compacted and completed." }) + sseChunk({}, "stop") + "data: [DONE]\n\n");
    });

    const events: AgentEvent[] = [];
    const agent = createPiHarnessAgent({
      preset: "harness",
      baseUrl,
      apiKey: "fixture",
      model: "test-model",
      workspacePath: workspace,
      mode: "full_access",
      nativeCapabilityEnabled: () => false,
    });

    const priorMessages = [
      { role: "user" as const, content: "Inspect file" },
      {
        role: "assistant" as const,
        content: "Checking...",
        thinking: "R".repeat(8000),
        tool_calls: [{ id: "tc_1", type: "function" as const, function: { name: "read", arguments: '{"path":"a.txt"}' } }],
      },
      { role: "tool" as const, tool_call_id: "tc_1", name: "read", content: "X".repeat(12000) },
      { role: "assistant" as const, content: "Got it." },
      { role: "user" as const, content: "Summarize" },
    ];

    const history = await agent.run(priorMessages, (e) => events.push(e), { returnPartialOnFailure: true });

    expect(requests).toHaveLength(2);
    expect(bodySizes[1]).toBeLessThan(bodySizes[0]!);
    expect(history.at(-1)?.content).toBe("Compacted and completed.");
    expect(events.find((e) => e.type === "run_end")).toMatchObject({ outcome: "completed", recovery: "payload" });
  });

  it("stops an edit -> repeated verification failure loop (Reelmark pattern) after one strategy-change checkpoint", async () => {
    await writeFile(path.join(workspace, "app.txt"), "v0", "utf8");
    const { baseUrl, requests } = await startServer((idx, _body, res) => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      const isEditTurn = idx % 2 === 0;
      const toolCall = isEditTurn
        ? {
            index: 0,
            id: `call_write_${idx}`,
            type: "function",
            function: { name: "write", arguments: JSON.stringify({ path: "app.txt", content: `v${idx + 1}` }) },
          }
        : {
            index: 0,
            id: `call_check_${idx}`,
            type: "function",
            function: { name: "bash", arguments: JSON.stringify({ command: 'node -e "console.error(\'ASSERT_FAIL_SAME\'); process.exit(1)"' }) },
          };
      res.end(
        sseChunk({ role: "assistant", tool_calls: [toolCall] }) +
        sseChunk({}, "tool_calls") +
        "data: [DONE]\n\n",
      );
    });

    const events: AgentEvent[] = [];
    const agent = createPiHarnessAgent({
      preset: "harness",
      baseUrl,
      apiKey: "fixture",
      model: "test-model",
      workspacePath: workspace,
      mode: "full_access",
      maxTurns: 20,
      nativeCapabilityEnabled: () => false,
    });

    await agent.run([{ role: "user", content: "Fix app.txt until check passes" }], (e) => events.push(e), { returnPartialOnFailure: true });

    // Turn 1 write, 2 fail#1, 3 write, 4 fail#2 (triggers checkpoint on turn 5), 5 write, 6 fail#3 (hard stop!)
    expect(requests.length).toBeLessThanOrEqual(6);
    expect(events.some((e) => e.type === "progress_checkpoint" && e.kind === "repeated_result")).toBe(true);
    expect(events.find((e) => e.type === "run_end")).toMatchObject({ outcome: "failed", errorCategory: "stalled" });
    // Partial artifact is preserved
    expect(await readFile(path.join(workspace, "app.txt"), "utf8")).toMatch(/^v\d+$/);
  });

  it("advertises zero browser_* or computer_* tools when native capabilities are disabled", async () => {
    const { baseUrl, requests } = await startServer((_idx, _body, res) => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(sseChunk({ role: "assistant", content: "Coding tools only." }) + sseChunk({}, "stop") + "data: [DONE]\n\n");
    });

    const agent = createPiHarnessAgent({
      preset: "harness",
      baseUrl,
      apiKey: "fixture",
      model: "test-model",
      workspacePath: workspace,
      mode: "full_access",
      deferNativeTools: true,
      nativeCapabilityEnabled: () => false,
    });

    await agent.run([{ role: "user", content: "List tools" }], () => {}, { returnPartialOnFailure: true });

    const toolNames: string[] = (requests[0]?.tools ?? []).map((t: any) => t.function.name);
    expect(toolNames).toContain("read");
    expect(toolNames).toContain("write");
    expect(toolNames).toContain("edit");
    expect(toolNames).toContain("bash");
    expect(toolNames).toContain("todo_write");
    expect(toolNames).toContain("tool_search");
    // Retired redundant tools and deferred specialist tools stay out of default schema
    expect(toolNames.some((n) => ["run_command", "mkdir", "jfind", "git_status", "git_diff", "git_commit", "git_log", "think"].includes(n))).toBe(false);
    expect(toolNames.some((n) => ["ast_grep", "ast_edit", "lsp", "gh", "eval", "wait", "manage_task"].includes(n))).toBe(false);
    expect(toolNames.some((n) => n.startsWith("browser_") || n.startsWith("computer_") || n === "load_plugin_tools")).toBe(false);
  });

  it("activates deferred specialist tools on demand via tool_search and executes them on the next turn", async () => {
    const { baseUrl, requests } = await startServer((idx, _body, res) => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      if (idx === 0) {
        res.end(
          sseChunk({
            role: "assistant",
            tool_calls: [{ index: 0, id: "tc_search", type: "function", function: { name: "tool_search", arguments: '{"activate":["eval"]}' } }],
          }) + sseChunk({}, "tool_calls") + "data: [DONE]\n\n",
        );
        return;
      }
      if (idx === 1) {
        res.end(
          sseChunk({
            role: "assistant",
            tool_calls: [{ index: 0, id: "tc_eval", type: "function", function: { name: "eval", arguments: '{"code":"6 * 7"}' } }],
          }) + sseChunk({}, "tool_calls") + "data: [DONE]\n\n",
        );
        return;
      }
      res.end(sseChunk({ role: "assistant", content: "Computed 42." }) + sseChunk({}, "stop") + "data: [DONE]\n\n");
    });

    const events: AgentEvent[] = [];
    const agent = createPiHarnessAgent({
      preset: "harness",
      baseUrl,
      apiKey: "fixture",
      model: "test-model",
      workspacePath: workspace,
      mode: "full_access",
      nativeCapabilityEnabled: () => false,
    });

    await agent.run([{ role: "user", content: "Activate eval and run 6 * 7" }], (e) => events.push(e), { returnPartialOnFailure: true });

    const turn1Tools: string[] = (requests[0]?.tools ?? []).map((t: any) => t.function.name);
    const turn2Tools: string[] = (requests[1]?.tools ?? []).map((t: any) => t.function.name);
    expect(turn1Tools).not.toContain("eval");
    expect(turn2Tools).toContain("eval");
    const evalResult = events.find((e) => e.type === "tool_result" && e.toolCallId === "tc_eval");
    expect(evalResult?.type === "tool_result" && evalResult.isError).toBe(false);
    expect(evalResult?.type === "tool_result" && String(evalResult.result)).toContain("42");
  });

  it("supports atomic multi-edit and returns closest-line hints when edit target mismatches", async () => {
    await writeFile(path.join(workspace, "demo.ts"), "const alpha = 1;\nconst beta = 2;\nconst gamma = 3;\n", "utf8");
    const { baseUrl } = await startServer((idx, _body, res) => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      if (idx === 0) {
        res.end(
          sseChunk({
            role: "assistant",
            tool_calls: [{ index: 0, id: "tc_read", type: "function", function: { name: "read", arguments: '{"path":"demo.ts"}' } }],
          }) + sseChunk({}, "tool_calls") + "data: [DONE]\n\n",
        );
        return;
      }
      if (idx === 1) {
        // Intentional near-miss edit to verify closest-line hint
        res.end(
          sseChunk({
            role: "assistant",
            tool_calls: [{ index: 0, id: "tc_miss", type: "function", function: { name: "edit", arguments: '{"path":"demo.ts","old_content":"const beta = 999;","new_content":"const beta = 20;"}' } }],
          }) + sseChunk({}, "tool_calls") + "data: [DONE]\n\n",
        );
        return;
      }
      if (idx === 2) {
        // Atomic multi-edit
        res.end(
          sseChunk({
            role: "assistant",
            tool_calls: [{
              index: 0,
              id: "tc_batch",
              type: "function",
              function: {
                name: "edit",
                arguments: JSON.stringify({
                  path: "demo.ts",
                  edits: [
                    { old_content: "const alpha = 1;", new_content: "const alpha = 10;" },
                    { old_content: "const gamma = 3;", new_content: "const gamma = 30;" },
                  ],
                }),
              },
            }],
          }) + sseChunk({}, "tool_calls") + "data: [DONE]\n\n",
        );
        return;
      }
      res.end(sseChunk({ role: "assistant", content: "Updated." }) + sseChunk({}, "stop") + "data: [DONE]\n\n");
    });

    const events: AgentEvent[] = [];
    const agent = createPiHarnessAgent({
      preset: "harness",
      baseUrl,
      apiKey: "fixture",
      model: "test-model",
      workspacePath: workspace,
      mode: "full_access",
      nativeCapabilityEnabled: () => false,
    });

    await agent.run([{ role: "user", content: "Edit demo.ts" }], (e) => events.push(e), { returnPartialOnFailure: true });

    const missResult = events.find((e) => e.type === "tool_result" && e.toolCallId === "tc_miss");
    expect(missResult?.type === "tool_result" && missResult.isError).toBe(true);
    expect(missResult?.type === "tool_result" && String(missResult.result)).toContain("Closest match around lines");
    expect(missResult?.type === "tool_result" && String(missResult.result)).toContain("const beta = 2;");
    expect(await readFile(path.join(workspace, "demo.ts"), "utf8")).toBe("const alpha = 10;\nconst beta = 2;\nconst gamma = 30;\n");
  });

  it("supports granular todo_write operations (add, update, remove, clear) in addition to full replacement", async () => {
    const { baseUrl } = await startServer((idx, _body, res) => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      if (idx === 0) {
        res.end(
          sseChunk({
            role: "assistant",
            tool_calls: [{ index: 0, id: "t1", type: "function", function: { name: "todo_write", arguments: '{"operation":"add","id":"step-1","content":"Build engine","status":"in_progress"}' } }],
          }) + sseChunk({}, "tool_calls") + "data: [DONE]\n\n",
        );
        return;
      }
      if (idx === 1) {
        res.end(
          sseChunk({
            role: "assistant",
            tool_calls: [{ index: 0, id: "t2", type: "function", function: { name: "todo_write", arguments: '{"operation":"update","id":"step-1","status":"completed"}' } }],
          }) + sseChunk({}, "tool_calls") + "data: [DONE]\n\n",
        );
        return;
      }
      res.end(sseChunk({ role: "assistant", content: "Todos tracked." }) + sseChunk({}, "stop") + "data: [DONE]\n\n");
    });

    const todoUpdates: any[] = [];
    const agent = createPiHarnessAgent({
      preset: "harness",
      baseUrl,
      apiKey: "fixture",
      model: "test-model",
      workspacePath: workspace,
      mode: "full_access",
      nativeCapabilityEnabled: () => false,
    });

    await agent.run([{ role: "user", content: "Track todos" }], (e) => {
      if (e.type === "todo_update") todoUpdates.push(e.todos);
    }, { returnPartialOnFailure: true });

    expect(todoUpdates).toHaveLength(2);
    expect(todoUpdates[0]).toEqual([{ id: "step-1", content: "Build engine", status: "in_progress" }]);
    expect(todoUpdates[1]).toEqual([{ id: "step-1", content: "Build engine", status: "completed" }]);
  });
});
