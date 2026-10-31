import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { ConvexClient } from "convex/browser";
import {
  ArrowLeft,
  ArrowRight,
  Clipboard,
  Link,
  LogIn,
  LogOut,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Trash2,
  User,
  X,
} from "lucide-react";
import { ConstLogoIcon, ScrollArea } from "@const/ui";
import { DEFAULT_CONVEX_URL } from "@const/remote/config";
import { broker } from "@const/remote/protocol";
import { normalizePairingCode, openWithCode } from "@const/remote/crypto";
import { useTranslation } from "./i18n";

interface DesktopSession {
  sessionId: string;
  deviceName: string;
  pairingCode?: string;
  isOnline: boolean;
}
interface Connection {
  sessionId: string;
  key: string;
  deviceName?: string;
}
type Tab = "pairing" | "session" | "accounts";
const accountsUrl =
  import.meta.env.VITE_ACCOUNTS_URL || "https://accounts.const.web.id";
const convexUrl = import.meta.env.VITE_CONVEX_URL || DEFAULT_CONVEX_URL;

export default function App() {
  const { t } = useTranslation();
  const [token, setToken] = useState(
    () =>
      localStorage.getItem("const_harness_token") ||
      localStorage.getItem("const_sso_token"),
  );
  const [tab, setTab] = useState<Tab>("pairing");
  const [waiting, setWaiting] = useState(false);
  const [code, setCode] = useState("");
  const [direct, setDirect] = useState("");
  const [showDirect, setShowDirect] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<DesktopSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const iframe = useRef<HTMLIFrameElement>(null);
  const mounted = useRef(true);
  const authVersion = useRef(0);

  const receiveToken = (raw: string) => {
    try {
      const url = new URL(raw);
      const nativeCallback =
        url.protocol === "const-harness:" && url.hostname === "callback";
      if (
        !nativeCallback &&
        (url.origin !== location.origin || url.pathname !== location.pathname)
      )
        return;
      const expected = sessionStorage.getItem("const_mobile_auth_state");
      const next = url.searchParams.get("token");
      if (!next || !expected || url.searchParams.get("state") !== expected)
        return;
      localStorage.setItem("const_harness_token", next);
      sessionStorage.setItem("const_remote_token", next);
      sessionStorage.removeItem("const_mobile_auth_state");
      authVersion.current++;
      setToken(next);
      setWaiting(false);
      setBusy(false);
      setError(null);
      if (nativeCallback) void Browser.close().catch(() => {});
      else history.replaceState(null, "", location.pathname);
    } catch {
      /* Ignore unrelated deep links. */
    }
  };

  useEffect(() => {
    mounted.current = true;
    receiveToken(location.href);
    let disposed = false;
    const handles: Array<{ remove: () => Promise<void> }> = [];
    const track = (handle: { remove: () => Promise<void> }) => {
      if (disposed) void handle.remove();
      else handles.push(handle);
    };
    if (Capacitor.isNativePlatform()) {
      void CapApp.getLaunchUrl()
        .then((launch) => {
          if (!disposed && launch) receiveToken(launch.url);
        })
        .catch(() => {});
      void CapApp.addListener("appUrlOpen", ({ url }) => receiveToken(url))
        .then(track)
        .catch(() => {});
      void Browser.addListener("browserFinished", () => setWaiting(false))
        .then(track)
        .catch(() => {});
    }
    return () => {
      mounted.current = false;
      disposed = true;
      handles.forEach((handle) => void handle.remove());
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    let disposed = false;
    const client = new ConvexClient(convexUrl);
    client.setAuth(async () => token);
    setLoading(true);
    // Subscription updates immediately when a desktop goes offline or a session is removed.
    const unsubscribe = client.onUpdate(
      broker.listMySessions,
      {},
      (result: DesktopSession[]) => {
        if (disposed) return;
        setSessions(result);
        setLoading(false);
        setSessionError(false);
      },
      () => {
        if (!disposed) {
          setLoading(false);
          setSessionError(true);
        }
      },
    );
    return () => {
      disposed = true;
      unsubscribe();
      void client.close();
    };
  }, [token, refresh]);

  const signIn = async () => {
    setWaiting(true);
    setError(null);
    const state = crypto.randomUUID();
    sessionStorage.setItem("const_mobile_auth_state", state);
    const url = new URL(accountsUrl);
    url.searchParams.set(
      "continue",
      Capacitor.isNativePlatform()
        ? "const-harness://callback"
        : location.origin + location.pathname,
    );
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");
    url.searchParams.set("app", "harness");
    try {
      if (Capacitor.isNativePlatform()) await Browser.open({ url: url.href });
      else location.assign(url.href);
    } catch {
      setWaiting(false);
      setError(t("authError"));
    }
  };

  const signOut = () => {
    authVersion.current++;
    localStorage.removeItem("const_harness_token");
    localStorage.removeItem("const_sso_token");
    sessionStorage.removeItem("const_mobile_workspace");
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith("const_remote_") || key === "const_mobile_auth_state")
        sessionStorage.removeItem(key);
    }
    setConnection(null);
    setToken(null);
    setSessions([]);
    setError(null);
    setWaiting(false);
    setBusy(false);
  };

  const openSession = (next: Connection) => {
    // The bundled renderer shares this app's origin and tab credentials.
    // Neither the login token nor the encryption key is placed in a URL.
    if (token) sessionStorage.setItem("const_remote_token", token);
    sessionStorage.setItem(`const_remote_key:${next.sessionId}`, next.key);
    setConnection(next);
  };

  useEffect(() => {
    const exit = (event: MessageEvent) => {
      if (
        event.origin !== location.origin ||
        event.source !== iframe.current?.contentWindow
      )
        return;
      if (event.data?.type === "harness:workspace-error") {
        setConnection(null);
        setError(t("connectError"));
        return;
      }
      if (event.data?.type === "harness:disconnect") {
        setConnection(null);
        return;
      }
      if (event.data?.type !== "harness:exit") return;
      signOut();
      if (event.data.switchAccount) void signIn();
    };
    addEventListener("message", exit);
    return () => removeEventListener("message", exit);
  }, []);

  const connect = async (value = code) => {
    if (busy) return;
    const normalized = normalizePairingCode(value);
    if (normalized.length !== 6) {
      setError(t("invalidCode"));
      return;
    }
    if (!token) {
      void signIn();
      return;
    }
    setBusy(true);
    setError(null);
    const version = authVersion.current;
    const client = new ConvexClient(convexUrl);
    client.setAuth(async () => token);
    try {
      const result = await client.query(broker.resolvePairingCode, {
        code: `${normalized.slice(0, 3)}-${normalized.slice(3)}`,
      });
      const key = await openWithCode(normalized, result.encryptedSecret);
      if (!key) throw new Error("INVALID_KEY");
      if (mounted.current && authVersion.current === version)
        openSession({
          sessionId: result.sessionId,
          key,
          deviceName: result.deviceName,
        });
    } catch {
      if (mounted.current && authVersion.current === version)
        setError(t("connectError"));
    } finally {
      if (mounted.current && authVersion.current === version) setBusy(false);
      void client.close();
    }
  };

  const connectLink = () => {
    try {
      const url = new URL(direct.trim());
      const match = url.pathname.match(/^\/r\/([A-Za-z0-9_-]+)\/?$/);
      const key = new URLSearchParams(url.hash.slice(1)).get("key");
      if (
        !/^https?:$/.test(url.protocol) ||
        !match?.[1] ||
        !key ||
        !/^[A-Za-z0-9_-]{43}$/.test(key)
      )
        throw new Error("INVALID_LINK");
      if (!token) {
        void signIn();
        return;
      }
      setError(null);
      openSession({ sessionId: match[1], key });
    } catch {
      setError(t("invalidLink"));
    }
  };

  const removeSession = async (sessionId: string) => {
    if (!token || removing) return;
    setRemoving(sessionId);
    setError(null);
    const client = new ConvexClient(convexUrl);
    client.setAuth(async () => token);
    try {
      await client.mutation(broker.removeMySession, { sessionId });
      if (mounted.current) {
        setSessions((items) =>
          items.filter((item) => item.sessionId !== sessionId),
        );
        setConfirmRemove(null);
      }
    } catch {
      if (mounted.current) setError(t("removeError"));
    } finally {
      if (mounted.current) setRemoving(null);
      void client.close();
    }
  };

  const changeCode = (value: string) => {
    const cleaned = value
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(0, 6);
    setCode(
      cleaned.length > 3
        ? cleaned.slice(0, 3) + "-" + cleaned.slice(3)
        : cleaned,
    );
    setError(null);
  };

  if (connection) {
    const params = new URLSearchParams({
      sessionId: connection.sessionId,
      convexUrl,
      accountsUrl,
    });
    const src = `/remote/index.html?${params}`;
    return (
      <div className="mobile-shell">
        <header className="workspace-header safe-top-padding">
          <button
            className="icon-button"
            onClick={() => setConnection(null)}
            aria-label={t("disconnect")}
          >
            <ArrowLeft size={20} />
          </button>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {connection.deviceName || t("workspace")}
          </span>
          <button
            className="icon-button"
            aria-label={t("reload")}
            onClick={() => {
              if (iframe.current) iframe.current.src = src;
            }}
          >
            <RefreshCw size={18} />
          </button>
          <button
            className="icon-button"
            aria-label={t("disconnect")}
            onClick={() => setConnection(null)}
          >
            <X size={20} />
          </button>
        </header>
        <iframe
          ref={iframe}
          src={src}
          className="min-h-0 w-full flex-1 border-0"
          allow="clipboard-read; clipboard-write; fullscreen"
          title={t("workspace")}
        />
      </div>
    );
  }

  return (
    <div className="mobile-shell">
      <header className="app-header safe-top-padding">
        <ConstLogoIcon className="h-7 w-7" />
        <span className="text-base font-medium">Const Harness</span>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <main className="mx-auto w-full max-w-lg px-6 pb-8 pt-6">
          {!token ? (
            <section className="welcome">
              <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#222222]">
                <Monitor size={28} />
              </div>
              <h1>{t("welcome")}</h1>
              <p className="supporting mt-3">{t("welcomeHelp")}</p>
              <button
                className="primary mt-8"
                onClick={() => void signIn()}
                disabled={waiting}
              >
                {waiting ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  <LogIn size={18} />
                )}
                {t(waiting ? "signingIn" : "signIn")}
              </button>
              {waiting && (
                <button
                  className="secondary mt-3"
                  onClick={() => setWaiting(false)}
                >
                  {t("cancel")}
                </button>
              )}
            </section>
          ) : (
            <>
              <h1>
                {t(
                  tab === "pairing"
                    ? "connectTitle"
                    : tab === "session"
                      ? "sessionsTitle"
                      : "accountTitle",
                )}
              </h1>
              <p className="supporting mt-3 mb-8">
                {t(
                  tab === "pairing"
                    ? "connectHelp"
                    : tab === "session"
                      ? "sessionsHelp"
                      : "accountHelp",
                )}
              </p>
              {tab === "pairing" && (
                <>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void connect();
                    }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <label htmlFor="pairing-code" className="text-sm">
                        {t("code")}
                      </label>
                      <button
                        type="button"
                        className="text-button"
                        onClick={async () => {
                          try {
                            const text = await navigator.clipboard.readText();
                            if (text.includes("/r/")) {
                              setDirect(text);
                              setShowDirect(true);
                            } else changeCode(text);
                          } catch {
                            setError(t("clipboardError"));
                          }
                        }}
                      >
                        <Clipboard size={16} />
                        {t("paste")}
                      </button>
                    </div>
                    <input
                      id="pairing-code"
                      className="code-input"
                      value={code}
                      placeholder="XXX-XXX"
                      maxLength={7}
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      onChange={(event) => changeCode(event.target.value)}
                    />
                    <button
                      className="primary"
                      disabled={busy || normalizePairingCode(code).length !== 6}
                    >
                      {busy ? (
                        <RefreshCw size={18} className="animate-spin" />
                      ) : (
                        <ArrowRight size={18} />
                      )}
                      {t(busy ? "connecting" : "connect")}
                    </button>
                  </form>
                  <button
                    className="secondary mt-6"
                    aria-expanded={showDirect}
                    onClick={() => setShowDirect(!showDirect)}
                  >
                    <Link size={17} />
                    {t("direct")}
                  </button>
                  {showDirect && (
                    <form
                      className="mt-4 space-y-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        connectLink();
                      }}
                    >
                      <label htmlFor="pairing-link" className="text-sm">
                        {t("link")}
                      </label>
                      <input
                        id="pairing-link"
                        type="url"
                        className="field"
                        value={direct}
                        placeholder="https://…/r/…#key=…"
                        onChange={(event) => setDirect(event.target.value)}
                      />
                      <button className="primary" disabled={!direct.trim()}>
                        {t("connect")}
                      </button>
                    </form>
                  )}
                  <p className="supporting mt-8 flex items-center gap-2 text-xs">
                    <ShieldCheck size={16} />
                    {t("encrypted")}
                  </p>
                </>
              )}
              {tab === "session" && (
                <>
                  <div className="mb-4 flex items-center justify-between text-sm text-[#969696]">
                    <span>
                      {sessions.length} {t("session")}
                    </span>
                    <button
                      className="icon-button"
                      aria-label={t("reload")}
                      onClick={() => setRefresh((value) => value + 1)}
                    >
                      <RefreshCw
                        size={18}
                        className={loading ? "animate-spin" : ""}
                      />
                    </button>
                  </div>
                  {sessionError && (
                    <p role="alert" className="error-message mb-4">
                      {t("loadError")}
                    </p>
                  )}
                  {!loading && !sessionError && sessions.length === 0 && (
                    <div className="empty-state">
                      <Monitor size={28} />
                      <h2 className="mt-4 text-base font-medium">
                        {t("empty")}
                      </h2>
                      <p className="supporting mt-2">{t("emptyHelp")}</p>
                    </div>
                  )}
                  <div className="space-y-3">
                    {sessions.map((item) => (
                      <article className="session-row" key={item.sessionId}>
                        <div className="flex min-w-0 items-start gap-3">
                          <Monitor
                            size={22}
                            className="mt-1 shrink-0 text-[#969696]"
                          />
                          <div className="min-w-0 flex-1">
                            <h2 className="break-words text-sm font-medium">
                              {item.deviceName}
                            </h2>
                            <p className="supporting mt-1 text-xs">
                              {t(item.isOnline ? "online" : "offline")}
                              {item.pairingCode ? ` · ${item.pairingCode}` : ""}
                            </p>
                          </div>
                          <button
                            className="icon-button shrink-0"
                            disabled={!!removing}
                            aria-label={`${t("remove")}: ${item.deviceName}`}
                            onClick={() => setConfirmRemove(item.sessionId)}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                        {confirmRemove === item.sessionId ? (
                          <div className="mt-4">
                            <p className="supporting text-sm">
                              {t("removeHelp")}
                            </p>
                            <div className="mt-3 flex gap-2">
                              <button
                                className="secondary flex-1"
                                disabled={!!removing}
                                onClick={() => setConfirmRemove(null)}
                              >
                                {t("cancel")}
                              </button>
                              <button
                                className="primary flex-1"
                                disabled={!!removing}
                                onClick={() =>
                                  void removeSession(item.sessionId)
                                }
                              >
                                {removing === item.sessionId ? (
                                  <RefreshCw
                                    size={16}
                                    className="animate-spin"
                                  />
                                ) : (
                                  <Trash2 size={16} />
                                )}
                                {t("remove")}
                              </button>
                            </div>
                          </div>
                        ) : (
                          item.pairingCode && (
                            <button
                              className="secondary mt-3"
                              disabled={busy || !item.isOnline}
                              onClick={() => void connect(item.pairingCode)}
                            >
                              {t(busy ? "connecting" : "connect")}
                              <ArrowRight size={16} />
                            </button>
                          )
                        )}
                      </article>
                    ))}
                  </div>
                </>
              )}
              {tab === "accounts" && (
                <section className="space-y-4">
                  <div className="flex items-center gap-3 rounded-2xl bg-[#222222] p-4">
                    <User size={22} />
                    <span className="text-sm">{t("signedIn")}</span>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => void signIn()}
                    disabled={waiting}
                  >
                    <User size={18} />
                    {t(waiting ? "signingIn" : "switchAccount")}
                  </button>
                  {waiting && (
                    <button
                      className="text-button"
                      onClick={() => setWaiting(false)}
                    >
                      {t("cancel")}
                    </button>
                  )}
                  <button className="secondary" onClick={signOut}>
                    <LogOut size={18} />
                    {t("signOut")}
                  </button>
                </section>
              )}
            </>
          )}
          {error && (
            <p className="error-message mt-5" role="alert">
              {error}
            </p>
          )}
        </main>
      </ScrollArea>
      <nav className="bottom-nav" aria-label={t("navigation")}>
        {(
          [
            ["pairing", Link],
            ["session", Monitor],
            ["accounts", User],
          ] as const
        ).map(([id, Icon]) => (
          <button
            key={id}
            aria-current={tab === id ? "page" : undefined}
            className={tab === id ? "nav-item active" : "nav-item"}
            onClick={() => {
              setTab(id);
              setError(null);
            }}
          >
            <Icon size={21} />
            <span>{t(id)}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
