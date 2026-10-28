export const REDACTED = "••••••••";
const secretKey =
  /(?:api.?key|access.?token|refresh.?token|private.?key|password|secret|authorization|^token$)/i;
export function assertSafeRemoteValue(
  value: unknown,
  depth = 0,
  budget = { nodes: 0 },
): void {
  if (++budget.nodes > 100_000 || depth > 40)
    throw new Error("REMOTE_ARGUMENT_LIMIT");
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (["__proto__", "constructor", "prototype"].includes(key))
      throw new Error("REMOTE_INVALID_ARGUMENT");
    assertSafeRemoteValue(child, depth + 1, budget);
  }
}
export function redactRemoteConfig(value: any): any {
  if (Array.isArray(value)) return value.map(redactRemoteConfig);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      secretKey.test(key) && typeof item === "string" && item
        ? REDACTED
        : redactRemoteConfig(item),
    ]),
  );
}
export function restoreRemoteConfig(incoming: any, existing: any): any {
  assertSafeRemoteValue(incoming);
  const restore = (value: any, old: any): any => {
    if (value === REDACTED) return old;
    if (Array.isArray(value))
      return value.map((item, i) => restore(item, old?.[i]));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        restore(item, old?.[key]),
      ]),
    );
  };
  return restore(incoming, existing);
}
