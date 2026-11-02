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
