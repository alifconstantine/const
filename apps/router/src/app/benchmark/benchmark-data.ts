import "server-only";

export const artificialAnalysisUrl = "https://artificialanalysis.ai";

export const benchmarkSlugs: Readonly<Record<string, string>> = {
  "deepseek-v4.1-flash": "deepseek-v4-1-flash-1017",
  "glm-5.3-flash": "glm-5-3-flash",
  "minimax-m3.1-flash": "minimax-m3-1-flash",
  "qwen-3.8-27b": "qwen3-8-27b",
  "gemini-3.8-flash": "gemini-3-8-flash",
  "claude-haiku-5.5": "claude-haiku-5-5",
  "gpt-6-luna": "gpt-6-luna",
  "deepseek-v4-pro": "deepseek-v4-pro",
  "qwen-3.8-max": "qwen3-8-max",
  "qwen-3.8-2.4t-a95b": "qwen3-8-2-4t-a95b",
  "glm-5.3": "glm-5-3",
  "kimi-k3.1-pro": "kimi-k3-1-pro",
  "kimi-k3": "kimi-k3",
  "gemini-4-argon": "gemini-4-argon",
  "claude-sonnet-5.5": "claude-sonnet-5-5",
  "claude-opus-5.5": "claude-opus-5-5",
  "claude-fable-5.1": "claude-fable-5-1",
  "gpt-6.1-terra": "gpt-6-1-terra",
  "gpt-6.1-sol": "gpt-6-1-sol",
  "gpt-6-astra": "gpt-6-astra",
  "grok-4.7": "grok-4-7",
};

type Benchmark = {
  name: string;
  intelligence: number | null;
  outputSpeed: number | null;
  firstToken: number | null;
};

type BenchmarkResponse = {
  tier: string;
  intelligence_index_version: number;
  pagination: { page: number; has_more: boolean };
  data: {
    name: string;
    slug: string;
    evaluations?: { artificial_analysis_intelligence_index?: number | null };
    performance?: {
      median_output_tokens_per_second?: number | null;
      median_time_to_first_token_seconds?: number | null;
    };
  }[];
};

function metric(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

export async function getBenchmarks(slugs: readonly string[]) {
  const key = process.env.ARTIFICIAL_ANALYSIS_COMMERCIAL_API_KEY?.trim();
  if (!key || slugs.length === 0) return null;

  const remaining = new Set(slugs);
  const models = new Map<string, Benchmark>();
  const signal = AbortSignal.timeout(5_000);
  let version: number | null = null;
  try {
    for (let page = 1; page <= 10; page++) {
      // The compact endpoint retains the key's actual tier in its response.
      const response = await fetch(
        `${artificialAnalysisUrl}/api/v2/language/models/free?page=${page}`,
        {
          headers: { "x-api-key": key },
          redirect: "error",
          next: { revalidate: 21_600 },
          signal,
        },
      );
      if (!response.ok) return null;
      const result: BenchmarkResponse = await response.json();
      if (
        result.tier !== "commercial" ||
        result.pagination?.page !== page ||
        !Array.isArray(result.data) ||
        !Number.isFinite(result.intelligence_index_version) ||
        (version !== null && version !== result.intelligence_index_version)
      ) return null;

      version = result.intelligence_index_version;
      for (const model of result.data) {
        if (!model || typeof model.name !== "string" || !remaining.delete(model.slug)) continue;
        models.set(model.slug, {
          name: model.name,
          intelligence: metric(model.evaluations?.artificial_analysis_intelligence_index),
          outputSpeed: metric(model.performance?.median_output_tokens_per_second),
          firstToken: metric(model.performance?.median_time_to_first_token_seconds),
        });
      }
      if (remaining.size === 0 || !result.pagination.has_more) break;
    }
  } catch {
    return null;
  }
  return { models, version };
}
