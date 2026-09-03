import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const requestedModel = body?.model || "gemini-3.6-flash";
    const MODEL_MAPPING: Record<string, string> = {
      "gemini-3.6-flash": "antigravity/gemini-3.6-flash-medium",
    };
    const model = MODEL_MAPPING[requestedModel] || requestedModel;

    const baseUrl = process.env.CONST_ENGINE_BASE_URL?.trim();
    if (!baseUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "CONST_ENGINE_BASE_URL is not configured in .env.local",
        },
        { status: 500 }
      );
    }
    const apiKey = process.env.CONST_ENGINE_API_KEY?.trim() || "";

    const startTime = Date.now();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Ping! Please respond with 'OK'." }],
        max_tokens: 15,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    const latency = Date.now() - startTime;
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg =
        data?.error?.message ||
        data?.message ||
        `Upstream error (HTTP ${res.status} ${res.statusText})`;
      return NextResponse.json(
        {
          success: false,
          error: errorMsg,
          status: res.status,
          latency,
        },
        { status: res.status }
      );
    }

    const reply = data?.choices?.[0]?.message?.content || "OK";

    return NextResponse.json({
      success: true,
      latency,
      reply,
      model: data?.model || model,
    });
  } catch (error: any) {
    const isTimeout = error?.name === "AbortError";
    return NextResponse.json(
      {
        success: false,
        error: isTimeout
          ? "Request timed out after 12 seconds."
          : error?.message || "Failed to reach model engine.",
      },
      { status: 500 }
    );
  }
}
