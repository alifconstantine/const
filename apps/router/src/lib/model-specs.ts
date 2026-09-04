export const DEFAULT_CONTEXT_WINDOW = "1000000"; // 1M
export const DEFAULT_MAX_OUTPUT = "128000"; // 128K
export const DEFAULT_INPUT_TYPES = ["text"];
export const DEFAULT_OUTPUT_TYPES = ["text"];

/**
 * Format raw token count into human-readable notation (e.g. 1000000 -> "1M", 128000 -> "128K", 65536 -> "64K").
 * If no valid count is provided, returns fallback (default: "1M").
 */
export function formatTokenDisplay(tokens?: number | string | null, fallback: string = "1M"): string {
  if (!tokens) return fallback;

  if (typeof tokens === "string") {
    const trimmed = tokens.trim();
    if (/^\d+[KMGTkmgt]?$/.test(trimmed)) {
      return trimmed.toUpperCase();
    }
    const parsed = parseInt(trimmed.replace(/,/g, ""), 10);
    if (!isNaN(parsed) && parsed > 0) {
      tokens = parsed;
    } else {
      return trimmed;
    }
  }

  if (typeof tokens === "number" && tokens > 0) {
    if (tokens >= 1000000) {
      const millions = Math.round(tokens / 1000000);
      return `${millions}M`;
    }
    if (tokens >= 1000) {
      const thousands = Math.round(tokens / 1000);
      return `${thousands}K`;
    }
    return `${tokens}`;
  }

  return fallback;
}

export function formatContextWindow(tokens?: number | string | null): string {
  return formatTokenDisplay(tokens, "1M");
}
