import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@const/backend/_generated/api";
import { isReasoningModel } from "@/lib/model-specs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Const-SSO-Token",
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

import { BUILTIN_MODELS } from "@/lib/model-specs";

interface ModelResponseItem {
  id: string;
  name?: string;
  display_name?: string;
  object: string;
  created: number;
  owned_by: string;
  provider?: string;
  provider_name?: string;
  type?: "chat" | "audio" | "search" | "image";
  category?: "llm" | "stt" | "search" | "image";
  tier?: "free" | "paid";
  endpoint?: string;
  context_length?: number | null;
  max_input_tokens?: number | null;
  max_output_tokens?: number | null;
  supports_thinking?: boolean;
  supports_reasoning?: boolean;
  supportsThinking?: boolean;
  supportsReasoningEffort?: boolean;
  capabilities?: Record<string, boolean>;
  modes?: string[];
  thinking_levels?: string[];
  reasoning_effort?: string[];
  default_thinking_level?: string;
  input_modalities?: string[];
  output_modalities?: string[];
  pricing?: {
    prompt?: string;
    completion?: string;
    cache?: string;
    unit?: string;
  };
}

export async function GET(req: NextRequest) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "";
  const authHeader = req.headers.get("authorization")?.trim();
  const bearerValue = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : null;

  const defaultModels: ModelResponseItem[] = BUILTIN_MODELS.map((m) => ({
    id: m.modelId,
    name: m.name,
    display_name: m.name,
    object: "model",
    created: 1700000000,
    owned_by: "const",
    provider: "const",
    provider_name: "Const",
    type: m.category === "stt" ? "audio" : m.category === "search" ? "search" : "chat",
    category: m.category || "llm",
    tier: m.tier,
    endpoint: m.endpoint,
    context_length: m.contextLength || null,
    max_input_tokens: m.contextLength || null,
    max_output_tokens: m.maxOutputTokens && m.maxOutputTokens !== "-" ? 128000 : null,
    supports_thinking: m.supportsThinking ?? false,
    supports_reasoning: m.supportsThinking ?? false,
    supportsThinking: m.supportsThinking ?? false,
    supportsReasoningEffort: m.supportsThinking ?? false,
    capabilities: {
      reasoning: m.supportsThinking ?? false,
      thinking: m.supportsThinking ?? false,
      supportsThinking: m.supportsThinking ?? false,
      tool_calling: m.category === "llm",
      vision: m.inputTypes?.includes("image") ?? false,
      ...(m.category === "stt" ? { audio_transcription: true, speech_to_text: true } : {}),
      ...(m.category === "search" ? { search: true, web_search: true, research: true, deep_research: true } : {}),
    },
    ...(m.supportsThinking
      ? {
          thinking_levels: ["low", "medium", "high", "xhigh", "max"],
          reasoning_effort: ["low", "medium", "high", "xhigh", "max"],
          default_thinking_level: m.thinkingDefault || "medium",
        }
      : {}),
    ...(m.category === "search" ? { modes: ["research", "deep-research"] } : {}),
    input_modalities: m.inputTypes || ["text"],
    output_modalities: m.outputTypes || ["text"],
    pricing: {
      prompt: m.pricing?.input,
      cache: m.pricing?.cache,
      completion: m.pricing?.output,
      unit: m.pricing?.unit,
    },
  }));


  const modelsList = [...defaultModels];

  // If user provided a key or token, also fetch their custom virtual combos
  if (convexUrl && bearerValue) {
    try {
      const client = new ConvexHttpClient(convexUrl);
      const isJwt = bearerValue.startsWith("eyJ") && bearerValue.includes(".");
      if (isJwt) {
        client.setAuth(bearerValue);
      }

      // Also fetch user custom combos from Convex (excluding legacy built-in presets)
      try {
        const userCombos = await client.query(api.router.combos.listCombos, {});
        if (userCombos && Array.isArray(userCombos)) {
          for (const c of userCombos) {
            // Strictly exclude any legacy built-in presets (auto, fast, coding)
            if (
              c.isBuiltin ||
              String(c._id).startsWith("builtin_") ||
              ["auto", "fast", "coding"].includes(c.slug)
            ) {
              continue;
            }

            if (c.status === "active") {
              const comboId = `combo/${c.slug}`;
              modelsList.push({
                id: comboId,
                name: c.name,
                display_name: c.name,
                object: "model",
                created: c.createdAt || 1700000000,
                owned_by: "const",
                provider: "const",
                provider_name: "Const",
                type: "chat",
                category: "llm",
                endpoint: "/v1/chat/completions",
                context_length: c.contextLength || 1000000,
                max_input_tokens: c.contextLength || 1000000,
                max_output_tokens: 128000,
                supports_thinking: false,
                supports_reasoning: false,
                supportsThinking: false,
                capabilities: {
                  reasoning: false,
                  thinking: false,
                  supportsThinking: false,
                  tool_calling: true,
                },
              });
            }
          }
        }
      } catch {
        // Combos query fallback
      }
    } catch {
      // Fall back to default models if query fails
    }
  }

  // Deduplicate models defensively by normalized ID and name
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const uniqueModels: ModelResponseItem[] = [];

  for (const m of modelsList) {
    const normId = m.id.toLowerCase().replace(/\s+/g, "-").trim();
    const normName = (m.display_name || m.name || m.id).toLowerCase().trim();
    if (!seenIds.has(normId) && !seenNames.has(normName)) {
      seenIds.add(normId);
      seenNames.add(normName);
      uniqueModels.push(m);
    }
  }

  // Query parameter filtering:
  // - ?type=all: returns all models across modalities
  // - ?type=audio or ?type=stt: returns only audio models
  // - ?type=search: returns only search models
  // - ?type=image or ?type=images: returns only image generation / edit models
  // - default (no param or ?type=llm / ?type=chat): returns ONLY LLM / Chat models!
  const { searchParams } = new URL(req.url);
  const typeFilter = (searchParams.get("type") || searchParams.get("category"))?.toLowerCase()?.trim();

  const finalModels = uniqueModels.filter((m) => {
    const mType =
      m.type ||
      (m.input_modalities?.includes("audio")
        ? "audio"
        : m.capabilities?.search
        ? "search"
        : m.capabilities?.image_generation || m.category === "image"
        ? "image"
        : "chat");
    if (typeFilter === "all") return true;
    if (typeFilter === "audio" || typeFilter === "stt") return mType === "audio";
    if (typeFilter === "search") return mType === "search";
    if (typeFilter === "image" || typeFilter === "images") return mType === "image";
    // Default or "chat" / "llm": only return LLMs / Chat models
    return mType === "chat";
  });

  return NextResponse.json(
    {
      object: "list",
      data: finalModels,
    },
    {
      headers: CORS_HEADERS,
    }
  );
}
