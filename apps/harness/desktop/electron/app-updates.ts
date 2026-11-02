import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { compareVersions, fetchRelease, type UpdateState, type UpdatePreferences, type UpdateTarget } from "../../shared/updates/releases";

interface Options {
  version: string; target: UpdateTarget; packaged: boolean; directory: string;
  preferences(): UpdatePreferences; savePreferences(value: UpdatePreferences): void;
  emit(state: UpdateState): void; busy(): boolean;
  openExternal(url: string): Promise<unknown>; openInstaller(file: string): Promise<string>; quit(): void;
}
/** Only main-process GitHub metadata can select the executable. No renderer paths/URLs. */
export class DesktopAppUpdates {
  private state: UpdateState;
  private pending?: Promise<UpdateState>;
  private downloaded?: string;
  private timer?: ReturnType<typeof setInterval>;
  private startup?: ReturnType<typeof setTimeout>;
  private abort?: AbortController;
  constructor(private options: Options) {
    this.state = { installed: options.version, status: "idle", canInstall: options.packaged && options.target.os === "windows", preferences: options.preferences() };
  }
  getState = () => ({ ...this.state, preferences: this.options.preferences() });
  private update(value: Partial<UpdateState>) {
    this.state = { ...this.state, ...value, preferences: this.options.preferences() };
    this.options.emit(this.getState());
    return this.getState();
  }
  start() {
    this.startup = setTimeout(() => { if (this.options.preferences().autoCheck) void this.check(); }, 5_000);
    this.startup.unref();
    this.timer = setInterval(() => { if (this.options.preferences().autoCheck) void this.check(); }, 6 * 60 * 60_000);
    this.timer.unref();
  }
  dispose() { clearTimeout(this.startup); clearInterval(this.timer); this.abort?.abort(); }
  setPreferences = async (value: UpdatePreferences) => {
    if (typeof value?.autoCheck !== "boolean" || typeof value?.autoDownload !== "boolean") throw new Error("Invalid preferences");
    this.options.savePreferences(value);
    this.update({});
    if (value.autoDownload && this.state.status === "available" && this.state.canInstall && this.state.release?.asset?.sha256) void this.download();
    return this.getState();
  };
  check = (): Promise<UpdateState> => {
    if (this.pending || this.state.status === "installing") return this.pending || Promise.resolve(this.getState());
    if (this.downloaded) return Promise.resolve(this.getState());
    this.update({ status: "checking", error: undefined });
    this.pending = (async () => {
      try {
        const release = await fetchRelease(this.options.target);
        const newer = release && compareVersions(release.version, this.state.installed) > 0;
        return this.update({ release, status: newer ? "available" : "current" });
      } catch { return this.update({ status: "error", error: "network" }); }
    })().finally(() => {
      this.pending = undefined;
      if (this.state.status === "available" && this.state.canInstall && this.state.release?.asset?.sha256 && this.options.preferences().autoDownload) void this.download();
    });
    return this.pending;
  };
  download = (): Promise<UpdateState> => {
    if (this.pending || this.state.status === "installing") return this.pending || Promise.resolve(this.getState());
    if (this.downloaded) return Promise.resolve(this.getState());
    const asset = this.state.release?.asset;
    if (!asset || !this.state.release || compareVersions(this.state.release.version, this.state.installed) <= 0) return Promise.resolve(this.getState());
    if (!this.state.canInstall || !asset.sha256) return this.options.openExternal(asset.url).then(() => this.getState()).catch(() => this.update({ status: "error", error: "download" }));
    this.update({ status: "downloading", error: undefined, progress: 0 });
    this.abort = new AbortController();
    const signal = AbortSignal.any([this.abort.signal, AbortSignal.timeout(30 * 60_000)]);
    const destination = path.join(this.options.directory, `harness-${this.state.release.version}-${this.options.target.arch}.exe`);
    const temporary = destination + ".partial";
    this.pending = (async () => {
      try {
        await fs.mkdir(this.options.directory, { recursive: true, mode: 0o700 });
        // Reuse a verified download after an app restart instead of downloading twice.
        try {
          const stat = await fs.stat(destination);
          if (stat.isFile() && stat.size === asset.size) {
            const cachedHash = createHash("sha256");
            for await (const chunk of createReadStream(destination)) cachedHash.update(chunk);
            if (cachedHash.digest("hex") === asset.sha256) {
              this.downloaded = destination;
              return this.update({ status: "ready", progress: 100 });
            }
          }
        } catch { /* A missing or invalid cached installer is downloaded again. */ }
        await fs.rm(temporary, { force: true });
        const response = await fetch(asset.url, { signal });
        if (!response.ok || !response.body) throw new Error("download");
        const hash = createHash("sha256");
        let bytes = 0, previous = 0;
        const progress = new Transform({ transform: (chunk: Buffer, _encoding, callback) => {
          bytes += chunk.length;
          if (bytes > asset.size) { callback(new Error("verification")); return; }
          hash.update(chunk);
          const percent = Math.floor(bytes * 100 / asset.size);
          if (percent !== previous) { previous = percent; this.update({ progress: percent }); }
          callback(null, chunk);
        } });
        await pipeline(Readable.fromWeb(response.body as any), progress, createWriteStream(temporary, { flags: "wx", mode: 0o600 }), { signal });
        if (bytes !== asset.size || hash.digest("hex") !== asset.sha256) throw new Error("verification");
        await fs.rename(temporary, destination);
        this.downloaded = destination;
        return this.update({ status: "ready", progress: 100 });
      } catch (error) {
        await fs.rm(temporary, { force: true }).catch(() => {});
        return this.update({ status: "error", error: error instanceof Error && error.message === "verification" ? "verification" : "download" });
      }
    })().finally(() => { this.pending = undefined; this.abort = undefined; });
    return this.pending;
  };
  install = (): Promise<UpdateState> => {
    if (this.pending) return this.pending;
    if (!this.downloaded || !this.state.canInstall || this.state.status === "installing") return Promise.resolve(this.getState());
    if (this.options.busy()) return Promise.resolve(this.update({ status: "error", error: "busy" }));
    const installer = this.downloaded;
    this.update({ status: "installing", error: undefined });
    this.pending = (async () => {
      try {
        const hash = createHash("sha256");
        for await (const chunk of createReadStream(installer)) hash.update(chunk);
        if (hash.digest("hex") !== this.state.release?.asset?.sha256) throw new Error("verification");
        if (this.options.busy()) return this.update({ status: "error", error: "busy" });
        if (await this.options.openInstaller(installer)) throw new Error("installation");
        this.options.quit();
        return this.getState();
      } catch (error) {
        const installation = error instanceof Error && error.message === "installation";
        if (!installation) this.downloaded = undefined;
        return this.update({ status: "error", error: installation ? "installation" : "verification" });
      }
    })().finally(() => { this.pending = undefined; });
    return this.pending;
  };
}
