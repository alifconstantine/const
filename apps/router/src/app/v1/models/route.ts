import { NextRequest } from "next/server";
import {
  BUILTIN_MODELS,
  effectiveModelPricing,
  getModelMaxOutputTokens,
  isPromoActive,
} from "@/lib/model-specs";
import { authenticate, errorResponse, json, CORS_HEADERS } from "@/lib/gateway";
import { api } from "@const/backend/_generated/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
export async function GET(req: NextRequest) {
  try {
    const now = Date.now();
    const rate = (value?: string) =>
      String((Number(value?.replace(/[^0-9.]/g, "")) || 0) / 1_000_000);
    const models: any[] = BUILTIN_MODELS.map((m) => {
      const activePricing = effectiveModelPricing(m, now) ?? m.pricing;
      const promoActive = isPromoActive(m, now);
      return {
        id: m.modelId,
        name: m.name,
        display_name: m.name,
        object: "model",
        created: 1790000000,
        owned_by: "const",
        provider: "const",
        vendor: m.vendor ?? "const",
        vendor_name: m.vendorName ?? "Const",
        category: m.category,
        type:
          m.category === "llm"
            ? "chat"
            : m.category === "stt"
              ? "audio"
              : "search",
        tier: m.tier,
        endpoint: m.endpoint,
        context_length: m.contextLength ?? null,
        max_output_tokens:
          m.category === "llm" ? getModelMaxOutputTokens(m.modelId) : null,
        supports_thinking: m.supportsThinking,
        capabilities: {
          tool_calling: m.category === "llm",
          vision: m.inputTypes?.includes("image") ?? false,
          reasoning: m.supportsThinking,
        },
        input_modalities: m.inputTypes,
        output_modalities: m.outputTypes,
        pricing:
          m.category === "llm"
            ? {
                prompt: rate(activePricing?.input),
                completion: rate(activePricing?.output),
                cache: rate(activePricing?.cache),
                unit: "USD/token",
              }
            : { unit: activePricing?.unit, price: activePricing?.input },
        ...(m.officialPricing
          ? {
              official_pricing: {
                prompt: rate(m.officialPricing.input),
                completion: rate(m.officialPricing.output),
                cache: rate(m.officialPricing.cache),
                unit: "USD/token",
              },
            }
          : {}),
        ...(promoActive && m.promo
          ? {
              promo: {
                label: m.promo.label,
                extra_percent_off: m.promo.extraPercentOff,
                total_percent_off: m.promo.totalPercentOff,
                ends_at: m.promo.endsAt ?? null,
              },
            }
          : {}),
      };
    });
    if (
      req.headers.has("authorization") ||
      req.headers.has("x-const-sso-token") ||
      req.cookies.has("const_sso_token")
    ) {
      const auth = await authenticate(req);
      const combos = await auth.client.query(api.router.combos.listCombos, {
        rawApiKey: auth.rawApiKey,
      });
      models.push(
        ...combos
          .filter((c) => c.status === "active")
          .map((c) => ({
            id: "combo/" + c.slug,
            name: c.name,
            object: "model",
            owned_by: "user",
            category: "llm",
            type: "chat",
            stream_required: true,
            context_length: c.contextLength,
            billing: "selected_target",
          })),
      );
    }
    const type =
      req.nextUrl.searchParams.get("type") ??
      req.nextUrl.searchParams.get("category") ??
      "chat";
    const normalized =
      type === "llm" ? "chat" : type === "stt" ? "audio" : type;
    return json({
      object: "list",
      data: models.filter((m) => normalized === "all" || m.type === normalized),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
