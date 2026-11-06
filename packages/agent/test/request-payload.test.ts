import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequestPreparer, requestBodyBudget, CONST_REQUEST_BODY_BUDGET } from "../src/const/request-payload.js";
import { ConstAgent } from "../src/const/const-agent.js";
import type { AgentEvent, AgentMessage, ModelImageNormalizer } from "../src/const/types.js";

const imageUrl = (bytes: number) => "data:image/png;base64," + "A".repeat(bytes);
const signal = () => new AbortController().signal;
const options = () => ({ endpoint: "https://router.const.web.id/v1/chat/completions", runId: "payload-test", signal: signal(), limitBytes: CONST_REQUEST_BODY_BUDGET });
const complete = () => new Response('data: {"choices":[{"delta":{"content":"Verified"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
const config = { model: "fixture", baseUrl: "https://fixture.invalid/v1", apiKey: "private-key", tools: [], inputTypes: ["text", "image"] };
afterEach(() => vi.unstubAllGlobals());

describe("request byte admission", () => {
  it("uses the Const gateway contract without imposing that limit on unrelated endpoints", async () => {
    expect(requestBodyBudget(options().endpoint)).toBe(CONST_REQUEST_BODY_BUDGET);
    expect(requestBodyBudget("https://router.const.web.id.attacker.invalid/v1")).toBeUndefined();
    expect(requestBodyBudget("https://api.openai.com/v1/chat/completions")).toBeUndefined();
    expect(requestBodyBudget("http://localhost:1234/v1", 2_000_000)).toBe(2_000_000);
    const payload = { messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: imageUrl(6_418_984) } }] }] };
    await expect(createRequestPreparer()(payload, options())).rejects.toMatchObject({ category: "payload" });
    const prepared = await createRequestPreparer()(payload, { ...options(), limitBytes: undefined });
    expect(prepared.diagnostics.requestBytes).toBeGreaterThan(6_418_984);
  });

  it("normalizes both individually allowed images, preserving media, source history and screenshot coordinates", async () => {
    const normalize = vi.fn<ModelImageNormalizer>(async (url, _options, abort) => {
      abort.throwIfAborted();
      return { dataUrl: url.slice(0, 100_000), originalWidth: 2000, originalHeight: 1000, width: 1000, height: 500 };
    });
    const payload = { tools: [{ function: { description: "tool schema counts against body bytes" } }], messages: [{ role: "user", content: [
      { type: "text", text: "Inspect both" },
      { type: "image_url", image_url: { url: imageUrl(2_733_724), detail: "high" }, constImage: { width: 2000, height: 1000, scale: 0.5 } },
      { type: "image_url", image_url: { url: imageUrl(3_685_260) } },
    ] }] };
    const original = JSON.stringify(payload);
    const prepare = createRequestPreparer(normalize);
    const prepared = await prepare(payload, options());
    const request = JSON.parse(prepared.body);
    expect(request.messages[0].content.filter((p: any) => p.type === "image_url")).toHaveLength(2);
    expect(prepared.diagnostics.requestBytes).toBe(Buffer.byteLength(prepared.body, "utf8"));
    expect(prepared.diagnostics.requestBytes).toBeLessThan(CONST_REQUEST_BODY_BUDGET);
    expect(request.tools).toEqual(payload.tools);
    expect(prepared.body).toContain("x by 4.000000 and y by 4.000000");
    expect(prepared.body).not.toContain("constImage");
    expect(JSON.stringify(payload)).toBe(original);
    await prepare(payload, options());
    expect(normalize).toHaveBeenCalledTimes(2); // Cached separately per original image.
  });

  it("counts UTF-8 text and tool schemas and rejects locally when media reduction cannot help", async () => {
    const fetch = vi.fn(async () => complete());
    vi.stubGlobal("fetch", fetch);
    const events: AgentEvent[] = [];
    await expect(new ConstAgent({ ...config, requestBodyLimitBytes: 20_000 }).run([
      { role: "user", content: "界".repeat(10_000) },
    ], event => events.push(event))).rejects.toMatchObject({ category: "payload" });
    expect(fetch).not.toHaveBeenCalled();
    expect(events.at(-1)).toMatchObject({ type: "run_end", outcome: "failed", errorCategory: "payload" });
  });

  it("admits long tool history and multiple large images together while retaining the complete brief", async () => {
    const requirement = "Keep every existing invoice and the keyboard export shortcut.";
    const history: AgentMessage[] = [{ role: "user", content: [{ type: "text", text: "x".repeat(15_000) + requirement + "y".repeat(15_000) },
      { type: "image_url", image_url: { url: imageUrl(2_733_724) } }, { type: "image_url", image_url: { url: imageUrl(3_685_260) } }] }];
    for (let index = 0; index < 260; index++) {
      history.push({ role: "assistant", content: "", tool_calls: [{ id: `read_${index}`, type: "function", function: { name: "read", arguments: "{}" } }] });
      history.push({ role: "tool", tool_call_id: `read_${index}`, content: "Checked source" });
    }
    history.push({ role: "user", content: "lanjutkan" });
    let body: string | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => { body = String(init.body); return complete(); }));
    await new ConstAgent({ ...config, baseUrl: "https://router.const.web.id/v1", normalizeImage: async url => ({ dataUrl: url.slice(0, 100_000),
      originalWidth: 2000, originalHeight: 1000, width: 1000, height: 500 }) }).run(history, () => {});
    expect(Buffer.byteLength(body!)).toBeLessThan(CONST_REQUEST_BODY_BUDGET);
    const request = JSON.parse(body!);
    expect(request.messages.length).toBeLessThanOrEqual(500);
    expect(body).toContain(requirement);
    expect(request.messages.flatMap((m: any) => Array.isArray(m.content) ? m.content.filter((p: any) => p.type === "image_url") : [])).toHaveLength(2);
    const calls = new Set(request.messages.flatMap((m: any) => m.tool_calls?.map((call: any) => call.id) ?? []));
    for (const result of request.messages.filter((m: any) => m.role === "tool")) expect(calls.has(result.tool_call_id)).toBe(true);
  });

  it("keeps remote references intact without fetching or treating their URLs as inline image bytes", async () => {
    const normalizer = vi.fn<ModelImageNormalizer>();
    const url = "https://images.invalid/private.png?signed=secret";
    const prepared = await createRequestPreparer(normalizer)({ messages: [{ role: "user", content: [{ type: "image_url", image_url: { url } }] }] }, options());
    expect(normalizer).not.toHaveBeenCalled();
    expect(JSON.parse(prepared.body).messages[0].content[0].image_url.url).toBe(url);
    expect(prepared.diagnostics).toMatchObject({ imageBytes: 0, imageCount: 1 });
    expect(JSON.stringify(prepared.diagnostics)).not.toContain("secret");
  });

  it("distinguishes image preparation failure from a size rejection without removing or uploading the original", async () => {
    const original = { messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: imageUrl(100) } }] }] };
    await expect(createRequestPreparer(async () => { throw new Error("Decode failed"); })(original, options()))
      .rejects.toMatchObject({ category: "image", diagnostics: { imageCount: 1 } });
    expect(original.messages[0]!.content[0]!.image_url.url).toBe(imageUrl(100));
  });
});

describe("payload recovery and terminal outcomes", () => {
  const normalize: ModelImageNormalizer = async (_url, limit, abort) => {
    abort.throwIfAborted();
    return { dataUrl: imageUrl(Math.floor(limit.maxBytes * 0.8)), originalWidth: 2000, originalHeight: 1000, width: limit.maxDimension, height: limit.maxDimension / 2 };
  };
  const history = (): AgentMessage[] => [{ role: "user", content: [{ type: "text", text: "Verify this image" }, { type: "image_url", image_url: { url: imageUrl(1_000_000) } }] }];

  it("recovers one 413 with a smaller body, retains the image and emits safe per-request diagnostics", async () => {
    const requests: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      requests.push(String(init.body));
      return requests.length === 1 ? new Response("FUNCTION_PAYLOAD_TOO_LARGE", { status: 413 }) : complete();
    }));
    const events: AgentEvent[] = [];
    const source = history();
    const original = JSON.stringify(source);
    await new ConstAgent({ ...config, runId: "run-payload", normalizeImage: normalize }).run(source, e => events.push(e));
    expect(requests).toHaveLength(2);
    expect(Buffer.byteLength(requests[1])).toBeLessThan(Buffer.byteLength(requests[0]));
    expect(requests[1]).toContain("image_url");
    expect(JSON.stringify(source)).toBe(original);
    expect(events.at(-1)).toMatchObject({ type: "run_end", outcome: "completed", recovery: "payload", runId: "run-payload" });
    const finished = events.filter(e => e.type === "llm_request" && e.phase === "finished");
    expect(finished).toHaveLength(2);
    expect(finished[0]).toMatchObject({ diagnostics: { httpStatus: 413, errorCategory: "payload", imageCount: 1 } });
    expect(finished[1]).toMatchObject({ diagnostics: { httpStatus: 200, recovery: "payload" } });
    expect(JSON.stringify(finished)).not.toContain("private-key");
    expect(JSON.stringify(finished)).not.toContain("data:image/");
  });

  it("stops after a repeated 413 and leaves original media available for a later continue", async () => {
    const fetch = vi.fn(async () => new Response("FUNCTION_PAYLOAD_TOO_LARGE", { status: 413 }));
    vi.stubGlobal("fetch", fetch);
    const source = history();
    const events: AgentEvent[] = [];
    const agent = new ConstAgent({ ...config, normalizeImage: normalize });
    await expect(agent.run(source, e => events.push(e))).rejects.toMatchObject({ category: "payload" });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(events.some(e => e.type === "done")).toBe(false);
    expect(events.at(-1)).toMatchObject({ type: "run_end", outcome: "failed", errorCategory: "payload" });
    expect(JSON.stringify(source)).toContain(imageUrl(1_000_000));
    fetch.mockImplementation(async () => complete());
    await expect(agent.run(source, () => {})).resolves.toMatchObject([{ role: "user" }, { role: "assistant", content: "Verified" }]);
  });

  it("does not replay a rejected request when normalization makes no size progress", async () => {
    const fetch = vi.fn(async () => new Response("Too large", { status: 413 }));
    vi.stubGlobal("fetch", fetch);
    await expect(new ConstAgent({ ...config, normalizeImage: async url => ({ dataUrl: url, originalWidth: 20, originalHeight: 20, width: 20, height: 20 }) })
      .run([{ role: "user", content: [{ type: "image_url", image_url: { url: imageUrl(20) } }] }], () => {})).rejects.toMatchObject({ category: "payload" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("cancels while preparing recovery without sending a second request or claiming success", async () => {
    const events: AgentEvent[] = [];
    let normalizations = 0;
    const agent = new ConstAgent({ ...config, normalizeImage: async (url, opts, abort) => {
      if (++normalizations === 2) agent.abort();
      return normalize(url, opts, abort);
    } });
    const fetch = vi.fn(async () => new Response("Too large", { status: 413 }));
    vi.stubGlobal("fetch", fetch);
    await agent.run(history(), e => events.push(e));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(events.at(-1)).toMatchObject({ type: "run_end", outcome: "cancelled", errorCategory: "cancelled" });
    expect(events.some(e => e.type === "done")).toBe(false);
  });

  it("does not call an internal AbortError a user cancellation when the caller signal is live", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new DOMException("Internal request aborted", "AbortError"); }));
    const events: AgentEvent[] = [];
    await expect(new ConstAgent(config).run([{ role: "user", content: "Continue" }], e => events.push(e))).rejects.toThrow("Internal request aborted");
    expect(events.at(-1)).toMatchObject({ type: "run_end", outcome: "failed", errorCategory: "transport" });
  });
});
