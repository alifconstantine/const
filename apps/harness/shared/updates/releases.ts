export const GITHUB_RELEASES_API = "https://api.github.com/repos/alifconstantine/const/releases?per_page=100";
export const UPDATE_ORIGIN = "https://harness.const.web.id";
export const RELEASES_API = `${UPDATE_ORIGIN}/api/app-updates`;
export interface ReleaseAsset { name: string; url: string; size: number; sha256?: string }
export interface AppRelease { version: string; tag: string; date: string; notes: string; asset?: ReleaseAsset }
export interface UpdateTarget { os: "windows" | "android" | "macos" | "linux"; arch?: string }
export interface UpdatePreferences { autoCheck: boolean; autoDownload: boolean }
export interface UpdateState {
  installed: string;
  status: "idle" | "checking" | "current" | "available" | "downloading" | "ready" | "installing" | "error";
  release?: AppRelease;
  progress?: number;
  error?: "network" | "download" | "verification" | "busy" | "permission" | "unsupported" | "installation";
  canInstall: boolean;
  preferences: UpdatePreferences;
}
export interface UpdateClient {
  getState(): Promise<UpdateState>;
  check(): Promise<UpdateState>;
  download(): Promise<UpdateState>;
  install(): Promise<UpdateState>;
  setPreferences(value: UpdatePreferences): Promise<UpdateState>;
  subscribe(listener: (state: UpdateState) => void): () => void;
}
export function compareVersions(a: string, b: string): number {
  const parse = (value: string) => /^(\d{1,9})\.(\d{1,9})\.(\d{1,9})$/.test(value) ? value.split(".").map(Number) : null;
  const av = parse(a), bv = parse(b);
  if (!av || !bv) return 0;
  for (let i = 0; i < 3; i++) if (av[i] !== bv[i]) return av[i]! > bv[i]! ? 1 : -1;
  return 0;
}
export function isReleaseAssetUrl(value: string, tag: string, name: string): boolean {
  try {
    const url = new URL(value);
    return /^harness-v\d+\.\d+\.\d+$/.test(tag) && !/[\\/]/.test(name)
      && url.origin === "https://github.com" && !url.search && !url.hash && !url.username && !url.password
      && decodeURIComponent(url.pathname) === `/alifconstantine/const/releases/download/${tag}/${name}`;
  } catch { return false; }
}
/** GitHub is shared with Const Learn: only stable Harness releases are eligible. */
export function selectRelease(data: unknown, target: UpdateTarget): AppRelease | undefined {
  if (!Array.isArray(data)) throw new Error("Invalid release response");
  const candidates: AppRelease[] = [];
  for (const item of data) {
    if (!item || item.draft || item.prerelease || typeof item.tag_name !== "string") continue;
    const match = /^harness-v(\d{1,9}\.\d{1,9}\.\d{1,9})$/.exec(item.tag_name);
    if (!match || !Array.isArray(item.assets)) continue;
    const asset = item.assets.find((entry: any) => {
      if (!entry || typeof entry.name !== "string" || !/harness/i.test(entry.name) || /debug|unsigned/i.test(entry.name)
        || typeof entry.browser_download_url !== "string" || !isReleaseAssetUrl(entry.browser_download_url, item.tag_name, entry.name)
        || !Number.isSafeInteger(entry.size) || entry.size <= 0) return false;
      if (target.os === "android") return /\.apk$/i.test(entry.name);
      if (target.arch !== "x64" && target.arch !== "arm64") return false;
      const extension = target.os === "windows" ? /\.exe$/i : target.os === "macos" ? /\.(dmg|pkg)$/i : /\.(AppImage|deb|rpm|pacman)$/i;
      return extension.test(entry.name) && new RegExp(`[-._]${target.arch === "arm64" ? "(?:arm64|aarch64)" : "(?:x64|x86_64|amd64)"}[.-]`, "i").test(entry.name);
    });
    candidates.push({ version: match[1]!, tag: item.tag_name, date: typeof item.published_at === "string" ? item.published_at : "",
      notes: typeof item.body === "string" ? item.body.slice(0, 60_000) : "",
      asset: asset ? { name: asset.name, url: asset.browser_download_url, size: asset.size,
        sha256: typeof asset.digest === "string" && /^sha256:[a-f0-9]{64}$/i.test(asset.digest) ? asset.digest.slice(7).toLowerCase() : undefined } : undefined });
  }
  return candidates.sort((a, b) => compareVersions(b.version, a.version))[0];
}
export async function fetchRelease(target: UpdateTarget, signal?: AbortSignal): Promise<AppRelease | undefined> {
  const url = new URL(RELEASES_API);
  url.searchParams.set("os", target.os);
  if (target.arch) url.searchParams.set("arch", target.arch);
  const response = await fetch(url.toString(), { signal: signal ?? AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Release check failed (${response.status})`);
  const data = await response.json();
  if (!data.release) return undefined;
  const item = data.release;
  if (typeof item.version !== "string" || !/^\d{1,9}\.\d{1,9}\.\d{1,9}$/.test(item.version) || item.tag !== `harness-v${item.version}` || typeof item.notes !== "string") throw new Error("Invalid update feed");
  let asset: ReleaseAsset | undefined;
  if (item.asset) {
    const file = item.asset;
    const download = new URL(file.url);
    if (download.origin !== UPDATE_ORIGIN || download.pathname !== "/api/app-updates/download" || download.username || download.password || download.hash
      || !/^\d{1,16}$/.test(download.searchParams.get("asset") || "") || download.searchParams.get("tag") !== item.tag
      || typeof file.name !== "string" || /[\\/]/.test(file.name) || !Number.isSafeInteger(file.size) || file.size <= 0) throw new Error("Invalid download URL");
    asset = { name: file.name, url: file.url, size: file.size, sha256: typeof file.sha256 === "string" && /^[a-f0-9]{64}$/.test(file.sha256) ? file.sha256 : undefined };
  }
  return { version: item.version, tag: item.tag, notes: item.notes.slice(0, 60_000), date: typeof item.date === "string" ? item.date : "", asset };
}

export function updateDownloadUrl(assetId: number, tag: string) {
  return `${RELEASES_API}/download?asset=${assetId}&tag=${encodeURIComponent(tag)}`;
}
