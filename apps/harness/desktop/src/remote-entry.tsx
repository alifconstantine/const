import "./lib/disable-openui-devtools";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ConstLogoIcon, Toaster } from "@const/ui";
import { RemoteClient } from "@const/remote/client";
import { remoteAuth, remoteLogin } from "@const/remote/auth";
import { remoteFailureAction } from "@const/remote/errors";
import { remoteCopy } from "@const/remote/copy";
import { AuthenticatedContent } from "./App";
import { ConvexClientProvider } from "./components/convex-provider";
import { createDesktopBridge } from "./lib/desktop-bridge";
import { remoteDesktopTransport } from "./lib/remote-desktop-transport";
import { I18nProvider, useTranslation } from "./lib/i18n";
import { RemoteRuntimeContext } from "./lib/remote-runtime";
import { initThemeListener } from "./lib/theme";
import { installRemoteAssets } from "./lib/remote-assets";
import "./index.css";
import "./remote.css";
import { RemoteDirectoryPicker } from "./components/remote-directory-picker";
import { RemoteWorkspaceBoundary } from "./components/remote-workspace-boundary";
import { RemotePullToRefresh } from "./components/remote-pull-to-refresh";
import { scopedRemoteStorage } from "./lib/remote-storage";

type Options = {
  sessionId: string;
  convexUrl: string;
  accountsUrl: string;
  onExit?: (switchAccount: boolean) => void;
  onDisconnect?: () => void;
};
function Workspace({ sessionId, convexUrl, accountsUrl, onExit, onDisconnect }: Options) {
  const { language } = useTranslation();
  const t = remoteCopy(language);
  const [gate, setGate] = useState<
    "connecting" | "login" | "missingKey" | "error" | "ready"
  >("connecting");
  const [token, setToken] = useState<string | null>(null);
  const [device, setDevice] = useState("");
  const [online, setOnline] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [mobile, setMobile] = useState(() => innerWidth < 768);
  const [peer, setPeer] = useState<RemoteClient | null>(null);
  const [directoryRoot, setDirectoryRoot] = useState("");
  const [directoryPicker, setDirectoryPicker] = useState(false);
  const directoryResolver = useRef<((value: string | null) => void) | null>(
    null,
  );
  useEffect(() => {
    const resize = () => {
      setMobile(innerWidth < 768);
      document.body.classList.toggle("remote-mobile-root", innerWidth < 768);
      document.documentElement.style.setProperty(
        "--remote-height",
        `${visualViewport?.height || innerHeight}px`,
      );
    };
    resize();
    addEventListener("resize", resize);
    visualViewport?.addEventListener("resize", resize);
    return () => {
      removeEventListener("resize", resize);
      visualViewport?.removeEventListener("resize", resize);
      document.documentElement.style.removeProperty("--remote-height");
      document.body.classList.remove("remote-mobile-root");
    };
  }, []);
  useEffect(() => {
    let disposed = false;
    let client: RemoteClient | undefined;
    let bridge: ReturnType<typeof remoteDesktopTransport> | undefined;
    setGate("connecting");
    setOnline(false);
    const fail = (error: unknown) => {
      if (!disposed) {
        setOnline(false);
        setGate(remoteFailureAction(error));
      }
    };
    try {
      const credentials = remoteAuth(sessionId);
      if (!credentials.key) {
        setGate("missingKey");
        return;
      }
      if (!credentials.token) {
        setGate("login");
        return;
      }
      setToken(credentials.token);
      client = new RemoteClient(
        sessionId,
        credentials.key,
        convexUrl,
        credentials.token,
        (packet) => bridge?.event(packet),
        (connected, name) => {
          if (!disposed) {
            setOnline(connected);
            setDevice(name);
          }
        },
        fail,
      );
      bridge = remoteDesktopTransport(
        client,
        () => {
          if (!disposed) setAttempt((value) => value + 1);
        },
        () =>
          new Promise((resolve) => {
            directoryResolver.current?.(null);
            directoryResolver.current = resolve;
            setDirectoryPicker(true);
          }),
      );
      let zoom = 1;
      const api = createDesktopBridge(
        bridge.transport,
        {
          getZoomFactor: () => zoom,
          setZoomFactor: (factor) => {
            zoom = factor;
            document.documentElement.style.zoom = String(factor);
          },
        },
        { getPathForFile: () => "" },
      );
      window.electron = api as typeof window.electron;
      void client
        .connect()
        .then(async () => {
          if (disposed) return;
          const runtime = await bridge!.transport.invoke("system:runtime");
          api.platform = runtime.platform;
          api.versions = runtime.versions;
          setDirectoryRoot(runtime.defaultDirectory);
          if (!disposed) {
            setPeer(client!);
            setGate("ready");
          }
        })
        .catch(fail);
    } catch (error) {
      fail(error);
    }
    return () => {
      disposed = true;
      directoryResolver.current?.(null);
      directoryResolver.current = null;
      setPeer(null);
      bridge?.dispose();
      void client?.close();
      delete window.electron;
    };
  }, [sessionId, convexUrl, attempt]);
  const exit = async (switchAccount = false) => {
    if (onExit) {
      await peer?.close(true);
      onExit(switchAccount);
      return;
    }
    const key = switchAccount
      ? sessionStorage.getItem(`const_remote_key:${sessionId}`)
      : null;
    await peer?.close(true);
    if (key) sessionStorage.setItem(`const_remote_key:${sessionId}`, key);
    sessionStorage.removeItem("const_remote_token");
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(`const_remote_ui:${sessionId}:`))
        sessionStorage.removeItem(key);
    if (switchAccount) remoteLogin(true, accountsUrl);
    else
      location.assign(
        `${accountsUrl}/signout?continue=${encodeURIComponent(location.origin + location.pathname)}`,
      );
  };
  if (gate !== "ready" || !token)
    return (
      <div className="remote-gate">
        <ConstLogoIcon className="h-10 w-10" />
        <h1>{t(gate === "connecting" ? "connecting" : "connect")}</h1>
        <p>
          {t(
            gate === "login"
              ? "sameAccount"
              : gate === "missingKey"
                ? "missingKey"
                : gate === "connecting"
                  ? "encrypted"
                  : "error",
          )}
        </p>
        {gate === "login" ? (
          <button onClick={() => onExit ? onExit(true) : remoteLogin(false, accountsUrl)}>
            {t("login")}
          </button>
        ) : gate === "error" ? (
          <button onClick={() => setAttempt((value) => value + 1)}>
            {t("retry")}
          </button>
        ) : null}
      </div>
    );
  return (
    <RemoteRuntimeContext.Provider
      value={{
        deviceName: device,
        online,
        mobile,
        disconnect: async () => {
          await peer?.close(true);
          if (onDisconnect) {
            onDisconnect();
            return;
          }
          setGate("missingKey");
        },
      }}
    >
      <ConvexClientProvider
        token={token}
        url={convexUrl}
        signOut={() => void exit()}
      >
        <div
          className={`remote-client ${mobile ? "remote-mobile" : "remote-desktop"}`}
        >
          <RemotePullToRefresh enabled={mobile}>
            <AuthenticatedContent
              onSignOut={() => void exit()}
              onSwitchAccount={() => void exit(true)}
            />
          </RemotePullToRefresh>
          {directoryPicker && (
            <RemoteDirectoryPicker
              initialPath={directoryRoot}
              close={() => {
                directoryResolver.current?.(null);
                directoryResolver.current = null;
                setDirectoryPicker(false);
              }}
              select={async (path) => {
                const selected = await peer!.request({
                  type: "desktop:invoke",
                  payload: {
                    channel: "workspace:select-directory",
                    args: [path],
                  },
                });
                if (!selected.ok) throw new Error("invalid");
                directoryResolver.current?.(selected.value);
                directoryResolver.current = null;
                setDirectoryPicker(false);
              }}
            />
          )}
          <Toaster position="bottom-right" />
        </div>
      </ConvexClientProvider>
    </RemoteRuntimeContext.Provider>
  );
}

export function mountRemoteWorkspace(element: HTMLElement, options: Options) {
  const restore = scopedRemoteStorage(options.sessionId);
  const old = (globalThis as Record<symbol, unknown>)[
    Symbol.for("openui.devtools.autoMount")
  ];
  (globalThis as Record<symbol, unknown>)[
    Symbol.for("openui.devtools.autoMount")
  ] = true;
  const cleanupTheme = initThemeListener();
  const cleanupAssets = installRemoteAssets();
  const root = createRoot(element);
  root.render(
    <I18nProvider>
      <RemoteWorkspaceBoundary>
        <Workspace {...options} />
      </RemoteWorkspaceBoundary>
    </I18nProvider>,
  );
  return () => {
    root.unmount();
    cleanupAssets();
    cleanupTheme?.();
    restore();
    (globalThis as Record<symbol, unknown>)[
      Symbol.for("openui.devtools.autoMount")
    ] = old;
  };
}
(window as any).ConstRemoteWorkspace = { mount: mountRemoteWorkspace };
