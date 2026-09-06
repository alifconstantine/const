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
      id: "gemini-3.6-flash",
      name: "Gemini 3.6 Flash",
      display_name: "Gemini 3.6 Flash",
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
      id: "Gemini 3.6 Flash",
      name: "Gemini 3.6 Flash",
      display_name: "Gemini 3.6 Flash",
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
      id: "Gemini 3.7 Flash",
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
      thinking_levels: ["low", "medium", "high"],
      reasoning_effort: ["low", "medium", "high"],
      default_thinking_level: "medium",
      input_modalities: ["text", "image", "video"],
      output_modalities: ["text"],
    },
    {
      id: "Gemini 3.8 Flash",
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
      thinking_levels: ["low", "medium", "high"],
      reasoning_effort: ["low", "medium", "high"],
      default_thinking_level: "medium",
      input_modalities: ["text", "image", "video"],
      output_modalities: ["text"],
    },
    {
      id: "combo/auto",
      name: "Auto Router",
      display_name: "Auto Router",
      object: "model",
      created: 1700000000,
      owned_by: "const",
      provider: "const",
      provider_name: "Const",
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
      id: "combo/fast",
      name: "Low-Latency Fast Chain",
      display_name: "Low-Latency Fast Chain",
      object: "model",
      created: 1700000000,
      owned_by: "const",
      provider: "const",
      provider_name: "Const",
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
      name: "Coding Agent Chain",
      display_name: "Coding Agent Chain",
      object: "model",
      created: 1700000000,
      owned_by: "const",
      provider: "const",
      provider_name: "Const",
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
    } catch {
      // Fall back to default models if query fails
    }
  }

  return NextResponse.json(
    {
      object: "list",
      data: modelsList,
    },
    {
      headers: CORS_HEADERS,
    }
  );
}
