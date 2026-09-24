export interface ConversationMetrics {
  turns: number;
  steps: number;
  llmDurationMs: number;
  toolDurationMs: number;
  ttftSeconds: number;
  tokPerSec: number;
  cacheHitRate: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens: number;
  uncachedInputTokens: number;
}

export interface ContextUsage {
  totalTokens: number;
  usedTokens: number;
  rawPercentUsed: number;
  percentUsed: string;
  safePercent: number;
  sourcesTokens: number;
  systemPromptTokens: number;
  toolDefinitionsTokens: number;
  messagesTokens: number;
  draftInputTokens: number;
  availableTokens: number;
}

export function formatTokenDisplay(tokens: number): string {
  if (tokens <= 0) return "0";
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 100000) {
    const val = (tokens / 1000).toFixed(1);
    return `${val.endsWith(".0") ? val.slice(0, -2) : val}K`;
  }
  if (tokens < 1000000) return `${Math.round(tokens / 1000)}K`;
  const mVal = (tokens / 1000000).toFixed(1);
  return `${mVal.endsWith(".0") ? mVal.slice(0, -2) : mVal}M`;
}

export function parseContextWindowTokens(val: any): number {
  if (typeof val === "number" && val > 0) return val;
  if (typeof val === "string") {
    const clean = val.toLowerCase().replace(/context/g, "").trim();
    if (clean.endsWith("m")) {
      const num = parseFloat(clean.replace("m", ""));
      return isNaN(num) ? 1048576 : Math.round(num * 1048576);
    }
    if (clean.endsWith("k")) {
      const num = parseFloat(clean.replace("k", ""));
      return isNaN(num) ? 1048576 : Math.round(num * 1024);
    }
    const parsed = parseInt(clean, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 1048576;
}

export function formatDurationDisplay(ms: number): string {
  if (!ms || ms <= 0) return "0s";
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const mins = Math.floor(s / 60);
  const remSecs = Math.round(s % 60);
  return `${mins}m ${remSecs}s`;
}

export function calculateConversationMetrics(
  messages: Array<{
    role: string;
    content?: string;
    thinking?: string;
    toolCalls?: any[];
    durationMs?: number;
  }>
): ConversationMetrics | undefined {
  if (!messages || messages.length === 0) return undefined;

  const userMessages = messages.filter((m) => m.role === "user");
  const assistantMessages = messages.filter((m) => m.role === "assistant");
  if (userMessages.length === 0 && assistantMessages.length === 0) return undefined;

  const turns = Math.max(1, userMessages.length);

  let totalToolCalls = 0;
  for (const m of assistantMessages) {
    if (m.toolCalls && Array.isArray(m.toolCalls)) {
      totalToolCalls += m.toolCalls.length;
    }
  }
  const steps = Math.max(1, assistantMessages.length + totalToolCalls);

  // Calculate or estimate tool and LLM durations
  const recordedLlmMs = assistantMessages.reduce((sum, m) => sum + (m.durationMs || 0), 0);
  const estimatedLlmMs = recordedLlmMs > 0
    ? recordedLlmMs
    : Math.max(2500, turns * 3500 + totalToolCalls * 1500);

  const toolDurationMs = Math.max(0, totalToolCalls * 1200);

  // Token estimations
  const outputTokens = Math.max(
    24,
    Math.round(
      assistantMessages.reduce(
        (sum, m) =>
          sum + (m.content?.length || 0) / 3.8 + (m.thinking?.length || 0) / 4,
        0
      )
    )
  );

  const baseInputTokensPerTurn = 850 + 950;
  const messageInputTokens = Math.round(
    userMessages.reduce((sum, m) => sum + (m.content?.length || 0) / 3.8, 0)
  );
  const inputTokens = Math.max(
    1200,
    baseInputTokensPerTurn * turns + messageInputTokens + Math.round(outputTokens * 0.4)
  );

  const ttftSeconds = Math.max(0.8, +(0.9 + (turns > 3 ? 0.6 : 0.2)).toFixed(1));
  const tokPerSec =
    outputTokens > 0 && estimatedLlmMs > 0
      ? Math.max(25, Math.min(180, Math.round(outputTokens / (estimatedLlmMs / 1000))))
      : 64;
  const cacheHitRate = turns > 1 ? 78 : turns === 1 ? 62 : 0;
  const totalTokens = inputTokens + outputTokens;
  const cachedInputTokens = Math.round(inputTokens * (cacheHitRate / 100));
  const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);

  return {
    turns,
    steps,
    llmDurationMs: estimatedLlmMs,
    toolDurationMs,
    ttftSeconds,
    tokPerSec,
    cacheHitRate,
    inputTokens,
    outputTokens,
    totalTokens,
    cachedInputTokens,
    uncachedInputTokens,
  };
}

export function calculateContextUsage(params: {
  sources?: Array<{ content?: string; size?: number; includedInChat?: boolean }>;
  sourcesCount?: number;
  messages?: Array<{ role: string; content?: string; thinking?: string }>;
  draftInput?: string;
  systemPrompt?: string;
  totalTokens?: number;
  toolsTokens?: number;
  hasTools?: boolean;
}): ContextUsage {
  const totalTokens = params.totalTokens && params.totalTokens > 0 ? params.totalTokens : 1048576;

  // System/Socratic Tutor Prompt baseline (~4.7K tokens for full socratic & grounding instructions)
  const systemPromptTokens = params.systemPrompt
    ? Math.max(850, Math.round(params.systemPrompt.length / 3.8))
    : 4700;

  // Tool definitions (~8.8K tokens for MCP & Workspace tools schema)
  const toolDefinitionsTokens = params.toolsTokens ?? (params.hasTools !== false ? 8800 : 0);

  // Carried sources tokens estimation
  let sourcesTokens = 0;
  if (params.sources && params.sources.length > 0) {
    for (const s of params.sources) {
      if (s.includedInChat !== false) {
        const contentStr = typeof s.content === "string" ? s.content : s.content ? JSON.stringify(s.content) : "";
        if (contentStr) {
          sourcesTokens += Math.round(contentStr.length / 3.8);
        } else if (s.size) {
          sourcesTokens += Math.round(Math.min(s.size, 100000) / 4);
        } else {
          sourcesTokens += 450;
        }
      }
    }
  } else if (params.sourcesCount && params.sourcesCount > 0) {
    sourcesTokens = params.sourcesCount * 750;
  }

  // Messages tokens estimation
  let messagesTokens = 0;
  if (params.messages && params.messages.length > 0) {
    for (const m of params.messages) {
      messagesTokens += Math.round((m.content?.length || 0) / 3.8);
      if (m.thinking) {
        messagesTokens += Math.round(m.thinking.length / 4);
      }
    }
  }

  // Draft input in textarea
  const draftInputTokens = params.draftInput ? Math.round(params.draftInput.length / 3.8) : 0;

  const usedTokens = systemPromptTokens + toolDefinitionsTokens + sourcesTokens + messagesTokens + draftInputTokens;
  const rawPercentUsed = totalTokens > 0 ? (usedTokens / totalTokens) * 100 : 0;
  const percentUsed =
    rawPercentUsed <= 0
      ? "0%"
      : rawPercentUsed < 1
      ? `${rawPercentUsed.toFixed(1)}%`
      : `${Math.round(rawPercentUsed)}%`;
  const safePercent = Math.min(100, Math.max(0.5, rawPercentUsed));
  const availableTokens = Math.max(0, totalTokens - usedTokens);

  return {
    totalTokens,
    usedTokens,
    rawPercentUsed,
    percentUsed,
    safePercent,
    sourcesTokens,
    systemPromptTokens,
    toolDefinitionsTokens,
    messagesTokens,
    draftInputTokens,
    availableTokens,
  };
}
