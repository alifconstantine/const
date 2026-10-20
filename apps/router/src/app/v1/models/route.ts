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
}

export async function GET(req: NextRequest) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "";
  const authHeader = req.headers.get("authorization")?.trim();
  const bearerValue = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : null;

  const defaultModels: ModelResponseItem[] = [
    {
      id: "gemini-3.8-flash",
      name: "Gemini 3.8 Flash",
      display_name: "Gemini 3.8 Flash",
      object: "model",
      created: 1700000000,
      owned_by: "const",
      provider: "const",
      provider_name: "Const",
      type: "chat",
      category: "llm",
      endpoint: "/v1/chat/completions",
      context_length: 1000000,
      max_input_tokens: 1000000,
      max_output_tokens: 128000,
      supports_thinking: true,
      supports_reasoning: true,
      supportsThinking: true,
      supportsReasoningEffort: true,
      capabilities: {
        reasoning: true,
        thinking: true,
        supportsThinking: true,
        tool_calling: true,
        vision: true,
      },
      thinking_levels: ["low", "medium", "high", "xhigh", "max"],
      reasoning_effort: ["low", "medium", "high", "xhigh", "max"],
      default_thinking_level: "medium",
      input_modalities: ["text", "image", "video"],
      output_modalities: ["text"],
    },
    {
      id: "glm-5.3-flash",
      name: "GLM 5.3 Flash",
      display_name: "GLM 5.3 Flash",
      object: "model",
      created: 1700000000,
      owned_by: "const",
      provider: "const",
      provider_name: "Const",
      type: "chat",
      category: "llm",
      endpoint: "/v1/chat/completions",
      context_length: 1000000,
      max_input_tokens: 1000000,
      max_output_tokens: 128000,
      supports_thinking: true,
      supports_reasoning: true,
      supportsThinking: true,
      supportsReasoningEffort: true,
      capabilities: {
        reasoning: true,
        thinking: true,
        supportsThinking: true,
        tool_calling: true,
      },
      thinking_levels: ["low", "medium", "high", "xhigh", "max"],
      reasoning_effort: ["low", "medium", "high", "xhigh", "max"],
      default_thinking_level: "medium",
      input_modalities: ["text"],
      output_modalities: ["text"],
    },
    {
      id: "deepseek-v4.1-flash",
      name: "Deepseek v4.1 Flash",
      display_name: "Deepseek v4.1 Flash",
      object: "model",
      created: 1700000000,
      owned_by: "const",
      provider: "const",
      provider_name: "Const",
      type: "chat",
      category: "llm",
      endpoint: "/v1/chat/completions",
      context_length: 1000000,
      max_input_tokens: 1000000,
      max_output_tokens: 128000,
      supports_thinking: true,
      supports_reasoning: true,
      supportsThinking: true,
      supportsReasoningEffort: true,
      capabilities: {
        reasoning: true,
        thinking: true,
        supportsThinking: true,
        tool_calling: true,
      },
      thinking_levels: ["low", "medium", "high", "xhigh", "max"],
      reasoning_effort: ["low", "medium", "high", "xhigh", "max"],
      default_thinking_level: "medium",
      input_modalities: ["text"],
      output_modalities: ["text"],
    },
    {
      id: "qwen-3.8-omni-flash",
      name: "Qwen 3.8 Omni Flash",
      display_name: "Qwen 3.8 Omni Flash",
      object: "model",
      created: 1700000000,
      owned_by: "const",
      provider: "const",
      provider_name: "Const",
      type: "chat",
      category: "llm",
      endpoint: "/v1/chat/completions",
      context_length: 1000000,
      max_input_tokens: 1000000,
      max_output_tokens: 128000,
      supports_thinking: true,
      supports_reasoning: true,
      supportsThinking: true,
      supportsReasoningEffort: true,
      capabilities: {
        reasoning: true,
        thinking: true,
        supportsThinking: true,
        tool_calling: true,
      },
      thinking_levels: ["low", "medium", "high", "xhigh", "max"],
      reasoning_effort: ["low", "medium", "high", "xhigh", "max"],
      default_thinking_level: "medium",
      input_modalities: ["text", "image", "audio", "video"],
      output_modalities: ["text"],
    },
    {
      id: "gpt-6-luna",
      name: "GPT 6 Luna",
      display_name: "GPT 6 Luna",
      object: "model",
      created: 1700000000,
      owned_by: "const",
      provider: "const",
      provider_name: "Const",
      type: "chat",
      category: "llm",
      endpoint: "/v1/chat/completions",
      context_length: 272000,
      max_input_tokens: 272000,
      max_output_tokens: 128000,
      supports_thinking: true,
      supports_reasoning: true,
      supportsThinking: true,
      supportsReasoningEffort: true,
      capabilities: {
        reasoning: true,
        thinking: true,
        supportsThinking: true,
        tool_calling: true,
      },
      thinking_levels: ["low", "medium", "high", "xhigh", "max"],
      reasoning_effort: ["low", "medium", "high", "xhigh", "max"],
      default_thinking_level: "medium",
      input_modalities: ["text"],
      output_modalities: ["text"],
    },
    {
      id: "whisper-large-v3-turbo",
      name: "Whisper Large V3 Turbo",
      display_name: "Whisper Large V3 Turbo",
      object: "model",
      created: 1700000000,
      owned_by: "const",
      provider: "const",
      provider_name: "Const",
      type: "audio",
      category: "stt",
      endpoint: "/v1/audio/transcriptions",
      context_length: null,
      max_input_tokens: null,
      max_output_tokens: null,
      supports_thinking: false,
      supports_reasoning: false,
      supportsThinking: false,
      supportsReasoningEffort: false,
      capabilities: {
        audio_transcription: true,
        speech_to_text: true,
      },
      input_modalities: ["audio"],
      output_modalities: ["text"],
    },
    {
      id: "const-search",
      name: "Const Search",
      display_name: "Const Search (Exa AI)",
      object: "model",
      created: 1700000000,
      owned_by: "const",
      provider: "const",
      provider_name: "Const",
      type: "search",
      category: "search",
      endpoint: "/v1/search",
      context_length: null,
      max_input_tokens: null,
      max_output_tokens: null,
      supports_thinking: false,
      supports_reasoning: false,
      supportsThinking: false,
      supportsReasoningEffort: false,
      capabilities: {
        search: true,
        web_search: true,
        research: true,
        deep_research: true,
      },
      modes: ["research", "deep-research"],
      input_modalities: ["text", "search"],
      output_modalities: ["text"],
    },
    {
      id: "gpt-image-2",
      name: "GPT Image 2",
      display_name: "GPT Image 2 (NaraRouter)",
      object: "model",
      created: 1700000000,
      owned_by: "nara",
      provider: "nara",
      provider_name: "NaraRouter",
      type: "image",
      category: "image",
      endpoint: "/v1/images/generations",
      context_length: null,
      max_input_tokens: null,
      max_output_tokens: null,
      supports_thinking: false,
      supports_reasoning: false,
      supportsThinking: false,
      supportsReasoningEffort: false,
      capabilities: {
        image_generation: true,
        image_edit: true,
        vision: true,
      },
      input_modalities: ["text", "image"],
      output_modalities: ["image"],
    },
    {
      id: "combo/auto",
      name: "combo/auto",
      display_name: "combo/auto",
      object: "model",
      created: 1700000000,
      owned_by: "const",
      provider: "const",
      provider_name: "Const",
      type: "chat",
      category: "llm",
      endpoint: "/v1/chat/completions",
      context_length: 272000,
      max_input_tokens: 272000,
      max_output_tokens: 128000,
      supports_thinking: true,
      supports_reasoning: true,
      supportsThinking: true,
      supportsReasoningEffort: true,
      capabilities: {
        reasoning: true,
        thinking: true,
        supportsThinking: true,
        tool_calling: true,
      },
      thinking_levels: ["low", "medium", "high", "xhigh", "max"],
      reasoning_effort: ["low", "medium", "high", "xhigh", "max"],
      default_thinking_level: "medium",
    },
    {
      id: "combo/fast",
      name: "combo/fast",
      display_name: "combo/fast",
      object: "model",
      created: 1700000000,
      owned_by: "const",
      provider: "const",
      provider_name: "Const",
      type: "chat",
      category: "llm",
      endpoint: "/v1/chat/completions",
      context_length: 272000,
      max_input_tokens: 272000,
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
    },
    {
      id: "combo/coding",
      name: "combo/coding",
      display_name: "combo/coding",
      object: "model",
      created: 1700000000,
      owned_by: "const",
      provider: "const",
      provider_name: "Const",
      type: "chat",
      category: "llm",
      endpoint: "/v1/chat/completions",
      context_length: 1000000,
      max_input_tokens: 1000000,
      max_output_tokens: 128000,
      supports_thinking: true,
      supports_reasoning: true,
      supportsThinking: true,
      supportsReasoningEffort: true,
      capabilities: {
        reasoning: true,
        thinking: true,
        supportsThinking: true,
        tool_calling: true,
      },
      thinking_levels: ["low", "medium", "high", "xhigh", "max"],
      reasoning_effort: ["low", "medium", "high", "xhigh", "max"],
      default_thinking_level: "high",
    },
  ];

  const modelsList = [...defaultModels];

  // If user provided a key or token, also fetch their connected BYOK models
  if (convexUrl && bearerValue) {
    try {
      const client = new ConvexHttpClient(convexUrl);
      const isJwt = bearerValue.startsWith("eyJ") && bearerValue.includes(".");
      if (isJwt) {
        client.setAuth(bearerValue);
      }
      const userProviders = await client.query(api.router.providers.listUserProviders, {});
      if (userProviders) {
        for (const prov of userProviders) {
          if (prov.status !== "active") continue;
          for (const m of prov.importedModels) {
            if (m.enabled) {
              const supportsThinking = isReasoningModel(m.modelId, m.capabilities, m.name);
              modelsList.push({
                id: m.modelId,
                name: m.name || m.modelId,
                display_name: m.name || m.modelId,
                object: "model",
                created: 1700000000,
                owned_by: prov.name,
                provider: prov.providerId,
                provider_name: prov.name,
                type: "chat",
                category: "llm",
                endpoint: "/v1/chat/completions",
                supports_thinking: supportsThinking,
                supports_reasoning: supportsThinking,
                supportsThinking: supportsThinking,
                supportsReasoningEffort: supportsThinking,
                capabilities: {
                  reasoning: supportsThinking,
                  thinking: supportsThinking,
                  supportsThinking: supportsThinking,
                  tool_calling: true,
                },
                thinking_levels: supportsThinking ? ["low", "medium", "high", "xhigh", "max"] : undefined,
                reasoning_effort: supportsThinking ? ["low", "medium", "high", "xhigh", "max"] : undefined,
              });
            }
          }
        }
      }

      // Also fetch user custom combos from Convex
      try {
        const userCombos = await client.query(api.router.combos.listCombos, {});
        if (userCombos && Array.isArray(userCombos)) {
          for (const c of userCombos) {
            if (!c.isBuiltin && c.status === "active") {
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
