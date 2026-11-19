/** Context rejection requires a smaller request, not a transport retry. */
export function isContextWindowError(message: string): boolean {
  return /context_length_exceeded|model_context_window_exceeded|request exceeds model context window|exceeds (?:the )?(?:model['’]s? )?(?:maximum )?context (?:window|length)|context (?:window|length).*(?:exceed|limit)|prompt is too long|too many (?:input )?tokens/i.test(message);
}

/** A malformed image, context overflow or browser failure is not evidence that
 * the model lacks vision. Fall back to text only on an explicit capability rejection. */
export function isUnsupportedImageError(message: string): boolean {
  const modality = "(?:image(?:_url| input|s)?|vision|multimodal|modality)";
  const rejection = "(?:not supported|unsupported|does not support|not available|not enabled|only supported)";
  return new RegExp(`${modality}[^\\n]{0,120}${rejection}|${rejection}[^\\n]{0,120}${modality}`, "i").test(message);
}

/** Router pricing/budget policy rejections are deterministic and must not be blindly retried. */
export function isRouterBudgetLimitError(message: string): boolean {
  return /no available offer met the effective request price limits|no eligible price offer|tightened the catalogue ceiling|effective request price limits/i.test(message);
}

/** Permanent quota or credit exhaustion cannot recover through short transport retries. */
export function isPermanentQuotaMessage(message: string): boolean {
  return /weekly free token quota exceeded|daily API key limit reached|insufficient_quota|insufficient credits|credit balance is too low|account quota exceeded/i.test(message);
}

/** Non-retryable model/policy/auth errors that may arrive either via HTTP status or SSE chunk.error. */
export function isNonRetryableModelError(message: string): boolean {
  if (isRouterBudgetLimitError(message) || isPermanentQuotaMessage(message)) return true;
  if (/\[(?:400|401|403|404)\]|invalid_api_key|authentication failed|unauthorized|forbidden|model (?:is )?(?:not found|unavailable|deprecated)|unknown model|does not exist/i.test(message)) {
    return true;
  }
  return false;
}

/** Step down reasoning effort by one tier for adaptive retry after a reasoning-only timeout. */
export function downgradeThinkingLevel(level?: string): string | undefined {
  if (!level) return undefined;
  switch (level.toLowerCase()) {
    case "max":
    case "xhigh":
      return "medium";
    case "high":
    case "medium":
      return "low";
    case "low":
    case "minimal":
      return "off";
    default:
      return undefined;
  }
}

async function readBoundedResponsePreview(response: Response, maxChars = 16_384, timeoutMs = 1000): Promise<string> {
  if (!response.body) return "";
  const reader = response.clone().body!.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const decoder = new TextDecoder();
        let text = "";
        while (text.length < maxChars) {
          const chunk = await reader.read();
          if (chunk.done) break;
          text += decoder.decode(chunk.value, { stream: true });
        }
        return text;
      })(),
      new Promise<string>((resolve) => {
        timer = setTimeout(() => resolve(""), timeoutMs);
      }),
    ]);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
  }
}

/** A spent account allowance cannot recover through short transport retries. */
export async function isPermanentQuotaResponse(response: Response): Promise<boolean> {
  if (response.status !== 429 || !response.body) return false;
  const text = await readBoundedResponsePreview(response);
  return isPermanentQuotaMessage(text);
}

/** Deterministic Router 503 price/budget rejections must fail fast instead of retrying identical requests. */
export async function isNonRetryable503Response(response: Response): Promise<boolean> {
  if (response.status !== 503 || !response.body) return false;
  const text = await readBoundedResponsePreview(response);
  return isRouterBudgetLimitError(text);
}
