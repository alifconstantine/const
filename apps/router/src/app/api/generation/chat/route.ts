import { NextRequest } from "next/server";
import { POST as chat } from "../../../v1/chat/completions/route";
import { errorResponse, GatewayError, authenticate } from "@/lib/gateway";
import { api } from "@const/backend/_generated/api";
import type { Id } from "@const/backend/_generated/dataModel";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!Array.isArray(body.messages))
      throw new GatewayError("Invalid messages");
    const auth = await authenticate(req, body.apiKey || undefined);
    const ids = body.messages
      .flatMap((m: any) => (m.attachments ?? []).map((a: any) => a.fileId))
      .filter(Boolean) as Id<"routerFiles">[];
    const files = ids.length
      ? await auth.client.query(api.router.chats.resolveFiles, {
          ids: [...new Set(ids)],
          rawApiKey: auth.rawApiKey,
        })
      : [];
    const messages = await Promise.all(
      body.messages.map(async (m: any) => {
        if (!m.attachments?.length) return { role: m.role, content: m.content };
        const parts: any[] = [{ type: "text", text: m.content ?? "" }];
        for (const attachment of m.attachments) {
          const file = files.find((f) => f.id === attachment.fileId);
          if (!file?.url)
            throw new GatewayError("Upload attachments before sending");
          if (file.type.startsWith("image/"))
            parts.push({ type: "image_url", image_url: { url: file.url } });
          else {
            const response = await fetch(file.url, {
              signal: AbortSignal.any([req.signal, AbortSignal.timeout(10000)]),
            });
            if (!response.ok)
              throw new GatewayError("Attachment could not be loaded", 502);
            parts.push({
              type: "text",
              text:
                "Attached file: " + file.name + "\n" + (await response.text()),
            });
          }
        }
        return { role: m.role, content: parts };
      }),
    );
    if (body.systemInstruction?.trim())
      messages.unshift({ role: "system", content: body.systemInstruction });
    const headers = new Headers(req.headers);
    if (body.apiKey) headers.set("authorization", "Bearer " + body.apiKey);
    headers.delete("content-length");
    return chat(
      new NextRequest(req.url, {
        method: "POST",
        headers,
        signal: req.signal,
        body: JSON.stringify({
          model: body.model,
          messages,
          temperature: body.temperature,
          stream: true,
          reasoning_effort:
            body.thinkingLevel === "off" ? undefined : body.thinkingLevel,
          web_search: body.webSearch,
          max_tokens: body.max_tokens,
        }),
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
