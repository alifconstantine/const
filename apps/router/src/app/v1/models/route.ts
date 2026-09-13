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
  context_length?: number;
  max_input_tokens?: number;
  max_output_tokens?: number;
  supports_thinking?: boolean;
  supports_reasoning?: boolean;
  supportsThinking?: boolean;
  supportsReasoningEffort?: boolean;
  capabilities?: Record<string, boolean>;
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
      id: "gemini-3.7-flash",
      name: "Gemini 3.7 Flash",
      display_name: "Gemini 3.7 Flash",
      object: "model",
      created: 1700000000,
      owned_by: "const",
      provider: "const",
      provider_name: "Const",
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
      thinking_levels: ["low", "medium", "high"],
      reasoning_effort: ["low", "medium", "high"],
      default_thinking_level: "medium",
      input_modalities: ["text", "image", "video"],
      output_modalities: ["text"],
    },
    {
      id: "const-search",
      name: "Const Search",
      display_name: "Const Search",
      object: "model",
      created: 1700000000,
      owned_by: "const",
      provider: "const",
      provider_name: "Const",
      context_length: 1000000,
      max_input_tokens: 1000000,
      max_output_tokens: 32000,
      supports_thinking: false,
      supports_reasoning: false,
      supportsThinking: false,
      supportsReasoningEffort: false,
      capabilities: {
        search: true,
        web_search: true,
      },
      input_modalities: ["text", "search"],
      output_modalities: ["text"],
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
      thinking_levels: ["low", "medium", "high"],
      reasoning_effort: ["low", "medium", "high"],
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
      context_length: 1000000,
      max_input_tokens: 1000000,
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
      thinking_levels: ["low", "medium", "high"],
      reasoning_effort: ["low", "medium", "high"],
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
                thinking_levels: supportsThinking ? ["low", "medium", "high"] : undefined,
                reasoning_effort: supportsThinking ? ["low", "medium", "high"] : undefined,
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

  return NextResponse.json(
    {
      object: "list",
      data: uniqueModels,
    },
    {
      headers: CORS_HEADERS,
    }
  );
}
