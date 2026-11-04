import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DesktopAppUpdates } from "./app-updates";
import { compareVersions, fetchRelease, isReleaseAssetUrl, releaseVersion, selectRelease, RELEASES_API, updateDownloadUrl, type UpdatePreferences } from "../../shared/updates/releases";
import { updateFeed, updateDownload } from "../../web/src/lib/app-updates";

const bytes = new TextEncoder().encode("test-only installer, never executed");
const sha = createHash("sha256").update(bytes).digest("hex");
const release = (version = "0.0.3", overrides = {}) => ({ tag_name: `harness-v${version}`, published_at: "2026-11-02T09:00:00Z", body: "## Fixes\n- Isolated workspace previews.",
  assets: ["x64", "arm64"].map((arch, index) => ({ id: index + 42, name: `Const.Harness.Setup.${version}-${arch}.exe`, browser_download_url: `https://github.com/alifconstantine/const/releases/download/harness-v${version}/Const.Harness.Setup.${version}-${arch}.exe`, size: bytes.length, digest: `sha256:${sha}` })), ...overrides });

test("release selection isolates Harness, stable versions, architecture and trusted assets", () => {
  const data = [release("99.0.0", { tag_name: "v99.0.0" }), release("9.0.0", { draft: true }), release("8.0.0", { prerelease: true }), release("0.0.9"), release("0.0.10")];
  const selected = selectRelease(data, { os: "windows", arch: "arm64" });
  assert.equal(selected?.version, "0.0.10");
  assert.ok(selected?.asset?.name.endsWith("-arm64.exe"));
  assert.equal(selectRelease(data, { os: "android" })?.asset, undefined);
  assert.equal(compareVersions("0.0.2", "0.0.10"), -1);
  assert.equal(isReleaseAssetUrl("https://evil.test/update.exe", "harness-v0.0.3", "update.exe"), false);
  assert.equal(isReleaseAssetUrl("https://user:secret@github.com/alifconstantine/const/releases/download/harness-v0.0.3/update.exe", "harness-v0.0.3", "update.exe"), false);
  assert.equal(isReleaseAssetUrl("https://github.com/alifconstantine/const/releases/download/harness-v0.0.3/../update.exe", "harness-v0.0.3", "update.exe"), false);
  assert.equal(selectRelease([release("0.0.3", { assets: [{ name: "update.exe", browser_download_url: "javascript:alert(1)", size: 10 }] })], { os: "windows", arch: "x64" })?.asset, undefined);
});

test("published legacy 0.0.2 tag survives selection, public feed, client validation and download relay", async t => {
  const legacy = release("0.0.2");
  legacy.tag_name = "harness-v.0.0.2";
  legacy.assets = legacy.assets.map(asset => ({ ...asset, browser_download_url: asset.browser_download_url.replace("harness-v0.0.2", legacy.tag_name) }));
  assert.equal(releaseVersion(legacy.tag_name), "0.0.2");
  for (const invalid of ["harness-v.0.0.3", "harness-v..0.0.2", "v0.0.2", "harness-v.0.0.2-beta"]) assert.equal(releaseVersion(invalid), undefined);
  assert.equal(selectRelease([legacy], { os: "windows", arch: "x64" })?.asset?.name, legacy.assets[0]!.name);
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = (async input => updateFeed(new Request(String(input)), { fetcher: (async () => Response.json([legacy])) as typeof fetch })) as typeof fetch;
  const selected = await fetchRelease({ os: "windows", arch: "x64" });
  assert.equal(selected?.tag, legacy.tag_name);
  assert.equal(selected?.asset?.url, updateDownloadUrl(42, legacy.tag_name));
  const download = await updateDownload(new Request(selected!.asset!.url), { fetcher: (async input => String(input).includes("/assets/") ? new Response(null, { status: 302, headers: { Location: "https://release-assets.githubusercontent.com/legacy-installer" } }) : Response.json([legacy])) as typeof fetch });
  assert.equal(download.status, 302);
});

async function fixture(t: TestContext, corrupt = false, installed = "0.0.2") {
  const original = globalThis.fetch;
  let checks = 0, downloads = 0, installs = 0, quits = 0, busy = false;
  let preferences: UpdatePreferences = { autoCheck: false, autoDownload: false };
  const directory = await mkdtemp(path.join(os.tmpdir(), "const-update-test-"));
  globalThis.fetch = (async input => {
    if (String(input).startsWith(RELEASES_API + "?")) {
      checks++;
      const selected = selectRelease([release()], { os: "windows", arch: "x64" })!;
      selected.asset!.url = updateDownloadUrl(42, selected.tag);
      return Response.json({ release: selected });
    }
    downloads++; return new Response(corrupt ? new Uint8Array(bytes.length) : bytes);
  }) as typeof fetch;
  const service = new DesktopAppUpdates({ version: installed, target: { os: "windows", arch: "x64" }, packaged: true, directory,
    preferences: () => preferences, savePreferences: next => { preferences = next; }, emit: () => {}, busy: () => busy,
    openExternal: async () => {}, openInstaller: async () => { installs++; return ""; }, quit: () => { quits++; } });
  t.after(async () => { service.dispose(); globalThis.fetch = original; assert.ok(path.basename(directory).startsWith("const-update-test-")); await rm(directory, { force: true, recursive: true }); });
  return { service, directory, setBusy: (value: boolean) => { busy = value; }, counts: () => ({ checks, downloads, installs, quits }) };
}

test("checks and downloads deduplicate; verified installs wait for running tasks", async t => {
  const f = await fixture(t);
  const first = f.service.check(), second = f.service.check();
  assert.equal(first, second);
  assert.equal((await first).status, "available");
  await Promise.all([f.service.download(), f.service.download()]);
  assert.equal(f.service.getState().status, "ready");
  f.setBusy(true);
  assert.equal((await f.service.install()).error, "busy");
  assert.equal(f.counts().installs, 0);
  f.setBusy(false);
  await Promise.all([f.service.install(), f.service.install()]);
  await f.service.install();
  assert.deepEqual(f.counts(), { checks: 1, downloads: 1, installs: 1, quits: 1 });
});

test("corrupted downloads never become installable", async t => {
  const f = await fixture(t, true);
  await f.service.check();
  assert.equal((await f.service.download()).error, "verification");
  await f.service.install();
  assert.equal(f.counts().installs, 0);
});

test("installer digest is rechecked immediately before launching", async t => {
  const f = await fixture(t);
  await f.service.check(); await f.service.download();
  await writeFile(path.join(f.directory, "harness-0.0.3-x64.exe"), "changed after download");
  assert.equal((await f.service.install()).error, "verification");
  assert.equal(f.counts().installs, 0);
});

test("automatic downloads honor preferences", async t => {
  const f = await fixture(t);
  await f.service.check();
  assert.equal(f.counts().downloads, 0);
  await f.service.setPreferences({ autoCheck: false, autoDownload: true });
  // Join the single download started by the preference change.
  await f.service.download();
  assert.equal(f.service.getState().status, "ready");
  assert.equal(f.counts().downloads, 1);
  assert.equal(f.service.getState().preferences.autoCheck, false);
});

test("older releases are never downloaded or installed", async t => {
  const f = await fixture(t, false, "0.0.4");
  await f.service.setPreferences({ autoCheck: true, autoDownload: true });
  assert.equal((await f.service.check()).status, "current");
  await f.service.download(); await f.service.install();
  assert.deepEqual(f.counts(), { checks: 1, downloads: 0, installs: 0, quits: 0 });
});

test("public feed uses server authentication without exposing GitHub credentials or private download URLs", async () => {
  const requests: RequestInit[] = [];
  const fetcher = (async (_input, init) => { requests.push(init || {}); return Response.json([release()]); }) as typeof fetch;
  const response = await updateFeed(new Request(`${RELEASES_API}?os=windows&arch=x64`), { token: "server-only-test-token", fetcher });
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.ok(!text.includes("server-only-test-token") && !text.includes("github.com"));
  assert.equal((requests[0]!.headers as Record<string, string>).Authorization, "Bearer server-only-test-token");
  assert.equal(JSON.parse(text).release.asset.url, updateDownloadUrl(42, "harness-v0.0.3"));
});

test("download relay only publishes approved installers and short-lived trusted asset redirects", async () => {
  let calls = 0;
  const fetcher = (async (_input, init) => {
    calls++;
    assert.equal((init!.headers as Record<string, string>).Authorization, "Bearer server-only-test-token");
    return calls % 2 === 1 ? Response.json([release()]) : new Response(null, { status: 302, headers: { Location: "https://release-assets.githubusercontent.com/test-installer?signature=temporary" } });
  }) as typeof fetch;
  const response = await updateDownload(new Request(updateDownloadUrl(42, "harness-v0.0.3")), { token: "server-only-test-token", fetcher });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("authorization"), null);
  assert.equal(response.headers.get("location"), "https://release-assets.githubusercontent.com/test-installer?signature=temporary");
  const denied = await updateDownload(new Request(updateDownloadUrl(999, "harness-v0.0.3")), { fetcher: (async () => Response.json([release()])) as typeof fetch });
  assert.equal(denied.status, 404);
  const malicious = await updateDownload(new Request(updateDownloadUrl(42, "harness-v0.0.3")), { fetcher: (async input => String(input).includes("/assets/") ? new Response(null, { status: 302, headers: { Location: "https://evil.test/payload" } }) : Response.json([release()])) as typeof fetch });
  assert.equal(malicious.status, 502);
});
