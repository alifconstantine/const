export function remoteAuth(sessionId: string) {
  const url = new URL(location.href);
  const key = new URLSearchParams(url.hash.slice(1)).get("key");
  if (key && /^[A-Za-z0-9_-]{43}$/.test(key))
    sessionStorage.setItem(`const_remote_key:${sessionId}`, key);
  const callback = url.searchParams.get("token");
  const expectedState = sessionStorage.getItem("const_remote_login_state");
  if (
    callback &&
    expectedState &&
    url.searchParams.get("state") === expectedState
  ) {
    sessionStorage.setItem("const_remote_token", callback);
    sessionStorage.removeItem("const_remote_login_state");
  }
  history.replaceState(null, "", url.pathname);
  const cookie = document.cookie
    .split("; ")
    .find((part) => part.startsWith("const_sso_token="))
    ?.slice("const_sso_token=".length);
  return {
    key: sessionStorage.getItem(`const_remote_key:${sessionId}`),
    token:
      sessionStorage.getItem("const_remote_token") ||
      (cookie ? decodeURIComponent(cookie) : null),
  };
}
export function remoteLogin(
  switchAccount = false,
  accountsUrl = "https://accounts.const.web.id",
) {
  const state = crypto.randomUUID();
  sessionStorage.setItem("const_remote_login_state", state);
  const accounts = new URL(accountsUrl);
  accounts.searchParams.set("continue", location.origin + location.pathname);
  accounts.searchParams.set("state", state);
  accounts.searchParams.set("app", "harness");
  if (switchAccount) accounts.searchParams.set("prompt", "select_account");
  location.assign(accounts.href);
}
