import { NextRequest } from "next/server";
import {
  authenticate,
  validateChat,
  executeSingle,
  errorResponse,
  json,
  CORS_HEADERS,
  GatewayError,
  type ChatBody,
} from "@/lib/gateway";
import { executeComboChat } from "@/lib/combo-executor";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
export async function POST(req: NextRequest) {
  try {
    if (Number(req.headers.get("content-length") ?? 0) > 4_000_000)
      throw new GatewayError("Request too large", 413);
    let body: ChatBody;
    try {
      body = await req.json();
    } catch {
      return json({ error: { message: "Invalid JSON body" } }, 400);
    }
    validateChat(body);
    const auth = await authenticate(req);
    const model = body.model ?? auth.settings.defaultModel;
    if (body.reasoning && !body.reasoning_effort)
      body.reasoning_effort =
        typeof body.reasoning === "string"
          ? body.reasoning
          : body.reasoning.effort;
    if (body.web_search || body.webSearch) {
      const mode = body.web_search ?? body.webSearch;
      if (mode !== "off") {
        const { groundMessages } = await import("@/lib/search");
        body.messages = await groundMessages(
          req,
          auth,
          body.messages,
          mode === "deep-research",
        );
      }
    }
    return model.startsWith("combo/")
      ? await executeComboChat(req, auth, body, model.slice(6))
      : await executeSingle(req, auth, body, model);
  } catch (error) {
    return errorResponse(error);
  }
}
