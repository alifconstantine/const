import { once } from "node:events";
import { writeFileSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { globalTaskManager, type BackgroundTaskListener } from "@const/agent/const";
import type { AgentEvent } from "@earendil-works/pi-agent-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHarnessEngine, type HarnessEngineEvent, type HarnessEngineOptions } from "../src/index.js";

interface Request {
  url: string | undefined;
  authorization: string | undefined;
  body: {
    model: string;
    messages: Array<{ role: string; tool_call_id?: string; content: string | null }>;
    tools: Array<{ type: string; function: { name: string; parameters: object } }>;
  };
}

interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

function delta(value: object, finishReason: string | null = null) {
  return {
    id: "test-completion",
    object: "chat.completion.chunk",
    created: 1,
    model: "test-model",
    choices: [{ index: 0, delta: value, finish_reason: finishReason }],
  };
}

function toolCalls(calls: ToolCall[], finish = true) {
  const chunks: Array<object | string> = [
    delta({
      role: "assistant",
      tool_calls: calls.map(({ id, name, arguments: args }, index) => ({
        index, id, type: "function", function: { name, arguments: args },
      })),
    }),
  ];
  if (finish) chunks.push(delta({}, "tool_calls"), "[DONE]");
  return chunks;
}

const finalAnswer = [delta({ role: "assistant", content: "Done." }), delta({}, "stop"), "[DONE]"];
const writeCall = { id: "call_write", name: "write", arguments: '{"path":"note.txt","content":"hello from Pi"}' };

function readCall(index: number, file: string, offset?: number) {
  return { id: `call_read_${index}`, name: "read", arguments: JSON.stringify({ path: file, offset, limit: 1 }) };
}

function call(id: string, name: string, args: object): ToolCall {
  return { id, name, arguments: JSON.stringify(args) };
}

const question = call("call_question", "ask_question", {
  questions: [{ id: "name", question: "What is the name?" }],
});

describe("Pi Harness engine with a local OpenAI-compatible endpoint", () => {
  let workspace: string;
  const cleanup: Array<() => Promise<void> | void> = [];
  const sessions = new Set<string>();

  beforeEach(async () => {
    workspace = await mkdtemp(path.join(os.tmpdir(), "const-harness-engine-"));
    vi.spyOn(os, "homedir").mockReturnValue(path.join(workspace, ".fixture-home"));
  });

  afterEach(async () => {
    const closes: Promise<unknown>[] = [];
    for (const sessionId of sessions) {
      for (const { id } of globalTaskManager.listTasks(sessionId)) {
        const child = globalTaskManager.getTask(id, sessionId)?.child;
        if (child && child.exitCode === null && child.signalCode === null) closes.push(once(child, "close"));
        globalTaskManager.killTask(id, sessionId);
      }
    }
    sessions.clear();
    await Promise.allSettled([...cleanup.splice(0).map((close) => close()), ...closes]);
    vi.restoreAllMocks();
    await rm(workspace, { recursive: true, force: true });
  });

  async function start(
    replies: Array<Array<object | string> | number>,
    options: Partial<HarnessEngineOptions> = {},
  ) {
    const requests: Request[] = [];
    const server = createServer(async (req, res) => {
      try {
        req.setEncoding("utf8");
        let body = "";
        for await (const chunk of req) body += chunk;
        const reply = replies[requests.length];
        requests.push({ url: req.url, authorization: req.headers.authorization, body: JSON.parse(body) });
        if (!reply || typeof reply === "number") {
          res.writeHead(reply ?? 500, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: { message: reply === 503 ? "No eligible price offer" : "Unexpected request" } }));
          return;
        }
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.end(reply.map((chunk) => `data: ${typeof chunk === "string" ? chunk : JSON.stringify(chunk)}\n\n`).join(""));
      } catch {
        res.writeHead(500).end();
      }
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    cleanup.push(() => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    }));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test server address");
    const engine = createHarnessEngine({
      model: {
        id: "test-model",
        name: "Test model",
        api: "openai-completions",
        provider: "const",
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        reasoning: false,
        input: ["text"],
        contextWindow: 32_768,
        maxTokens: 2_048,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      },
      apiKey: "fixture",
      workspacePath: workspace,
      systemPrompt: "Work in the provided workspace.",
      onWorkspaceEvent: () => {},
      ...options,
    });
    sessions.add(engine.sessionId);
    const events: AgentEvent[] = [];
    engine.agent.subscribe((event) => { events.push(event); });
    return Object.assign(engine, { requests, events });
  }

  it("executes native file tools in order and sends their matching results back to the model", async () => {
    const mutations: string[] = [];
    const { agent, requests, events } = await start([
      toolCalls([writeCall, { id: "call_read", name: "read", arguments: '{"path":"note.txt"}' }]),
      finalAnswer,
    ], {
      onWorkspaceEvent: (event) => {
        if (event.type === "file_mutation") mutations.push(event.record.newContent!);
      },
    });

    await agent.prompt("Write a note, then read it back.");

    expect(await readFile(path.join(workspace, "note.txt"), "utf8")).toBe("hello from Pi");
    expect(mutations).toEqual(["hello from Pi"]);
    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({ url: "/v1/chat/completions", authorization: "Bearer fixture", body: { model: "test-model" } });
    expect(requests[0].body.messages[0]).toMatchObject({ role: "system", content: "Work in the provided workspace." });
    expect(requests[0].body.tools.map((tool) => tool.function.name).sort()).toEqual([
      "ask_question", "bash", "edit", "find", "grep", "ls", "read", "todo_write", "write",
    ]);
    expect(requests[1].body.messages.filter((message) => message.role === "tool")).toEqual([
      expect.objectContaining({ tool_call_id: "call_write", content: expect.stringContaining("File written successfully") }),
      expect.objectContaining({ tool_call_id: "call_read", content: expect.stringContaining("hello from Pi") }),
    ]);
    expect(agent.state.messages.at(-1)).toMatchObject({ role: "assistant", stopReason: "stop", content: [{ type: "text", text: "Done." }] });
    expect(events.filter(({ type }) => type === "agent_end")).toHaveLength(1);
  });

  it("reports a schema validation error without authorizing or executing a malformed write", async () => {
    const workspaceEvents: string[] = [];
    const { agent, requests } = await start([
      toolCalls([{ ...writeCall, arguments: '{"path":"note.txt"}' }]),
      finalAnswer,
    ], {
      mode: "request_review",
      onWorkspaceEvent: (event) => {
        if (event.type === "approval_request" || event.type === "file_mutation") workspaceEvents.push(event.type);
      },
    });

    await agent.prompt("Write a note.");

    expect(await readdir(workspace)).toEqual([]);
    expect(workspaceEvents).toEqual([]);
    expect(requests).toHaveLength(2);
    expect(requests[1].body.messages.find((message) => message.role === "tool")).toMatchObject({
      tool_call_id: "call_write", content: expect.stringMatching(/validation.*write/i),
    });
  });

  it("cancels an approval and closes the run once without writing", async () => {
    const approvals: string[] = [];
    const { agent, requests, events, resolveApproval } = await start([toolCalls([writeCall])], {
      mode: "request_review",
      onWorkspaceEvent: (event) => {
        if (event.type !== "approval_request") return;
        approvals.push(event.approvalId);
        agent.abort();
      },
    });

    await agent.prompt("Write a note.");

    expect(approvals).toHaveLength(1);
    expect(resolveApproval(approvals[0], { approvalId: approvals[0], decision: "allow_once" })).toBe(false);
    expect(await readdir(workspace)).toEqual([]);
    expect(requests).toHaveLength(1);
    expect(events.filter(({ type }) => type === "agent_end")).toHaveLength(1);
    expect(agent.state.isStreaming).toBe(false);
  });

  it("skips later calls in a batch after an explicit denial", async () => {
    const approvals: string[] = [];
    const { agent, requests, resolveApproval } = await start([
      toolCalls([writeCall, { id: "call_write_2", name: "write", arguments: '{"path":"second.txt","content":"second note"}' }]),
      finalAnswer,
    ], {
      mode: "request_review",
      onWorkspaceEvent: (event) => {
        if (event.type !== "approval_request") return;
        approvals.push(event.toolCallId);
        resolveApproval(event.approvalId, { approvalId: event.approvalId, decision: "deny" });
      },
    });

    await agent.prompt("Write two notes.");

    expect(approvals).toEqual(["call_write"]);
    expect(await readdir(workspace)).toEqual([]);
    expect(requests[1].body.messages.filter((message) => message.role === "tool")).toEqual([
      expect.objectContaining({ tool_call_id: "call_write", content: expect.stringContaining("denied permission") }),
      expect.objectContaining({ tool_call_id: "call_write_2", content: expect.stringContaining("earlier action") }),
    ]);
  });

  it("commits no mutation when the stream ends without a finish reason", async () => {
    const { agent, events, requests } = await start([toolCalls([writeCall], false)]);

    await agent.prompt("Write a note.");

    expect(await readdir(workspace)).toEqual([]);
    expect(requests).toHaveLength(1);
    expect(events.some((event) => event.type === "tool_execution_start")).toBe(false);
    expect(agent.state.errorMessage).toContain("without finish_reason");
  });

  it("rejects malformed JSON even when the provider sends a tool finish reason", async () => {
    const { agent, requests } = await start([
      toolCalls([{ ...writeCall, arguments: '{"path":"note.txt","content":"looks complete"' }]),
      finalAnswer,
    ]);

    await agent.prompt("Write a note.");

    expect(await readdir(workspace)).toEqual([]);
    expect(requests[1].body.messages.find((message) => message.role === "tool")).toMatchObject({
      tool_call_id: "call_write", content: expect.stringMatching(/invalid|parse|json/i),
    });
  });

  it("retains partial thinking and reports failure when a reasoning-only stream drops", async () => {
    const { agent, requests, events } = await start([[delta({ reasoning_content: "I need to inspect the workspace." })]]);

    await agent.prompt("Inspect the workspace.");

    expect(requests).toHaveLength(1);
    expect(agent.state.errorMessage).toContain("without finish_reason");
    expect(agent.state.messages.at(-1)).toMatchObject({
      role: "assistant",
      stopReason: "error",
      content: [{ type: "thinking", thinking: "I need to inspect the workspace." }],
    });
    expect(events.some(({ type }) => type === "tool_execution_start")).toBe(false);
  });

  it("surfaces Router errors without repeating the same provider request", async () => {
    const { agent, requests } = await start([503]);

    await agent.prompt("Write a note.");

    expect(requests).toHaveLength(1);
    expect(agent.state.errorMessage).toContain("No eligible price offer");
  });

  it("lets the host stop in finishTurn after the paired tool result has been recorded", async () => {
    const { agent, requests } = await start([toolCalls([writeCall])], {
      finishTurn: ({ toolResults }) => {
        expect(toolResults).toMatchObject([{ toolCallId: "call_write", isError: false }]);
        return { action: "end" };
      },
    });

    await agent.prompt("Write a note.");

    expect(requests).toHaveLength(1);
    expect(agent.state.errorMessage).toBeUndefined();
    expect(agent.state.messages.at(-1)).toMatchObject({ role: "toolResult", toolCallId: "call_write" });
  });

  it("gives one opportunity to break an A/B loop, then stops with the last results intact", async () => {
    await writeFile(path.join(workspace, "a.txt"), "one");
    await writeFile(path.join(workspace, "b.txt"), "two");
    const checkpoints: number[] = [];
    const engine = await start(Array.from({ length: 7 }, (_, index) =>
      toolCalls([readCall(index, index % 2 ? "b.txt" : "a.txt")]),
    ), {
      onWorkspaceEvent: (event) => {
        if (event.type === "progress_checkpoint" && event.kind === "repeated_result") checkpoints.push(event.turn);
      },
    });

    await engine.agent.prompt("Read both files.");

    expect(engine.requests).toHaveLength(7);
    expect(checkpoints).toEqual([7]);
    const systemPrompt = engine.requests[6].body.messages[0].content;
    expect(systemPrompt?.length).toBeGreaterThan("Work in the provided workspace.".length);
    expect(engine.agent.state.systemPrompt).toBe("Work in the provided workspace.");
    expect(engine.stopReason?.category).toBe("stalled");
    expect(engine.agent.state.messages.at(-1)).toMatchObject({ role: "toolResult", toolCallId: "call_read_6" });
    expect(engine.events.filter(({ type }) => type === "agent_end")).toHaveLength(1);
  });

  it("continues when the model changes approach after the loop warning", async () => {
    await writeFile(path.join(workspace, "a.txt"), "one");
    await writeFile(path.join(workspace, "b.txt"), "two");
    await writeFile(path.join(workspace, "summary.txt"), "different evidence");
    const repeating = Array.from({ length: 6 }, (_, index) =>
      toolCalls([readCall(index, index % 2 ? "b.txt" : "a.txt")]),
    );
    const engine = await start([...repeating, toolCalls([readCall(6, "summary.txt")]), finalAnswer]);

    await engine.agent.prompt("Read the relevant evidence.");

    expect(engine.requests).toHaveLength(8);
    expect(engine.requests[7].body.messages[0].content).toBe("Work in the provided workspace.");
    expect(engine.requests[7].body.messages.at(-1)).toMatchObject({
      tool_call_id: "call_read_6", content: expect.stringContaining("different evidence"),
    });
    expect(engine.stopReason).toBeUndefined();
  });

  it("finishes a progressing run beyond 200 model turns", async () => {
    const lines = Array.from({ length: 201 }, (_, index) => `Evidence from line ${index + 1}`);
    await writeFile(path.join(workspace, "steps.txt"), lines.join("\n"));
    const replies = lines.map((_, index) => toolCalls([readCall(index, "steps.txt", index + 1)]));
    const engine = await start([...replies, finalAnswer]);

    await engine.agent.prompt("Inspect each line.");

    expect(engine.requests).toHaveLength(202);
    expect(engine.requests[201].body.messages.at(-1)).toMatchObject({
      tool_call_id: "call_read_200", content: expect.stringContaining("Evidence from line 201"),
    });
    expect(engine.agent.state.messages.at(-1)).toMatchObject({ role: "assistant", stopReason: "stop" });
    expect(engine.stopReason).toBeUndefined();
  }, 15_000);

  it("honors a caller's explicit limit without replaying a successful mutation", async () => {
    const engine = await start([toolCalls([writeCall])], { maxTurns: 1 });

    await engine.agent.prompt("Write a note.");

    expect(engine.requests).toHaveLength(1);
    expect(await readFile(path.join(workspace, "note.txt"), "utf8")).toBe("hello from Pi");
    expect(engine.stopReason?.category).toBe("turn_limit");
    expect(engine.agent.state.messages.at(-1)).toMatchObject({ role: "toolResult", toolCallId: "call_write" });
  });

  it("runs foreground Bash with approval and emits a single tagged terminal event", async () => {
    const hostEvents: HarnessEngineEvent[] = [];
    const engine = await start([toolCalls([call("call_shell", "bash", { command: "node --version" })]), finalAnswer], {
      onWorkspaceEvent: (event) => {
        hostEvents.push(event);
        if (event.type !== "approval_request") return;
        expect(engine.snapshot()).toMatchObject({
          phase: "waiting_approval",
          pendingApproval: { approvalId: event.approvalId, command: "node --version" },
        });
        expect(engine.resolveApproval(event.approvalId, { approvalId: event.approvalId, decision: "allow_once" })).toBe(true);
      },
    });

    await engine.agent.prompt("Check the installed Node version.");

    const ends = hostEvents.filter((event) => event.type === "run_end");
    const phases = hostEvents.filter((event) => event.type === "run_phase");
    expect(phases.map(({ phase }) => phase)).toEqual(["thinking", "running_tool", "waiting_approval", "running_tool", "thinking"]);
    expect(new Set(hostEvents.map(({ runId }) => runId))).toEqual(new Set([ends[0]?.runId]));
    expect(ends).toEqual([{ type: "run_end", runId: expect.any(String), outcome: "completed" }]);
    expect(engine.snapshot()).toMatchObject({ phase: "idle", pendingApproval: undefined, lastRun: ends[0] });
    expect(engine.requests[1].body.messages.at(-1)).toMatchObject({
      tool_call_id: "call_shell", content: expect.stringContaining(process.version),
    });
  });

  it("restores the committed Todo and restores an intentional clear from serialized history", async () => {
    const todos = [{ id: "step-1", content: "Inspect the workspace", status: "in_progress" }];
    const first = await start([toolCalls([call("call_todo", "todo_write", { todos })]), finalAnswer]);
    await first.agent.prompt("Add a step to the plan.");
    expect(first.snapshot().todos).toEqual(todos);
    const history = JSON.parse(JSON.stringify(first.agent.state.messages));

    const second = await start([toolCalls([call("call_clear", "todo_write", { todos: [] })]), finalAnswer], {
      messages: history,
      sessionId: first.sessionId,
    });
    expect(second.snapshot().todos).toEqual(todos);
    await second.agent.prompt("Clear the plan.");
    expect(second.snapshot().todos).toEqual([]);
    const restored = await start([], { messages: JSON.parse(JSON.stringify(second.agent.state.messages)) });
    expect(restored.snapshot().todos).toEqual([]);
    const secondRequest = second.requests[1].body.messages.at(-1);
    expect(secondRequest).toMatchObject({ tool_call_id: "call_clear", content: expect.stringContaining("0 total") });
    expect(secondRequest).not.toHaveProperty("details");
  });

  it("accepts the matching question answer exactly once and includes it in the next request", async () => {
    const hostEvents: HarnessEngineEvent[] = [];
    const engine = await start([toolCalls([question]), finalAnswer], {
      onWorkspaceEvent: (event) => { hostEvents.push(event); },
    });

    const pendingRun = engine.agent.prompt("Ask for the name.");
    cleanup.push(() => { engine.agent.abort(); return engine.agent.waitForIdle(); });
    await vi.waitFor(() => {
      expect(engine.snapshot()).toMatchObject({
        phase: "waiting_question", pendingQuestion: { toolCallId: question.id, questions: [{ id: "name" }] },
      });
    });
    const requestId = engine.snapshot().pendingQuestion!.requestId;
    expect(engine.requests).toHaveLength(1);
    expect(engine.answerQuestion(question.id, "stale")).toBe(false);
    expect(engine.answerQuestion(requestId, { name: "Nara" })).toBe(true);
    expect(engine.answerQuestion(requestId, "duplicate")).toBe(false);
    await pendingRun;

    expect(engine.requests[1].body.messages.at(-1)).toMatchObject({ tool_call_id: question.id, content: '{"name":"Nara"}' });
    expect(hostEvents.filter(({ type }) => type === "question_resolved")).toEqual([
      { type: "question_resolved", runId: expect.any(String), requestId, toolCallId: question.id, outcome: "answered" },
    ]);
    expect(engine.snapshot()).toMatchObject({ phase: "idle", pendingQuestion: undefined, lastRun: { outcome: "completed" } });
  });

  it("stops while a question is pending and resumes from its transcript without replaying a write", async () => {
    const hostEvents: HarnessEngineEvent[] = [];
    const first = await start([toolCalls([
      writeCall, question, call("later_write", "write", { path: "later.txt", content: "never reached" }),
    ])], {
      onWorkspaceEvent: (event) => {
        hostEvents.push(event);
        if (event.type === "ask_question") first.agent.abort();
      },
    });
    await first.agent.prompt("Write a note, ask for a name, then write a follow-up.");

    expect(first.requests).toHaveLength(1);
    expect(await readdir(workspace)).toEqual(["note.txt"]);
    expect(hostEvents.filter(({ type }) => type === "file_mutation")).toHaveLength(1);
    expect(hostEvents.filter(({ type }) => type === "question_resolved")).toMatchObject([{ outcome: "cancelled" }]);
    expect(hostEvents.filter(({ type }) => type === "run_end")).toMatchObject([{ outcome: "cancelled" }]);
    expect(first.snapshot()).toMatchObject({ phase: "idle", pendingQuestion: undefined });
    const requestId = hostEvents.find((event) => event.type === "ask_question")?.requestId;
    expect(requestId).toBeTypeOf("string");
    expect(first.answerQuestion(requestId!, "late")).toBe(false);

    const resumedEvents: HarnessEngineEvent[] = [];
    const second = await start([finalAnswer], {
      messages: JSON.parse(JSON.stringify(first.agent.state.messages)),
      sessionId: first.sessionId,
      onWorkspaceEvent: (event) => { resumedEvents.push(event); },
    });
    await second.agent.continue();

    expect(second.requests[0].body.messages.filter((message) => message.role === "tool")).toEqual([
      expect.objectContaining({ tool_call_id: writeCall.id, content: expect.stringContaining("written successfully") }),
      expect.objectContaining({ tool_call_id: question.id, content: expect.stringContaining("Failed to receive answer") }),
      expect.objectContaining({ tool_call_id: "later_write", content: "No result provided" }),
    ]);
    expect(resumedEvents.filter(({ type }) => type === "file_mutation")).toHaveLength(0);
    expect(await readdir(workspace)).toEqual(["note.txt"]);
  });

  it("advertises job tools after Bash starts a process and wakes wait on its exit event", async () => {
    const jobEvents: Parameters<BackgroundTaskListener>[0][] = [];
    const waitForActivity = vi.spyOn(globalTaskManager, "waitForActivity");
    const hostEvents: HarnessEngineEvent[] = [];
    const idleWaits = Array.from({ length: 4 }, (_, index) =>
      toolCalls([call(`idle_wait_${index}`, "wait", { timeout: 30 })]),
    );
    const engine = await start([
      toolCalls([call("call_job", "bash", {
        command: "node -e \"const fs=require('node:fs'); setInterval(() => { if (fs.existsSync('job-finish')) process.exit(7) }, 20)\"",
        name: "fixture-build",
        async: true,
      })]),
      toolCalls([call("call_wait", "wait", { task_id: "fixture-build", timeout: 30 })]),
      finalAnswer,
      ...idleWaits,
    ], {
      mode: "full_access",
      onWorkspaceEvent: (event) => {
        hostEvents.push(event);
        if (event.type === "run_phase" && event.phase === "waiting_job") writeFileSync(path.join(workspace, "job-finish"), "");
      },
    });
    cleanup.push(engine.subscribeJobs((event) => { jobEvents.push(event); }));

    await engine.agent.prompt("Run the check in the background, then wait for it.");

    expect(engine.requests[0].body.tools.map((tool) => tool.function.name)).not.toContain("wait");
    expect(engine.requests[1].body.tools.map((tool) => tool.function.name)).toEqual(expect.arrayContaining(["wait", "manage_task"]));
    expect(waitForActivity).toHaveBeenCalledTimes(1);
    expect(hostEvents.filter(({ type }) => type === "task_started")).toHaveLength(1);
    expect(jobEvents.filter(({ type }) => type === "status")).toMatchObject([{ status: "failed", code: 7 }]);
    expect(engine.snapshot().jobs).toMatchObject([{ status: "failed", exitCode: 7 }]);
    expect(engine.requests[2].body.messages.at(-1)).toMatchObject({
      tool_call_id: "call_wait", content: expect.stringContaining("Process exited with code 7"),
    });

    await engine.agent.prompt("Wait for anything still running.");
    expect(engine.requests).toHaveLength(7);
    expect(waitForActivity).toHaveBeenCalledTimes(1);
    expect(engine.snapshot().lastRun).toMatchObject({ outcome: "failed", errorCategory: "stalled" });
  });

  it("keeps a service from an earlier run manageable after chat and preserves it when a later wait is stopped", async () => {
    const hostEvents: HarnessEngineEvent[] = [];
    const jobEvents: Parameters<BackgroundTaskListener>[0][] = [];
    const engine = await start([
      toolCalls([call("service_start", "bash", {
        command: "node -e \"const s=require('node:http').createServer((req,res)=>res.end('fixture-service')); s.listen(0,'127.0.0.1',()=>console.log('listening on port '+s.address().port))\"",
        name: "fixture-service",
        async: true,
      })]),
      finalAnswer,
      toolCalls([call("service_wait", "wait", { task_id: "fixture-service", timeout: 30 })]),
      toolCalls([call("service_stop", "manage_task", { action: "kill", task_id: "fixture-service" })]),
      finalAnswer,
    ], {
      mode: "full_access",
      onWorkspaceEvent: (event) => {
        hostEvents.push(event);
        if (event.type === "run_phase" && event.phase === "waiting_job") setImmediate(() => engine.agent.abort());
      },
    });
    cleanup.push(engine.subscribeJobs((event) => { jobEvents.push(event); }));
    await engine.agent.prompt("Start the service and leave it running.");
    expect(engine.snapshot()).toMatchObject({ phase: "idle", lastRun: { outcome: "completed" }, jobs: [{ status: "running" }] });
    await vi.waitFor(() => {
      expect(jobEvents).toContainEqual(expect.objectContaining({ type: "output", data: expect.stringMatching(/listening on port \d+/) }));
    });

    const isolated = await start([]);
    const [job] = engine.snapshot().jobs;
    expect(job.port).toBeTypeOf("number");
    expect(isolated.snapshot().jobs).toEqual([]);
    expect(isolated.stopJob(job.id)).toBe(false);
    const response = await fetch(`http://127.0.0.1:${job.port}`);
    expect(await response.text()).toBe("fixture-service");
    await engine.agent.prompt("Wait for the service.");
    expect(engine.requests).toHaveLength(3);
    expect(engine.snapshot()).toMatchObject({ lastRun: { outcome: "cancelled" }, jobs: [{ id: job.id, status: "running" }] });

    await engine.agent.prompt("Stop the same service.");
    expect(engine.requests).toHaveLength(5);
    expect(engine.snapshot().jobs).toMatchObject([{ id: job.id, status: "killed" }]);
    expect(hostEvents.filter((event) => event.type === "run_end").map(({ outcome }) => outcome)).toEqual(["completed", "cancelled", "completed"]);
    expect(jobEvents.filter(({ type }) => type === "status")).toMatchObject([{ taskId: job.id, status: "killed" }]);
  });

  it("cancels a job created by the active run when stopped during wait", async () => {
    const waitForActivity = vi.spyOn(globalTaskManager, "waitForActivity");
    const hostEvents: HarnessEngineEvent[] = [];
    const engine = await start([
      toolCalls([call("service_start", "bash", {
        command: "node -e \"setInterval(() => {}, 1000)\"",
        name: "owned-by-run",
        async: true,
      })]),
      toolCalls([call("service_wait", "wait", { task_id: "owned-by-run", timeout: 30 })]),
    ], {
      mode: "full_access",
      onWorkspaceEvent: (event) => {
        hostEvents.push(event);
        if (event.type === "run_phase" && event.phase === "waiting_job") setImmediate(() => engine.agent.abort());
      },
    });

    await engine.agent.prompt("Start a worker and wait for it.");

    expect(waitForActivity).toHaveBeenCalledTimes(1);
    expect(engine.requests).toHaveLength(2);
    expect(engine.snapshot()).toMatchObject({ phase: "idle", lastRun: { outcome: "cancelled" }, jobs: [{ status: "killed" }] });
    expect(hostEvents.filter((event) => event.type === "run_end")).toMatchObject([{ outcome: "cancelled" }]);
  });

  it("reconciles saved tool declarations on the first resumed request", async () => {
    const first = await start([toolCalls([call("service_start", "bash", {
      command: "node -e \"setInterval(() => {}, 1000)\"",
      name: "resumable-service",
      async: true,
    })])], { mode: "full_access", maxTurns: 1 });
    await first.agent.prompt("Start the service.");
    const history = JSON.parse(JSON.stringify(first.agent.state.messages));
    const resumed = await start([
      toolCalls([call("resumed_status", "manage_task", { action: "status", task_id: "resumable-service" })]),
      finalAnswer,
    ], { sessionId: first.sessionId, messages: history });

    await resumed.agent.continue();

    expect(resumed.requests[0].body.tools.map((tool) => tool.function.name)).toContain("manage_task");
    expect(resumed.requests[1].body.messages.at(-1)?.content).toContain('status="running"');
    expect(resumed.snapshot().jobs).toHaveLength(1);
    expect(first.stopJob(resumed.snapshot().jobs[0].id)).toBe(true);
  });
});
