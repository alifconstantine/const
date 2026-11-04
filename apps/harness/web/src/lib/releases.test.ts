import assert from "node:assert/strict";
import { test } from "node:test";
import { selectPublishedBuilds } from "./releases";

const asset = (id: number, tag: string, name: string) => ({
  id,
  name,
  size: 100_000_000,
  browser_download_url: `https://github.com/alifconstantine/const/releases/download/${tag}/${encodeURIComponent(name)}`,
});
const release = (version: string, names: string[], extra = {}) => {
  const tag = `harness-v${version}`;
  return {
    tag_name: tag,
    assets: names.map((name, i) => asset(i + 1, tag, name)),
    ...extra,
  };
};

test("selects numeric latest Windows assets and independently published APKs", () => {
  const builds = selectPublishedBuilds([
    release("0.0.2", [
      "Const Harness Setup 0.0.2-x64.exe",
      "Const Harness 0.0.2.apk",
    ]),
    release("0.0.10", [
      "Const Harness Setup 0.0.10-x64.exe",
      "Const Harness Setup 0.0.10-arm64.exe",
    ]),
    release("0.0.9", ["Const Harness Setup 0.0.9-x64.exe"]),
  ]);
  assert.deepEqual(
    builds.map(({ os, arch, version }) => ({ os, arch, version })),
    [
      { os: "windows", arch: "x64", version: "0.0.10" },
      { os: "windows", arch: "arm64", version: "0.0.10" },
      { os: "android", arch: "universal", version: "0.0.2" },
    ],
  );
  for (const build of builds) {
    const url = new URL(build.url);
    assert.equal(url.origin, "https://harness.const.web.id");
    assert.equal(url.pathname, "/api/app-updates/download");
    assert.equal(url.searchParams.get("tag"), `harness-v${build.version}`);
  }
});

test("does not invent assets or expose upcoming, debug, unsigned, or unrelated releases", () => {
  assert.deepEqual(
    selectPublishedBuilds([
      release("0.0.2", [
        "Const Harness 0.0.2-arm64.dmg",
        "Const Harness 0.0.2-x64.AppImage",
      ]),
      release("0.0.3", [
        "Const Harness debug.apk",
        "Const Harness unsigned.apk",
      ]),
      release("0.0.4", ["Const Harness 0.0.4.apk"], { draft: true }),
      release("0.0.5", ["Const Harness 0.0.5.apk"], { prerelease: true }),
      release("0.0.6", ["Const Harness 0.0.6.apk"], {
        tag_name: "learn-v0.0.6",
      }),
    ]),
    [],
  );
});

test("rejects invalid asset identifiers and foreign URLs without hiding other valid builds", () => {
  const invalid = release("0.0.10", ["Const Harness Setup 0.0.10-x64.exe"]);
  invalid.assets[0]!.id = 0;
  const foreign = release("0.0.11", ["Const Harness 0.0.11.apk"]);
  foreign.assets[0]!.browser_download_url = "https://example.com/installer.apk";
  const builds = selectPublishedBuilds([
    null,
    invalid,
    foreign,
    release("0.0.2", ["Const Harness Setup 0.0.2-x64.exe"]),
  ]);
  assert.equal(builds.length, 1);
  assert.equal(builds[0]!.version, "0.0.2");
  assert.throws(() => selectPublishedBuilds({}), /Invalid release catalog/);
});

test("published legacy Harness tag keeps its exact download URL and numeric version", () => {
  const legacy = release("0.0.2", ["Const.Harness.Setup.0.0.2-x64.exe", "Const-Harness-0.0.2-android.apk"]);
  legacy.tag_name = "harness-v.0.0.2";
  legacy.assets = legacy.assets.map(entry => ({ ...entry, browser_download_url: entry.browser_download_url.replace("harness-v0.0.2", legacy.tag_name) }));
  const builds = selectPublishedBuilds([legacy]);
  assert.equal(builds.length, 2);
  assert.ok(builds.every(build => build.version === "0.0.2" && new URL(build.url).searchParams.get("tag") === legacy.tag_name));
});
