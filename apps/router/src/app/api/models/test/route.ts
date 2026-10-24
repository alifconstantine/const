import { NextRequest } from "next/server";
import { POST as chat } from "../../../v1/chat/completions/route";
import { json, errorResponse } from "@/lib/gateway";
export async function POST(req: NextRequest) {
  const started = performance.now();
  try {
    const body = await req.json();
    const headers = new Headers(req.headers);
    headers.delete("content-length");
    const response = await chat(
      new NextRequest(req.url, {
        method: "POST",
        headers,
        signal: req.signal,
        body: JSON.stringify({
          model: body.model,
          messages: [{ role: "user", content: "Reply with OK." }],
          stream: false,
          max_tokens: 16,
        }),
      }),
    );
    const data = await response.json();
    if (!response.ok)
      return json(
        { success: false, error: data.error?.message ?? "Model test failed" },
        response.status,
      );
    return json({
      success: true,
      latency: Math.round(performance.now() - started),
      reply: data.choices?.[0]?.message?.content ?? "OK",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
