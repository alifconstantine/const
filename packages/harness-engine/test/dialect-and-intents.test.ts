import { describe, expect, it, vi } from "vitest";
import {
  buildDialectRequest,
  consumeDialectStream,
  createPiHarnessAgent,
  resolveProviderDialect,
} from "../src/index.js";

function sseStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const evt of events) {
        controller.enqueue(encoder.encode(evt));
      }
      controller.close();
    },
  });
}

describe("Multi-Dialect LLM Transport (Phase 4)", () => {
  it("resolves dialect from explicit protocol or URL heuristics", () => {
    expect(resolveProviderDialect("openai-codex", "https://chatgpt.com/backend-api/codex/responses", "oauth")).toBe("openai-codex");
    expect(resolveProviderDialect(undefined, "https://api.anthropic.com/v1", "api_key")).toBe("anthropic-messages");
    expect(resolveProviderDialect(undefined, "https://cloudcode-pa.googleapis.com", "oauth")).toBe("google-gemini-cli");
    expect(resolveProviderDialect(undefined, "https://generativelanguage.googleapis.com/v1beta", "api_key")).toBe("google-gemini");
    expect(resolveProviderDialect(undefined, "https://api.githubcopilot.com", "oauth")).toBe("github-copilot");
    expect(resolveProviderDialect("openai-completions", "https://router.const.web.id/v1", "router")).toBe("openai-completions");
  });

  it("builds and streams OpenAI Codex Responses API requests cleanly", async () => {
    const req = buildDialectRequest({
      dialect: "openai-codex",
      baseUrl: "https://chatgpt.com/backend-api/codex/responses",
      apiKey: "oauth-token-123",
      model: "gpt-5.4",
      systemPrompt: "Be concise.",
      messages: [{ role: "user", content: "Hello" }],
      tools: [
        {
          type: "function",
          function: { name: "read", description: "Read file", parameters: { type: "object", properties: { path: { type: "string" } } } },
        },
      ],
      maxTokens: 4096,
      thinkingLevel: "high",
      providerAccountId: "acct_abc",
      providerAuthType: "oauth",
    });

    expect(req.url).toBe("https://chatgpt.com/backend-api/codex/responses");
    expect(req.headers.Authorization).toBe("Bearer oauth-token-123");
    expect(req.headers["chatgpt-account-id"]).toBe("acct_abc");
    expect(req.bodyObj.store).toBe(false);
    expect(req.bodyObj.instructions).toContain("Be concise.");

    const chunks: any[] = [];
    await consumeDialectStream(
      "openai-codex",
      sseStream([
        `data: ${JSON.stringify({ type: "response.reasoning_summary_text.delta", delta: "Thinking..." })}\n\n`,
        `data: ${JSON.stringify({ type: "response.output_text.delta", delta: "Hi!" })}\n\n`,
        `data: ${JSON.stringify({ type: "response.output_item.added", item: { id: "fc_1", call_id: "call_1", type: "function_call", name: "read", arguments: "" } })}\n\n`,
        `data: ${JSON.stringify({ type: "response.function_call_arguments.delta", item_id: "fc_1", delta: '{"path":"a.ts"}' })}\n\n`,
        `data: ${JSON.stringify({ type: "response.completed", response: { usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 } } })}\n\n`,
      ]),
      (c) => chunks.push(c),
      new AbortController().signal,
    );

    expect(chunks.some((c) => c.choices?.[0]?.delta?.reasoning_content === "Thinking...")).toBe(true);
    expect(chunks.some((c) => c.choices?.[0]?.delta?.content === "Hi!")).toBe(true);
    expect(chunks.some((c) => c.choices?.[0]?.delta?.tool_calls?.[0]?.function?.name === "read")).toBe(true);
    expect(chunks.at(-1)?.usage?.total_tokens).toBe(120);
  });

  it("builds and streams Anthropic Messages API (OAuth + BYOK) with prompt caching", async () => {
    const oauthReq = buildDialectRequest({
      dialect: "anthropic-messages",
      baseUrl: "https://api.anthropic.com/v1",
      apiKey: "sk-ant-oat-xyz",
      model: "claude-sonnet-4-6",
      systemPrompt: "System prompt",
      messages: [{ role: "user", content: "Inspect" }],
      tools: [],
      maxTokens: 8192,
      providerAuthType: "oauth",
    });
    expect(oauthReq.url).toBe("https://api.anthropic.com/v1/messages");
    expect(oauthReq.headers.Authorization).toBe("Bearer sk-ant-oat-xyz");
    expect(oauthReq.headers["anthropic-beta"]).toContain("oauth-2025-04-20");
    expect(oauthReq.bodyObj.system[0].cache_control).toEqual({ type: "ephemeral" });

    const byokReq = buildDialectRequest({
      dialect: "anthropic-messages",
      baseUrl: "https://api.anthropic.com/v1",
      apiKey: "sk-ant-api-key",
      model: "claude-sonnet-4-6",
      systemPrompt: "System prompt",
      messages: [{ role: "user", content: "Inspect" }],
      tools: [],
      maxTokens: 8192,
      providerAuthType: "api_key",
    });
    expect(byokReq.headers["x-api-key"]).toBe("sk-ant-api-key");
    expect(byokReq.headers.Authorization).toBeUndefined();

    const chunks: any[] = [];
    await consumeDialectStream(
      "anthropic-messages",
      sseStream([
        `data: ${JSON.stringify({ type: "message_start", message: { usage: { input_tokens: 50, cache_read_input_tokens: 20 } } })}\n\n`,
        `data: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "Step 1" } })}\n\n`,
        `data: ${JSON.stringify({ type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "Answer" } })}\n\n`,
        `data: ${JSON.stringify({ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 15 } })}\n\n`,
      ]),
      (c) => chunks.push(c),
      new AbortController().signal,
    );

    expect(chunks.some((c) => c.choices?.[0]?.delta?.reasoning_content === "Step 1")).toBe(true);
    expect(chunks.some((c) => c.choices?.[0]?.delta?.content === "Answer")).toBe(true);
    expect(chunks.at(-1)?.usage?.prompt_tokens).toBe(70);
    expect(chunks.at(-1)?.usage?.completion_tokens).toBe(15);
  });

  it("builds and streams Google Cloud Code Assist (Gemini CLI OAuth)", async () => {
    const req = buildDialectRequest({
      dialect: "google-gemini-cli",
      baseUrl: "https://cloudcode-pa.googleapis.com",
      apiKey: "ya29.test",
      model: "gemini-2.5-pro",
      systemPrompt: "Sys",
      messages: [{ role: "user", content: "Ping" }],
      tools: [],
      maxTokens: 4096,
      providerProjectId: "my-cloud-proj",
      providerAuthType: "oauth",
    });
    expect(req.url).toContain("cloudcode-pa.googleapis.com/v1internal:streamGenerateContent");
    expect(req.bodyObj.project).toBe("my-cloud-proj");
    expect(req.bodyObj.model).toBe("gemini-2.5-pro");

    const chunks: any[] = [];
    await consumeDialectStream(
      "google-gemini-cli",
      sseStream([
        `data: ${JSON.stringify({ response: { candidates: [{ content: { parts: [{ thought: true, text: "hmm" }, { text: "Pong" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 } } })}\n\n`,
      ]),
      (c) => chunks.push(c),
      new AbortController().signal,
    );
    expect(chunks.some((c) => c.choices?.[0]?.delta?.reasoning_content === "hmm")).toBe(true);
    expect(chunks.some((c) => c.choices?.[0]?.delta?.content === "Pong")).toBe(true);
    expect(chunks.some((c) => c.usage?.total_tokens === 15)).toBe(true);
  });
});

describe("Plan Mode (/plan) & Goal Mode (/goal) Runtime Controls (Phase 3)", () => {
  it("blocks file mutations in Plan Mode and unlocks after approved plan_exit", async () => {
    let turn = 0;
    const toolResults: Array<{ name: string; result: string; isError?: boolean }> = [];
    const planEvents: any[] = [];

    const fetchMock = vi.fn(async () => {
      turn++;
      const encoder = new TextEncoder();
      let payload: any;
      if (turn === 1) {
        // Attempt illegal workspace write while in Plan Mode
        payload = {
          choices: [{ delta: { tool_calls: [{ index: 0, id: "tc_write", function: { name: "write", arguments: JSON.stringify({ path: "src/app.ts", content: "bad" }) } }] }, finish_reason: "tool_calls" }],
        };
      } else if (turn === 2) {
        // Call plan_exit for user approval
        payload = {
          choices: [{ delta: { tool_calls: [{ index: 0, id: "tc_exit", function: { name: "plan_exit", arguments: JSON.stringify({ title: "Refactor Plan", summary: "Step 1: edit src/app.ts" }) } }] }, finish_reason: "tool_calls" }],
        };
      } else {
        payload = { choices: [{ delta: { content: "Plan approved and ready." }, finish_reason: "stop" }] };
      }
      return new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\ndata: [DONE]\n\n`));
            c.close();
          },
        }),
        { status: 200, headers: { "Content-Type": "text/event-stream" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      const agent = createPiHarnessAgent({
        baseUrl: "https://example.invalid/v1",
        apiKey: "test",
        model: "custom",
        workspacePath: process.cwd(),
        mode: "full_access",
        runIntent: "plan",
        onAskQuestion: async () => "Approve & Execute Plan",
      });

      await agent.run([{ role: "user", content: "Plan a refactor" }], (event) => {
        if (event.type === "tool_result") {
          toolResults.push({ name: event.toolName, result: String(event.result), isError: event.isError });
        }
        if (event.type === "plan_mode_changed") {
          planEvents.push(event);
        }
      });

      expect(toolResults[0]?.name).toBe("write");
      expect(toolResults[0]?.result).toContain("PLAN MODE ACTIVE");
      expect(toolResults[1]?.name).toBe("plan_exit");
      expect(toolResults[1]?.result).toContain("Plan Mode is now OFF");
      expect(planEvents.map((e) => e.active)).toEqual([true, false]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps Goal Mode running until goal(op: complete) is invoked", async () => {
    let turn = 0;
    const goalEvents: any[] = [];

    const fetchMock = vi.fn(async () => {
      turn++;
      const encoder = new TextEncoder();
      let payload: any;
      if (turn === 1) {
        // Premature text stop while goal is still active -> should trigger continuation checkpoint
        payload = { choices: [{ delta: { content: "I started looking at it." }, finish_reason: "stop" }] };
      } else if (turn === 2) {
        payload = {
          choices: [{ delta: { tool_calls: [{ index: 0, id: "tc_goal", function: { name: "goal", arguments: JSON.stringify({ op: "complete", summary: "All checks verified" }) } }] }, finish_reason: "tool_calls" }],
        };
      } else {
        payload = { choices: [{ delta: { content: "Goal completely verified!" }, finish_reason: "stop" }] };
      }
      return new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\ndata: [DONE]\n\n`));
            c.close();
          },
        }),
        { status: 200, headers: { "Content-Type": "text/event-stream" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      const agent = createPiHarnessAgent({
        baseUrl: "https://example.invalid/v1",
        apiKey: "test",
        model: "custom",
        workspacePath: process.cwd(),
        mode: "full_access",
        runIntent: "goal",
        goalObjective: "Ship feature X with passing tests",
      });

      await agent.run([{ role: "user", content: "Ship feature X" }], (event) => {
        if (event.type === "goal_update") goalEvents.push(event.goal);
      });

      expect(turn).toBe(3);
      expect(goalEvents[0]?.status).toBe("active");
      expect(goalEvents.at(-1)?.status).toBe("complete");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("supports OMP Approve & Compact Context on plan_exit", async () => {
    let turn = 0;
    const planEvents: any[] = [];
    const fetchMock = vi.fn(async () => {
      turn++;
      const encoder = new TextEncoder();
      const payload =
        turn === 1
          ? {
              choices: [
                {
                  delta: {
                    tool_calls: [
                      {
                        index: 0,
                        id: "tc_exit_compact",
                        function: {
                          name: "plan_exit",
                          arguments: JSON.stringify({
                            title: "Compact Plan",
                            planPath: ".const/plans/compact-plan.md",
                            summary: "Step 1: ship cleanly",
                          }),
                        },
                      },
                    ],
                  },
                  finish_reason: "tool_calls",
                },
              ],
            }
          : { choices: [{ delta: { content: "Executed compacted plan." }, finish_reason: "stop" }] };
      return new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\ndata: [DONE]\n\n`));
            c.close();
          },
        }),
        { status: 200, headers: { "Content-Type": "text/event-stream" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const agent = createPiHarnessAgent({
        baseUrl: "https://example.invalid/v1",
        apiKey: "test",
        model: "custom",
        workspacePath: process.cwd(),
        mode: "full_access",
        runIntent: "plan",
        onAskQuestion: async () => "Approve & Compact Context",
      });
      await agent.run([{ role: "user", content: "Make a plan" }], (ev) => {
        if (ev.type === "plan_mode_changed") planEvents.push(ev);
      });
      expect(planEvents.at(-1)).toMatchObject({ active: false, approved: true, compacted: true });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("enforces Goal Mode tokenBudget and flips status to budget-limited", async () => {
    const goalEvents: any[] = [];
    const fetchMock = vi.fn(async () => {
      const encoder = new TextEncoder();
      const payload = {
        choices: [{ delta: { content: "Partial progress before budget ceiling." }, finish_reason: "stop" }],
        usage: { prompt_tokens: 400, completion_tokens: 200, total_tokens: 600 },
      };
      return new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\ndata: [DONE]\n\n`));
            c.close();
          },
        }),
        { status: 200, headers: { "Content-Type": "text/event-stream" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const agent = createPiHarnessAgent({
        baseUrl: "https://example.invalid/v1",
        apiKey: "test",
        model: "custom",
        workspacePath: process.cwd(),
        mode: "full_access",
        runIntent: "goal",
        goalObjective: "Large migration",
        goalTokenBudget: 500,
      });
      await agent.run([{ role: "user", content: "Start migration" }], (ev) => {
        if (ev.type === "goal_update") goalEvents.push(ev.goal);
      });
      expect(goalEvents.at(-1)?.status).toBe("budget-limited");
      expect(goalEvents.at(-1)?.tokensUsed).toBeGreaterThanOrEqual(500);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
