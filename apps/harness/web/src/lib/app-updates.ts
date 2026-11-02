import { GITHUB_RELEASES_API, isReleaseAssetUrl, selectRelease, updateDownloadUrl, type UpdateTarget } from "../../../shared/updates/releases";

export const updateCors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
interface Options { token?: string; fetcher?: typeof fetch }
export function githubHeaders(token?: string, accept = "application/vnd.github+json") {
  return { Accept: accept, "User-Agent": "Const-Harness-Updates", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
async function catalog(options: Options): Promise<any[]> {
  const init: RequestInit & { next: { revalidate: number } } = { headers: githubHeaders(options.token), signal: AbortSignal.timeout(15_000), next: { revalidate: 300 } };
  const response = await (options.fetcher || fetch)(GITHUB_RELEASES_API, init);
  if (!response.ok) throw new Error("UPDATES_UNAVAILABLE");
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error("UPDATES_UNAVAILABLE");
  return data;
}
const failure = (status = 502) => Response.json({ error: "UPDATES_UNAVAILABLE" }, { status, headers: { ...updateCors, "Cache-Control": "no-store" } });

/** Only release notes and installer metadata are public, never repository credentials. */
export async function updateFeed(request: Request, options: Options = {}) {
  const query = new URL(request.url).searchParams;
  const os = query.get("os"), arch = query.get("arch");
  if (!["windows", "android", "macos", "linux"].includes(os || "") || (os !== "android" && arch !== "x64" && arch !== "arm64")) return failure(400);
  try {
    const data = await catalog(options);
    const release = selectRelease(data, { os, arch: arch || undefined } as UpdateTarget);
    if (release?.asset) {
      const published = data.find(item => item.tag_name === release.tag);
      const asset = published.assets.find((item: any) => item.name === release.asset!.name);
      if (!Number.isSafeInteger(asset?.id) || asset.id <= 0) delete release.asset;
      else release.asset.url = updateDownloadUrl(asset.id, release.tag);
    }
    return Response.json({ release: release || null }, { headers: { ...updateCors, "Cache-Control": "public, max-age=60, s-maxage=300" } });
  } catch { return failure(); }
}

/** Users explicitly permit public installers even when the source repo is private. */
export async function updateDownload(request: Request, options: Options = {}) {
  const query = new URL(request.url).searchParams;
  const id = query.get("asset") || "", tag = query.get("tag") || "";
  if (!/^\d{1,16}$/.test(id) || !Number.isSafeInteger(Number(id)) || !/^harness-v\d{1,9}\.\d{1,9}\.\d{1,9}$/.test(tag)) return failure(400);
  try {
    const data = await catalog(options);
    const release = data.find(item => item.tag_name === tag && !item.draft && !item.prerelease);
    const asset = release?.assets?.find((item: any) => item.id === Number(id));
    if (!asset || typeof asset.name !== "string" || !/harness/i.test(asset.name) || /debug|unsigned/i.test(asset.name)
      || !/\.(exe|apk|dmg|pkg|AppImage|deb|rpm|pacman)$/i.test(asset.name)
      || !isReleaseAssetUrl(asset.browser_download_url, tag, asset.name)) return failure(404);
    const response = await (options.fetcher || fetch)(`https://api.github.com/repos/alifconstantine/const/releases/assets/${id}`, {
      headers: githubHeaders(options.token, "application/octet-stream"), redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(20_000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) return failure();
      const signed = new URL(location);
      if (signed.protocol !== "https:" || signed.username || signed.password || !["release-assets.githubusercontent.com", "objects.githubusercontent.com"].includes(signed.hostname)) return failure();
      // Redirect to a short-lived asset URL, keeping large binaries off serverless buffers.
      return new Response(null, { status: 302, headers: { ...updateCors, Location: signed.toString(), "Cache-Control": "no-store" } });
    }
    if (!response.ok || !response.body || response.headers.get("content-type")?.includes("application/json")) return failure();
    return new Response(response.body, { headers: { ...updateCors, "Cache-Control": "no-store", "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${asset.name.replace(/[^a-zA-Z0-9._ ()-]/g, "_")}"` } });
  } catch { return failure(); }
}
