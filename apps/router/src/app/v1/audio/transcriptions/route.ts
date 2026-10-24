import { NextRequest } from "next/server";
import {
  authenticate,
  engineConfig,
  reserve,
  settle,
  errorResponse,
  json,
  GatewayError,
  CORS_HEADERS,
} from "@/lib/gateway";
import { generateRequestId } from "@/lib/telemetry";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticate(req),
      engine = engineConfig();
    if (Number(req.headers.get("content-length") ?? 0) > 26 * 1024 * 1024)
      throw new GatewayError("Maximum audio upload is 25 MB", 413);
    const form = await req.formData(),
      file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 25 * 1024 * 1024)
      throw new GatewayError("Supply an audio file of up to 25 MB.");
    if (!["audio/", "video/"].some((type) => file.type.startsWith(type)))
      throw new GatewayError("Unsupported audio content type.");
    if (form.get("model") && form.get("model") !== "whisper-large-v3-turbo")
      throw new GatewayError(
        "Select whisper-large-v3-turbo for transcription.",
      );
    const format = form.get("response_format") ?? "json";
    if (!["json", "verbose_json", "text"].includes(String(format)))
      throw new GatewayError(
        "Supported response formats: json, verbose_json, text.",
      );
    // Reserve a conservative compressed-audio duration. Unused credit is released on settlement.
    const maxMinutes = Math.max(1, Math.ceil(file.size / 1000 / 60));
    const requestId = generateRequestId(),
      ticket = await reserve(
        auth,
        requestId,
        "whisper-large-v3-turbo",
        "whisper-large-v3-turbo",
        0,
        0,
        undefined,
        maxMinutes,
      );
    const started = performance.now();
    let result: any;
    try {
      const upstream = new FormData();
      upstream.set("file", file);
      upstream.set("model", "Whisper Large v3 Turbo");
      upstream.set("response_format", "verbose_json");
      for (const name of ["language", "prompt", "temperature"]) {
        const value = form.get(name);
        if (typeof value === "string") upstream.set(name, value);
      }
      const response = await fetch(engine.base + "/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: "Bearer " + engine.key },
        body: upstream,
        signal: AbortSignal.any([req.signal, AbortSignal.timeout(180000)]),
      });
      if (!response.ok) throw new GatewayError("Transcription failed", 502);
      result = await response.json();
    } catch (error) {
      await settle(
        auth,
        ticket,
        {
          promptTokens: 0,
          completionTokens: 0,
          cachedTokens: 0,
          status: 502,
          durationMs: performance.now() - started,
          usageEstimated: false,
        },
        req,
      );
      throw error;
    }
    const seconds = result.duration ?? result.usage?.seconds;
    await settle(
      auth,
      ticket,
      {
        promptTokens: 0,
        completionTokens: 0,
        cachedTokens: 0,
        status: 200,
        durationMs: performance.now() - started,
        usageEstimated: !Number.isFinite(seconds),
        unitCount: Number.isFinite(seconds) ? seconds / 60 : maxMinutes,
      },
      req,
    );
    const headers = { ...CORS_HEADERS, "X-Const-Request-Id": requestId };
    return format === "text"
      ? new Response(result.text ?? "", {
          headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
        })
      : json(
          format === "verbose_json" ? result : { text: result.text },
          200,
          headers,
        );
  } catch (error) {
    return errorResponse(error);
  }
}
