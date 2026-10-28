/** Only structured broker errors affect navigation; arbitrary server text is not trusted. */
export function remoteFailureAction(
  error: unknown,
): "login" | "missingKey" | "error" {
  const data = (error as { data?: unknown } | null)?.data;
  const code =
    data && typeof data === "object" && "code" in data ? data.code : undefined;
  if (code === "REMOTE_UNAUTHORIZED") return "login";
  if (
    [
      "REMOTE_SESSION_EXPIRED",
      "REMOTE_PAIRING_EXPIRED",
      "REMOTE_DEVICE_REVOKED",
    ].includes(String(code))
  )
    return "missingKey";
  return "error";
}
