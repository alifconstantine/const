/** Navigation policy shared by the driver and the guest session. */
export function assertBrowserNavigation(url: string, allowedDomains: readonly string[] = []): void {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('The embedded browser only loads http:// and https:// pages.');
  }
  const host = parsed.hostname.toLowerCase();
  if (allowedDomains.length && !allowedDomains.some((entry) =>
    entry === '*' || entry === host ||
    (entry.startsWith('*.') && (host === entry.slice(2) || host.endsWith(entry.slice(1))))
  )) {
    throw new Error(`Navigation to '${host}' is blocked by the browser domain allowlist.`);
  }
}

export function normalizeBrowserUrl(url: string): string {
  const trimmed = String(url || '').trim();
  if (!trimmed) return 'https://www.google.com';
  const local = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?([/?#].*)?$/i.test(trimmed);
  // host:port is not a URL scheme. All other explicit schemes are validated as-is.
  const candidate = local ? `http://${trimmed}` :
    /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  assertBrowserNavigation(candidate);
  return new URL(candidate).href;
}
