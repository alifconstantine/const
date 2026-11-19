export const artificialAnalysisUrl = "https://artificialanalysis.ai";

export const benchmarkSnapshot = {
  version: "5.0.1",
  date: "19 Nov 2026",
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
  "gemini-3.8-flash": { slug: "gemini-3-8-flash", score: 31, variant: "High" },
  "claude-haiku-5.5": { slug: "claude-haiku-5-5", score: 36, variant: "Max" },
  "gpt-6-luna": { slug: "gpt-6-luna", score: 28, variant: "Max" },
  "qwen4-max": { slug: "qwen4-max", score: 43 },
  "glm-5.3": { slug: "glm-5-3", score: 32, variant: "Max" },
  "kimi-k3.1-pro": { slug: "kimi-k3-1-pro", score: 46 },
  "gemini-4-hydrogen": { slug: "gemini-4-hydrogen", score: 54, variant: "Xhigh" },
  "gemini-4-argon": { slug: "gemini-4-argon", score: 50, variant: "High" },
  "gemini-4-carbon": { slug: "gemini-4-carbon", score: 60, variant: "High" },
  "claude-sonnet-5.5": { slug: "claude-sonnet-5-5", score: 55, variant: "Max, Default Fallback" },
  "claude-opus-5.5": { slug: "claude-opus-5-5", score: 59, variant: "Max, Default Fallback" },
  "claude-fable-5.2": { slug: "claude-fable-5-2", score: 65, variant: "Max, Default Fallback" },
  "gpt-6.1-terra": { slug: "gpt-6-1-terra", score: 51, variant: "Max" },
  "gpt-6.2-sol": { slug: "gpt-6-2-sol", score: 57, variant: "Max" },
  "gpt-6.2-astra": { slug: "gpt-6-2-astra", score: 62, variant: "Max" },
  "grok-4.7": { slug: "grok-4-7", score: 35, variant: "Xhigh" },
};
