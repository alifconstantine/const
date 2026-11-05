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

/** A spent account allowance cannot recover through short transport retries. */
export async function isPermanentQuotaResponse(response: Response): Promise<boolean> {
  if (response.status !== 429 || !response.body) return false;
  const reader = response.clone().body!.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const decoder = new TextDecoder();
        let text = "";
        while (text.length < 16_384) {
          const chunk = await reader.read();
          if (chunk.done) break;
          text += decoder.decode(chunk.value, { stream: true });
        }
        return /weekly free token quota exceeded|daily API key limit reached|insufficient_quota|insufficient credits/i.test(text);
      })(),
      new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), 1000); }),
    ]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
  }
}
