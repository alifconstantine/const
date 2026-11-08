import { BUILTIN_MODELS, type ModelVendor } from "@/lib/model-specs";
import { artificialAnalysisUrl, benchmarkSlugs } from "./benchmark-data";
import { BenchmarkView } from "./benchmark-view";

const creatorNames: Partial<Record<ModelVendor, string>> = {
  anthropic: "Anthropic",
  qwen: "Alibaba",
  zhipu: "Z.ai",
  moonshot: "Moonshot AI",
  xai: "xAI",
};

const rows = BUILTIN_MODELS.flatMap((model) => {
  const slug = benchmarkSlugs[model.modelId];
  if (model.category !== "llm" || !slug) return [];

  const creator = model.vendor ? creatorNames[model.vendor] : undefined;
  return [{
    id: model.id,
    name: model.name,
    creator: creator ?? model.vendorName ?? "—",
    url: `${artificialAnalysisUrl}/models/${slug}`,
  }];
}).sort((a, b) => a.name.localeCompare(b.name));

export default function BenchmarkPage() {
  return <BenchmarkView rows={rows} />;
}
