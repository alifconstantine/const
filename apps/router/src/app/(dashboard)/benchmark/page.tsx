import { BUILTIN_MODELS, type ModelVendor } from "@/lib/model-specs";
import { artificialAnalysisUrl, benchmarks } from "./benchmark-data";
import { BenchmarkView } from "./benchmark-view";

const creatorNames: Partial<Record<ModelVendor, string>> = {
  anthropic: "Anthropic",
  qwen: "Alibaba",
  zhipu: "Z.ai",
  moonshot: "Moonshot AI",
  xai: "xAI",
};

const rows = BUILTIN_MODELS.flatMap((model) => {
  const benchmark = benchmarks[model.modelId];
  if (model.category !== "llm" || !benchmark) return [];

  const creator = model.vendor ? creatorNames[model.vendor] : undefined;
  return [{
    id: model.id,
    name: model.name,
    creator: creator ?? model.vendorName ?? "—",
    score: benchmark.score,
    variant: benchmark.variant,
    url: `${artificialAnalysisUrl}/models/${benchmark.slug}`,
  }];
});

export default function BenchmarkPage() {
  return <BenchmarkView rows={rows} />;
}
