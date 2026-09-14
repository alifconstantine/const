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
}

export interface ContextUsage {
  totalTokens: number;
  usedTokens: number;
  rawPercentUsed: number;
  percentUsed: string;
  safePercent: number;
  sourcesTokens: number;
  systemPromptTokens: number;
  messagesTokens: number;
  draftInputTokens: number;
  availableTokens: number;
}

export function formatTokenDisplay(tokens: number): string {
  if (tokens <= 0) return "0";
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 10000) return `${(tokens / 1000).toFixed(1)}k`;
  if (tokens < 1000000) return `${Math.round(tokens / 1000)}k`;
  return `${(tokens / 1000000).toFixed(1)}M`;
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
  };
}

export function calculateContextUsage(params: {
  sources?: Array<{ content?: string; size?: number; includedInChat?: boolean }>;
  messages?: Array<{ role: string; content?: string; thinking?: string }>;
  draftInput?: string;
  totalTokens?: number;
}): ContextUsage {
  const totalTokens = params.totalTokens && params.totalTokens > 0 ? params.totalTokens : 1048576;

  // System/Socratic Tutor Prompt baseline
  const systemPromptTokens = 850;

  // Carried sources tokens estimation
  let sourcesTokens = 0;
  if (params.sources && params.sources.length > 0) {
    for (const s of params.sources) {
      if (s.includedInChat !== false) {
        if (s.content) {
          sourcesTokens += Math.round(s.content.length / 3.8);
        } else if (s.size) {
          sourcesTokens += Math.round(Math.min(s.size, 100000) / 4);
        } else {
          sourcesTokens += 450;
        }
      }
    }
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

  const usedTokens = systemPromptTokens + sourcesTokens + messagesTokens + draftInputTokens;
  const rawPercentUsed = totalTokens > 0 ? (usedTokens / totalTokens) * 100 : 0;
  const percentUsed = rawPercentUsed < 0.1 ? "<0.1%" : `${rawPercentUsed.toFixed(1)}%`;
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
    messagesTokens,
    draftInputTokens,
    availableTokens,
  };
}
