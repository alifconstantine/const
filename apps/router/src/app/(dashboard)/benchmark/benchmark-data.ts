export const artificialAnalysisUrl = "https://artificialanalysis.ai";

export const benchmarkSnapshot = {
  version: "5.0.1",
  date: "8 Nov 2026",
};

// Scores are the values displayed in the public model summaries linked by slug.
export const benchmarks: Readonly<Record<string, {
  slug: string;
  score: number | null;
  variant?: string;
}>> = {
  "deepseek-v4.1-flash": { slug: "deepseek-v4-1-flash-1017", score: 33, variant: "1017 (Max)" },
  "glm-5.3-flash": { slug: "glm-5-3-flash", score: 28 },
  "minimax-m3.1-flash": { slug: "minimax-m3-1-flash", score: 29 },
  "qwen-3.8-27b": { slug: "qwen3-8-27b", score: 20, variant: "Xhigh" },
  "gemini-3.8-flash": { slug: "gemini-3-8-flash", score: 31, variant: "High" },
  "claude-haiku-5.5": { slug: "claude-haiku-5-5", score: 36, variant: "Max" },
  "gpt-6-luna": { slug: "gpt-6-luna", score: 28, variant: "Max" },
  "deepseek-v4-pro": { slug: "deepseek-v4-pro", score: 23, variant: "0813 (Max)" },
  "qwen-3.8-max": { slug: "qwen3-8-max", score: 34, variant: "0902" },
  "qwen-3.8-2.4t-a95b": { slug: "qwen3-8-2-4t-a95b", score: null },
  "glm-5.3": { slug: "glm-5-3", score: 32, variant: "Max" },
  "kimi-k3.1-pro": { slug: "kimi-k3-1-pro", score: 46 },
  "kimi-k3": { slug: "kimi-k3", score: null, variant: "Max" },
  "gemini-4-argon": { slug: "gemini-4-argon", score: 50, variant: "High" },
  "claude-sonnet-5.5": { slug: "claude-sonnet-5-5", score: 55, variant: "Max, Default Fallback" },
  "claude-opus-5.5": { slug: "claude-opus-5-5", score: 59, variant: "Max, Default Fallback" },
  "claude-fable-5.1": { slug: "claude-fable-5-1", score: 49, variant: "Max, Default Fallback" },
  "gpt-6.1-terra": { slug: "gpt-6-1-terra", score: 51, variant: "Max" },
  "gpt-6.1-sol": { slug: "gpt-6-1-sol", score: 55, variant: "Max" },
  "gpt-6-astra": { slug: "gpt-6-astra", score: 57, variant: "Max" },
  "grok-4.7": { slug: "grok-4-7", score: 35, variant: "Xhigh" },
};
