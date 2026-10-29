"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ConvexClient } from "convex/browser";
import {
  ArrowRight,
  Check,
  Copy,
  Laptop,
  LogIn,
  LogOut,
  Monitor,
  Radio,
  RotateCw,
  ShieldCheck,
  Smartphone,
  Tablet,
  TvMinimal,
  X,
} from "lucide-react";
import { remoteAuth, remoteLogin } from "@const/remote/auth";
import { openWithCode, normalizePairingCode } from "@const/remote/crypto";
import { broker } from "@const/remote/protocol";
import { DEFAULT_CONVEX_URL } from "@const/remote/config";
import { useI18n } from "@/context/I18nContext";

interface ActiveSessionItem {
  sessionId: string;
  deviceName: string;
  pairingCode?: string;
  isOnline: boolean;
  expiresAt: number;
  pairExpiresAt: number;
  hasPairingCode: boolean;
}

export function RemoteHub({
  convexUrl = DEFAULT_CONVEX_URL,
  accountsUrl = "https://accounts.const.web.id",
}: {
  convexUrl?: string;
  accountsUrl?: string;
}) {
  const router = useRouter();
  const { t } = useI18n();

  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ActiveSessionItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [directUrl, setDirectUrl] = useState("");
  const [showDirectInput, setShowDirectInput] = useState(false);

  // Initialize auth
  useEffect(() => {
    try {
      const credentials = remoteAuth("hub");
      if (credentials.token) {
        setToken(credentials.token);
      }
    } catch {
      // ignore initialization error
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch active sessions when authenticated
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const client = new ConvexClient(convexUrl);
    client.setAuth(async () => token);

    const fetchSessions = async () => {
      setLoadingSessions(true);
      try {
        const result = (await client.query(broker.listMySessions, {})) as ActiveSessionItem[];
        if (!cancelled && Array.isArray(result)) {
          setSessions(result);
        }
      } catch {
        // query may fail if unauthorized
      } finally {
        if (!cancelled) setLoadingSessions(false);
      }
    };

    void fetchSessions();
    const interval = setInterval(() => void fetchSessions(), 15_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      void client.close();
    };
  }, [token, convexUrl]);

  const handleCodeChange = (value: string) => {
    setError(null);
    const cleaned = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
    if (cleaned.length > 3) {
      setCode(`${cleaned.slice(0, 3)}-${cleaned.slice(3)}`);
    } else {
      setCode(cleaned);
    }
  };

  const handleConnectWithCode = async (pairingCodeToUse?: string) => {
    const rawCode = pairingCodeToUse || code;
    const normalized = normalizePairingCode(rawCode);
    if (normalized.length !== 6) {
      setError("Please enter a valid 6-character pairing code.");
      return;
    }
    if (!token) {
      remoteLogin(false, accountsUrl);
      return;
    }

    setSubmitting(true);
    setError(null);
    const client = new ConvexClient(convexUrl);
    client.setAuth(async () => token);

    try {
      const formatted = `${normalized.slice(0, 3)}-${normalized.slice(3)}`;
      const result = (await client.query(broker.resolvePairingCode, {
        code: formatted,
      })) as {
        sessionId: string;
        deviceName: string;
        encryptedSecret: string;
        pairHash: string;
      };

      if (!result?.sessionId || !result?.encryptedSecret) {
        throw new Error("Invalid code response");
      }

      // Decrypt the secret key client-side using the pairing code
      const secret = await openWithCode(normalized, result.encryptedSecret);
      if (!secret) {
        throw new Error("Decryption failed");
      }

      // Cache key in sessionStorage for this session
      sessionStorage.setItem(`const_remote_key:${result.sessionId}`, secret);

      // Save to remembered hosts
      try {
        const saved = JSON.parse(localStorage.getItem("const_paired_hosts") || "[]");
        const filtered = saved.filter((item: any) => item.sessionId !== result.sessionId);
        filtered.unshift({
          sessionId: result.sessionId,
          deviceName: result.deviceName,
          pairedAt: Date.now(),
        });
        localStorage.setItem("const_paired_hosts", JSON.stringify(filtered.slice(0, 10)));
      } catch {
        // localStorage best effort
      }

      // Redirect to the remote workspace
      router.push(`/r/${result.sessionId}#key=${secret}`);
    } catch {
      setError("Pairing code not found or expired. Check your desktop screen.");
    } finally {
      setSubmitting(false);
      void client.close();
    }
  };

  const handleDirectLinkSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!directUrl.trim()) return;
    try {
      const url = new URL(directUrl.trim());
      const hashKey = new URLSearchParams(url.hash.slice(1)).get("key");
      const pathParts = url.pathname.split("/");
      const sessionId = pathParts[pathParts.length - 1];
      if (sessionId && hashKey) {
        sessionStorage.setItem(`const_remote_key:${sessionId}`, hashKey);
        router.push(`/r/${sessionId}#key=${hashKey}`);
        return;
      }
      // If it's a relative path /r/xxx#key=yyy
      if (directUrl.includes("/r/")) {
        router.push(directUrl.trim());
        return;
      }
      setError("Invalid pairing URL. It should look like https://.../r/[session]#key=...");
    } catch {
      setError("Please enter a valid URL.");
    }
  };

  const handleSignOut = () => {
    sessionStorage.removeItem("const_remote_token");
    setToken(null);
    setSessions([]);
    location.assign(
      `${accountsUrl}/signout?continue=${encodeURIComponent(location.origin + "/remote")}`,
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <RotateCw className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="ch-shell ch-shell-wide py-12 sm:py-16">
      <div className="mx-auto max-w-2xl">
        {/* Header Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-[#1f1f23] border border-zinc-200 dark:border-[#2d2d33] mb-4 text-zinc-900 dark:text-white shadow-xs">
            <Radio className="h-7 w-7 text-blue-600 dark:text-blue-400 animate-pulse" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white mb-3">
            Remote Workspace
          </h1>
          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-lg mx-auto">
            Connect to and control your desktop Const Harness workspace remotely with end-to-end encryption.
          </p>
        </div>

        {/* Not Logged In State */}
        {!token ? (
          <div className="rounded-3xl border border-zinc-200/80 dark:border-[#262626] bg-white dark:bg-[#17171a] p-8 sm:p-10 shadow-xs text-center">
            <div className="max-w-md mx-auto flex flex-col items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-4">
                <LogIn className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
                Sign in to your Const Account
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
                Log in with the same account running on your desktop to automatically discover active hosts and enter pairing codes.
              </p>
              <button
                type="button"
                onClick={() => remoteLogin(false, accountsUrl)}
                className="w-full sm:w-auto min-w-[200px] inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium text-sm hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
              >
                <LogIn className="h-4 w-4" />
                <span>Sign in with Const Accounts</span>
              </button>

              <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800/80 w-full">
                <button
                  type="button"
                  onClick={() => setShowDirectInput((prev) => !prev)}
                  className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 underline underline-offset-4 cursor-pointer"
                >
                  {showDirectInput ? "Hide manual pairing" : "Have a full pairing link? Connect directly"}
                </button>

                {showDirectInput && (
                  <form onSubmit={handleDirectLinkSubmit} className="mt-4 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={directUrl}
                      onChange={(e) => setDirectUrl(e.target.value)}
                      placeholder="https://.../r/[session]#key=..."
                      className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-400"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-medium rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                    >
                      Connect
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Logged In State: Pairing Code & Active Sessions */
          <div className="flex flex-col gap-6">
            {/* Account Status Card */}
            <div className="flex items-center justify-between px-5 py-3 rounded-2xl bg-zinc-100/70 dark:bg-[#1a1a1e] border border-zinc-200/60 dark:border-[#28282e]">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Signed in to Const Accounts
                </span>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign out</span>
              </button>
            </div>

            {/* Enter Pairing Code Card */}
            <div className="rounded-3xl border border-zinc-200/80 dark:border-[#262626] bg-white dark:bg-[#17171a] p-6 sm:p-8 shadow-xs">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <TvMinimal className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                    Enter Pairing Code
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Enter the 6-character code shown on your desktop's Remote Control dialog
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-5">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="XXX-XXX"
                  maxLength={7}
                  className="flex-1 px-4 py-3.5 font-mono text-xl text-center sm:text-left tracking-widest uppercase rounded-2xl border border-zinc-200 dark:border-[#333338] bg-zinc-50 dark:bg-[#1c1c20] text-zinc-900 dark:text-white outline-none focus:border-blue-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => handleConnectWithCode()}
                  disabled={submitting || code.replace(/[^A-Za-z0-9]/g, "").length !== 6}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
                >
                  {submitting ? (
                    <RotateCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <span>Connect</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>

              {error && (
                <p className="text-xs text-red-500 dark:text-red-400 font-medium mt-3">
                  {error}
                </p>
              )}

              <div className="mt-4 flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Zero-Knowledge End-to-End Encrypted using AES-256-GCM.</span>
              </div>
            </div>

            {/* Active Desktop Workspaces List */}
            <div className="rounded-3xl border border-zinc-200/80 dark:border-[#262626] bg-white dark:bg-[#17171a] p-6 sm:p-8 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                    Active Desktop Sessions
                  </h3>
                  <span className="text-xs text-zinc-400">({sessions.length})</span>
                </div>
                {loadingSessions && (
                  <RotateCw className="h-3.5 w-3.5 animate-spin text-zinc-400" />
                )}
              </div>

              {sessions.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {sessions.map((item) => (
                    <div
                      key={item.sessionId}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-50 dark:bg-[#1b1b1e] border border-zinc-200/70 dark:border-[#2a2a30] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/5 dark:bg-[#25252a] text-zinc-800 dark:text-white">
                          <Laptop className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-zinc-900 dark:text-white">
                              {item.deviceName}
                            </span>
                            <span
                              className={`h-2 w-2 rounded-full ${
                                item.isOnline ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
                              }`}
                            />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            <span>{item.isOnline ? "Online" : "Waiting"}</span>
                            {item.pairingCode && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-zinc-700 dark:text-zinc-300 font-semibold">
                                  {item.pairingCode}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {item.pairingCode ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCode(item.pairingCode!);
                              void handleConnectWithCode(item.pairingCode);
                            }}
                            className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium text-xs hover:opacity-90 transition-opacity cursor-pointer"
                          >
                            Connect
                          </button>
                        ) : (
                          <span className="text-xs text-zinc-400">Pair via Desktop</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center rounded-2xl bg-zinc-50/60 dark:bg-[#1a1a1d] border border-dashed border-zinc-200 dark:border-zinc-800">
                  <Monitor className="h-8 w-8 mx-auto text-zinc-400 mb-2 opacity-60" />
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    No active desktop sessions found
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
                    Open Const Harness Desktop, click the Remote Control icon on the top toolbar, and start a session.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
