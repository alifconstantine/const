import type { NextRequest } from "next/server";
import { api } from "@const/backend/_generated/api";
import {
  executeSingle,
  GatewayError,
  type GatewayAuth,
  type ChatBody,
} from "./gateway";
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
    const messages = combo.systemMessage
      ? [{ role: "system", content: combo.systemMessage }, ...body.messages]
      : body.messages;
    if (
      new TextEncoder().encode(JSON.stringify(messages)).length >
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
      if (result.ok) {
        const headers = new Headers(result.headers);
        headers.set("X-Const-Combo-Selected-Model", target.modelId);
        headers.set("X-Const-Combo-Fallbacks", String(index));
        return new Response(result.body, { status: result.status, headers });
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
