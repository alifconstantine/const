export interface DesktopBuild {
  name: string;
  url: string;
  os: string;
  arch: string;
}

export async function getDesktopBuilds(): Promise<{
  builds: DesktopBuild[];
  available: boolean;
}> {
  try {
    const response = await fetch(
      "https://api.github.com/repos/alifconstantine/const/releases?per_page=10",
      {
        headers: { Accept: "application/vnd.github+json" },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) return { builds: [], available: false };
    const releases = await response.json();
    if (!Array.isArray(releases)) return { builds: [], available: false };
    const builds: DesktopBuild[] = [];
    const seen = new Set<string>();
    for (const release of releases) {
      if (release.draft || release.prerelease || !Array.isArray(release.assets))
        continue;
      for (const asset of release.assets) {
        if (
          typeof asset.name !== "string" ||
          typeof asset.browser_download_url !== "string"
        )
          continue;
        const name = asset.name;
        if (
          !/harness/i.test(name) ||
          !/\.(exe|dmg|AppImage|deb|rpm|pkg|pacman|tar\.xz)$/i.test(name)
        )
          continue;
        if (
          !asset.browser_download_url.startsWith(
            "https://github.com/alifconstantine/const/releases/download/",
          )
        )
          continue;
        const os = /\.(exe)$/i.test(name)
          ? "windows"
          : /\.(dmg|pkg)$/i.test(name)
            ? "macos"
            : "linux";
        const arch = /arm64|aarch64/i.test(name)
          ? "arm64"
          : /x64|x86_64|amd64/i.test(name)
            ? "x64"
            : /universal/i.test(name)
              ? "universal"
              : "unknown";
        const key = `${os}:${arch}:${name.split(".").pop()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        builds.push({ name, url: asset.browser_download_url, os, arch });
      }
    }
    return { builds, available: true };
  } catch {
    // An unavailable release API must not produce guessed or broken download URLs.
    return { builds: [], available: false };
  }
}
