/** Callbacks without an active nonce, including replays, never authenticate. */
export function matchesAuthState(expected: string | null, received: string | null | undefined): boolean {
  return !!expected && typeof received === "string" && received === expected;
}
