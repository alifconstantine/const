import type { NextRequest } from "next/server";
import { api } from "@const/backend/_generated/api";
import {
  executeSingle,
  GatewayError,
  CORS_HEADERS,
  type GatewayAuth,
  type ChatBody,
} from "./gateway";
import { SseUsageParser, textContextMessages } from "./telemetry";

async function drainFailedStream(reader: ReadableStreamDefaultReader<Uint8Array>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      (async () => {
        while (!(await reader.read()).done) {
          /* allow executeSingle to reach EOF and settle actual error status */
        }
      })(),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, 500);
      }),
    ]);
  } catch {
    /* ignore broken upstream stream */
  } finally {
    if (timer) clearTimeout(timer);
    await reader.cancel().catch(() => {});
  }
}

export async function executeComboChat(
  req: NextRequest,
  auth: GatewayAuth,
  body: ChatBody,
  slug: string,
): Promise<Response> {
  const combo = await auth.client.mutation(api.router.combos.prepareCombo, {
    slug,
    rawApiKey: auth.rawApiKey,
  });
  let last: Response | undefined;
  for (let index = 0; index < combo.models.length; index++) {
    const target = combo.models[index]!;
    const hasFallback = index < combo.models.length - 1;
    const messages = combo.systemMessage
      ? [{ role: "system", content: combo.systemMessage }, ...body.messages]
      : body.messages;
    if (
      new TextEncoder().encode(JSON.stringify(textContextMessages(messages))).length >
      combo.contextLength * 3
    )
      throw new GatewayError(
        "Conversation exceeds the combo context limit. Start a new chat or increase the limit.",
      );
    try {
      const result = await executeSingle(
        req,
        auth,
        { ...body, messages, stream: true },
        target.modelId,
        "combo/" + slug,
        combo.name,
      );
      if (result.ok && result.body) {
        const headers = new Headers(result.headers);
        headers.set("X-Const-Combo-Selected-Model", target.modelId);
        headers.set("X-Const-Combo-Fallbacks", String(index));

        if (!hasFallback) {
          return new Response(result.body, { status: result.status, headers });
        }

        // Probe pre-first-token SSE readiness so early keep-alive + capacity_saturated falls over cleanly
        const reader = result.body.getReader();
        const probe = new SseUsageParser();
        const buffered: Uint8Array[] = [];
        let ready = false;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              probe.finish();
              ready = !probe.hasError && probe.hasTerminal;
              break;
            }
            buffered.push(value);
            probe.push(value);
            if (probe.hasError) {
              ready = false;
              break;
            }
            if (
              probe.firstTokenAt !== undefined ||
              probe.hasTerminal ||
              probe.hasUsage
            ) {
              ready = true;
              break;
            }
          }
        } catch (streamErr) {
          await reader.cancel().catch(() => {});
          if (req.signal.aborted) throw streamErr;
          ready = false;
        }

        if (ready) {
          const replayed = new ReadableStream<Uint8Array>({
            start(controller) {
              for (const chunk of buffered) controller.enqueue(chunk);
            },
            async pull(controller) {
              const { done, value } = await reader.read();
              if (done) {
                controller.close();
                return;
              }
              controller.enqueue(value);
            },
            async cancel(reason) {
              await reader.cancel(reason).catch(() => {});
            },
          });
          return new Response(replayed, { status: result.status, headers });
        }

        await drainFailedStream(reader);
        await last?.body?.cancel();
        last = new Response(
          JSON.stringify({
            error: {
              message:
                probe.errorMessage ??
                "The selected model is unavailable. Retry or select another model.",
              code: probe.errorCode ?? "combo_target_unavailable",
            },
          }),
          {
            status: probe.errorStatus ?? 502,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          },
        );
        continue;
      }
      if (![408, 429, 500, 502, 503, 504].includes(result.status))
        return result;
      await last?.body?.cancel();
      last = result;
    } catch (error) {
      if (req.signal.aborted) throw error;
      const code = (error as any)?.data?.status ?? (error as any)?.status;
      if (![402, 429, 503, 504].includes(code)) throw error;
    }
  }
  return (
    last ??
    (() => {
      throw new GatewayError(
        "No combo target has available quota, credit, or capacity.",
        429,
      );
    })()
  );
}
