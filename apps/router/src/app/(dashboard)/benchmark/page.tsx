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

const scoreNotices = {
  unconfigured: "Live scores need an Artificial Analysis API key in this deployment.",
  commercial_required: "Displaying live scores in Router requires a Commercial Artificial Analysis plan.",
  key_rejected: "Artificial Analysis rejected the configured API key.",
  unavailable: "Artificial Analysis scores are temporarily unavailable.",
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
      const result = feed.state === "ready" ? feed.models.get(slug) : undefined;
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

  return (
    <BenchmarkView
      rows={rows}
      version={feed.state === "ready" ? feed.version : null}
      notice={feed.state === "ready" ? undefined : scoreNotices[feed.state]}
    />
  );
}
