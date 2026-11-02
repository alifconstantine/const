import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { UpdateControl } from "../../shared/updates/update-control";
import { compareVersions, fetchRelease, type UpdateState, type UpdatePreferences, type UpdateClient, type ReleaseAsset } from "../../shared/updates/releases";
import { updateStrings } from "../../shared/updates/strings";
import { useTranslation } from "./i18n";
import appPackage from "../package.json";

interface NativeStatus { status: "idle" | "downloading" | "ready" | "error"; progress?: number; error?: UpdateState["error"]; version?: string }
const native = registerPlugin<{
  download(value: ReleaseAsset & { version: string; tag: string }): Promise<NativeStatus>;
  install(): Promise<NativeStatus>;
  getStatus(): Promise<NativeStatus>;
  addListener(event: "progress", listener: (value: NativeStatus) => void): Promise<PluginListenerHandle>;
}>("HarnessUpdates");
class MobileUpdates implements UpdateClient {
  private listeners = new Set<(state: UpdateState) => void>();
  private state: UpdateState = { installed: appPackage.version, status: "idle", canInstall: false, preferences: { autoCheck: true, autoDownload: true } };
  private initialized?: Promise<void>;
  private pending?: Promise<UpdateState>;
  private nativeListener?: PluginListenerHandle;
  private interval?: ReturnType<typeof setInterval>;
  private emit(value: Partial<UpdateState>) { this.state = { ...this.state, ...value }; for (const listener of this.listeners) listener(this.state); return this.state; }
  private initialize() {
    return this.initialized ??= (async () => {
      try { const saved = JSON.parse(localStorage.getItem("const_mobile_updates") || "null"); if (typeof saved?.autoCheck === "boolean" && typeof saved?.autoDownload === "boolean") this.state.preferences = saved; } catch {}
      if (Capacitor.isNativePlatform()) {
        try {
          const info = await CapApp.getInfo(); this.state.installed = info.version;
          this.nativeListener = await native.addListener("progress", value => { this.emit({ status: value.status === "idle" ? this.state.status : value.status, progress: value.progress, error: value.error }); });
        } catch { /* Browser preview still supports manual release downloads. */ }
      }
      if (this.state.preferences.autoCheck) void this.check();
      this.interval = setInterval(() => { if (this.state.preferences.autoCheck) void this.check(); }, 6 * 60 * 60_000);
    })();
  }
  subscribe = (listener: (state: UpdateState) => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getState = async () => { await this.initialize(); return this.state; };
  setPreferences = async (preferences: UpdatePreferences) => {
    try { localStorage.setItem("const_mobile_updates", JSON.stringify(preferences)); } catch {}
    this.emit({ preferences });
    if (preferences.autoDownload && this.state.status === "available" && this.state.canInstall && this.state.release?.asset?.sha256) void this.download();
    return this.state;
  };
  check = (): Promise<UpdateState> => {
    if (this.pending || ["ready", "installing"].includes(this.state.status)) return this.pending || Promise.resolve(this.state);
    this.emit({ status: "checking", error: undefined });
    this.pending = (async () => {
      try {
        const release = await fetchRelease({ os: "android" });
        const newer = release && compareVersions(release.version, this.state.installed) > 0;
        const canInstall = Capacitor.isPluginAvailable("HarnessUpdates");
        let status: UpdateState["status"] = newer ? "available" : "current";
        if (newer && canInstall) { const cached = await native.getStatus(); if (cached.status === "ready" && cached.version === release?.version) status = "ready"; }
        return this.emit({ release, status, canInstall });
      } catch { return this.emit({ status: "error", error: "network" }); }
    })().finally(() => { this.pending = undefined; if (this.state.status === "available" && this.state.canInstall && this.state.release?.asset?.sha256 && this.state.preferences.autoDownload) void this.download(); });
    return this.pending;
  };
  download = (): Promise<UpdateState> => {
    if (this.pending) return this.pending;
    const release = this.state.release;
    if (!release?.asset || compareVersions(release.version, this.state.installed) <= 0) return Promise.resolve(this.state);
    if (!this.state.canInstall || !release.asset.sha256) return this.openUrl(release.asset.url).then(() => this.state).catch(() => this.emit({ status: "error", error: "download" }));
    this.emit({ status: "downloading", progress: 0, error: undefined });
    this.pending = native.download({ ...release.asset, version: release.version, tag: release.tag }).then(value => this.emit({ status: value.status === "ready" ? "ready" : "error", error: value.error, progress: value.progress }))
      .catch(() => this.emit({ status: "error", error: "download" })).finally(() => { this.pending = undefined; });
    return this.pending;
  };
  install = (): Promise<UpdateState> => {
    if (this.pending) return this.pending;
    if (!this.state.canInstall) return Promise.resolve(this.state);
    this.emit({ status: "installing", error: undefined });
    this.pending = native.install().then(value => this.emit({ status: value.status === "error" ? "error" : "ready", error: value.error }))
      .catch(() => this.emit({ status: "error", error: "verification" })).finally(() => { this.pending = undefined; });
    return this.pending;
  };
  openUrl = async (url: string) => { if (Capacitor.isNativePlatform()) await Browser.open({ url }); else window.open(url, "_blank", "noopener,noreferrer"); };
  dispose() { clearInterval(this.interval); void this.nativeListener?.remove(); }
}
const client = new MobileUpdates();
if (import.meta.hot) import.meta.hot.dispose(() => client.dispose());
export function MobileUpdateControl() {
  const { language } = useTranslation();
  return <UpdateControl client={client} labels={updateStrings(language)} language={language} mobile />;
}
