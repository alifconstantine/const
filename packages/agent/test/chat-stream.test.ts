import { describe, expect, it, vi } from "vitest";
import { abortableDelay, consumeChatStream } from "../src/const/chat-stream.js";

const bytes = new TextEncoder();
const signal = () => new AbortController().signal;
function stream(text: string, split = text.length) {
  return new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(bytes.encode(text.slice(0, split)));
    controller.enqueue(bytes.encode(text.slice(split)));
    controller.close();
  } });
}
describe("chat stream completion", () => {
  it("preserves Unicode, usage and tool fragments across every byte boundary", async () => {
    const text = 'data: {"choices":[{"delta":{"content":"日本語"}}]}\r\n\r\ndata: {"usage":{"completion_tokens":3},"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';
    const encoded = bytes.encode(text);
    for (let index = 0; index < encoded.length; index++) {
      const chunks: any[] = [];
      const body = new ReadableStream<Uint8Array>({ start(controller) {
        controller.enqueue(encoded.slice(0, index)); controller.enqueue(encoded.slice(index)); controller.close();
      } });
      await consumeChatStream(body, chunk => chunks.push(chunk), signal());
      expect(chunks[0].choices[0].delta.content).toBe("日本語");
      expect(chunks[1].usage.completion_tokens).toBe(3);
    }
  });
  it("rejects a reasoning-only EOF without a terminal event", async () => {
    await expect(consumeChatStream(stream('data: {"choices":[{"delta":{"reasoning_content":"thinking"}}]}\n\n'), () => {}, signal()))
      .rejects.toThrow("before a completion event");
  });
  it("processes a final frame without a trailing newline", async () => {
    const chunks: any[] = [];
    await consumeChatStream(stream('data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}'), chunk => chunks.push(chunk), signal());
    expect(chunks[0].choices[0].delta.content).toBe("ok");
  });
  it("surfaces provider errors and structured error codes instead of swallowing them", async () => {
    await expect(
      consumeChatStream(
        stream('data: {"error":{"code":"capacity_saturated","message":"timeout"}}\n\n'),
        () => {},
        signal(),
      ),
    ).rejects.toThrow("[capacity_saturated] timeout");
  });
  it("aborts keep-alive-only stalls at firstTokenMs without waiting for totalMs", async () => {
    let heartbeat: ReturnType<typeof setInterval>;
    const cancel = vi.fn(() => clearInterval(heartbeat));
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        heartbeat = setInterval(() => controller.enqueue(bytes.encode(": keep-alive\n\n")), 2);
      },
      cancel,
    });
    await expect(consumeChatStream(body, () => {}, signal(), 50, 5_000, 20)).rejects.toThrow(
      "waiting for first token",
    );
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("finishes at DONE even if a provider leaves the socket open", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes.encode('data: [DONE]\n\n')); }, cancel });
    await consumeChatStream(body, () => {}, signal());
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("cancels the upstream reader on an idle timeout or user abort", async () => {
    for (const abort of [false, true]) {
      const cancel = vi.fn();
      const controller = new AbortController();
      const body = new ReadableStream<Uint8Array>({ cancel });
      const pending = consumeChatStream(body, () => {}, controller.signal, 5);
      if (abort) controller.abort();
      await expect(pending).rejects.toThrow(abort ? "aborted" : "stalled");
      expect(cancel).toHaveBeenCalledOnce();
    }
  });
  it("cancels retry backoff immediately", async () => {
    const controller = new AbortController();
    const pending = abortableDelay(60_000, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
  it("bounds a generation even if transport heartbeats keep arriving", async () => {
    let heartbeat: ReturnType<typeof setInterval>;
    const body = new ReadableStream<Uint8Array>({
      start(controller) { heartbeat = setInterval(() => controller.enqueue(bytes.encode(": heartbeat\n\n")), 1); },
      cancel() { clearInterval(heartbeat); },
    });
    await expect(consumeChatStream(body, () => {}, signal(), 1000, 10)).rejects.toThrow("generation timed out");
  });
});
