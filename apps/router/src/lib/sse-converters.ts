/**
 * Stream converters for transforming upstream provider SSE streams
 * (Google AI Studio, Anthropic Messages) into standard OpenAI-compatible SSE events.
 */

/**
 * Transforms Google AI Studio SSE stream to standard OpenAI format
 */
export function convertGoogleSseToOpenAiSse(body: ReadableStream<Uint8Array>): Response {
  const encoder = new TextEncoder();
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const jsonStr = trimmed.substring(6).trim();
            if (!jsonStr) continue;

            try {
              const data = JSON.parse(jsonStr);
              const candidate = data.candidates?.[0];
              if (!candidate) continue;

              const parts = candidate.content?.parts || [];
              for (const part of parts) {
                if (part.text) {
                  const isThought = Boolean(part.thought);
                  const payload = JSON.stringify({
                    choices: [
                      {
                        delta: {
                          content: isThought ? undefined : part.text,
                          reasoning_content: isThought ? part.text : undefined,
                        },
                      },
                    ],
                  });
                  controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
                } else if (part.functionCall) {
                  const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                  const payload = JSON.stringify({
                    choices: [
                      {
                        delta: {
                          tool_calls: [
                            {
                              index: 0,
                              id: callId,
                              type: "function",
                              function: {
                                name: part.functionCall.name,
                                arguments:
                                  typeof part.functionCall.args === "string"
                                    ? part.functionCall.args
                                    : JSON.stringify(part.functionCall.args || {}),
                              },
                            },
                          ],
                        },
                      },
                    ],
                  });
                  controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
                }
              }

              if (candidate.finishReason) {
                const finishReasonMap: Record<string, string> = {
                  STOP: "stop",
                  MAX_TOKENS: "length",
                  SAFETY: "content_filter",
                  RECITATION: "content_filter",
                };
                const mappedReason =
                  finishReasonMap[candidate.finishReason] ||
                  candidate.finishReason.toLowerCase();
                const payload = JSON.stringify({
                  choices: [
                    {
                      delta: {},
                      finish_reason: mappedReason,
                    },
                  ],
                });
                controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
              }
            } catch {}
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/**
 * Transforms Anthropic Messages SSE stream to standard OpenAI format
 */
export function convertAnthropicSseToOpenAiSse(body: ReadableStream<Uint8Array>): Response {
  const encoder = new TextEncoder();
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const jsonStr = trimmed.substring(6).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;

            try {
              const data = JSON.parse(jsonStr);
              if (data.type === "content_block_delta" && data.delta?.text) {
                const payload = JSON.stringify({
                  choices: [
                    {
                      delta: {
                        content: data.delta.text,
                      },
                    },
                  ],
                });
                controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
              } else if (data.type === "message_stop") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              }
            } catch {}
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
