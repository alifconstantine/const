export function getAccountsUrl(): string {
  if (typeof window !== "undefined") {
    // Check if custom env is provided
    if (process.env.NEXT_PUBLIC_ACCOUNTS_URL) {
      return process.env.NEXT_PUBLIC_ACCOUNTS_URL;
    }
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:3001";
    }
    return "https://accounts.const.web.id";
  }
  return process.env.NEXT_PUBLIC_ACCOUNTS_URL || "http://localhost:3001";
}

export function getAppUrl(): string {
  if (typeof window !== "undefined") {
    if (process.env.NEXT_PUBLIC_APP_URL) {
      return process.env.NEXT_PUBLIC_APP_URL;
    }
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return window.location.origin;
    }
    return "https://router.const.web.id";
  }
  return process.env.NEXT_PUBLIC_APP_URL || "https://router.const.web.id";
}

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^|;\\s*)(" + name + ")=([^;]*)"));
  return match && match[3] ? decodeURIComponent(match[3]) : null;
}

export function setCookie(name: string, value: string, maxAgeDays = 30) {
  if (typeof document === "undefined") return;
  const hostname = window.location.hostname.toLowerCase();
  const maxAge = maxAgeDays * 24 * 60 * 60;
  if (hostname === "const.web.id" || hostname.endsWith(".const.web.id")) {
    document.cookie = `${name}=${encodeURIComponent(value)}; Domain=.const.web.id; Path=/; SameSite=Lax; Secure; Max-Age=${maxAge}`;
  } else {
    document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax; Max-Age=${maxAge}`;
  }
}

export function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  const hostname = window.location.hostname.toLowerCase();
  if (hostname === "const.web.id" || hostname.endsWith(".const.web.id")) {
    document.cookie = `${name}=; Domain=.const.web.id; Path=/; SameSite=Lax; Secure; Max-Age=0`;
  } else {
    document.cookie = `${name}=; Path=/; SameSite=Lax; Max-Age=0`;
  }
}
