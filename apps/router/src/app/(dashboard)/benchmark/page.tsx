import { connection } from "next/server";
import { BUILTIN_MODELS, type ModelVendor } from "@/lib/model-specs";
import { artificialAnalysisUrl, benchmarkSlugs, getBenchmarks } from "./benchmark-data";
import { BenchmarkView } from "./benchmark-view";

const creatorNames: Partial<Record<ModelVendor, string>> = {
  anthropic: "Anthropic",
  qwen: "Alibaba",
  zhipu: "Z.ai",
  moonshot: "Moonshot AI",
  xai: "xAI",
};

const benchmarkModels = BUILTIN_MODELS.flatMap((model) => {
  const slug = benchmarkSlugs[model.modelId];
  return model.category === "llm" && slug ? [{ model, slug }] : [];
});

export default async function BenchmarkPage() {
  await connection();
  const feed = await getBenchmarks(benchmarkModels.map(({ slug }) => slug));
  const rows = benchmarkModels
    .map(({ model, slug }) => {
      const result = feed?.models.get(slug);
      const creator = model.vendor ? creatorNames[model.vendor] : undefined;
      return {
        id: model.id,
        name: result?.name ?? model.name,
        creator: result?.creator ?? creator ?? model.vendorName ?? "—",
        score: result?.intelligence ?? null,
        url: `${artificialAnalysisUrl}/models/${slug}`,
      };
    })
    .sort((a, b) =>
      (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name),
    );

  return <BenchmarkView rows={rows} version={feed?.version ?? null} />;
}
