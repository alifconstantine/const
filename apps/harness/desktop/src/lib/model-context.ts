import { ROUTER_DEFAULT_MODELS } from "./router-models";

export function getModelContextLimit(modelId?: string, explicit?: number | string): number {
  const match = typeof explicit === "string" ? explicit.trim().replace(/,/g, "").match(/^(\d+(?:\.\d+)?)\s*([km])?$/i) : undefined;
  const capacity = match ? Number(match[1]) * (match[2]?.toLowerCase() === "m" ? 1_000_000 : match[2] ? 1000 : 1) : Number(explicit);
  if (Number.isFinite(capacity) && capacity > 0) return Math.round(capacity);
  const model = ROUTER_DEFAULT_MODELS.find(model => model.id === modelId || model.displayName === modelId);
  if (model?.contextWindow) return model.contextWindow;
  const id = (modelId ?? "").toLowerCase().trim();
  if (id.includes("luna") || id === "combo/auto" || id === "combo/fast") return 272_000;
  if (id.includes("claude")) return 200_000;
  if (id.includes("gpt-4") || id.includes("gpt-3.5")) return 128_000;
  return 1_000_000;
}
