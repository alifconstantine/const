import { githubHeaders } from "./app-updates";
import {
  GITHUB_RELEASES_API,
  compareVersions,
  selectRelease,
  updateDownloadUrl,
  type UpdateTarget,
} from "../../../shared/updates/releases";

export interface PublishedBuild {
  name: string;
  url: string;
  os: "windows" | "android";
  arch: "x64" | "arm64" | "universal";
  version: string;
  size: number;
}

/** Desktop and APK releases can ship independently; select a real asset per target. */
export function selectPublishedBuilds(data: unknown): PublishedBuild[] {
  if (!Array.isArray(data)) throw new Error("Invalid release catalog");
  const targets: UpdateTarget[] = [
    { os: "windows", arch: "x64" },
    { os: "windows", arch: "arm64" },
    { os: "android" },
  ];
  return targets.flatMap((target) => {
    const candidates = data.flatMap((item) => {
      const release = selectRelease([item], target);
      if (!release?.asset) return [];
      const asset = item.assets.find(
        (entry: { name?: string }) => entry?.name === release.asset!.name,
      );
      if (!Number.isSafeInteger(asset?.id) || asset.id <= 0) return [];
      return [
        {
          name: release.asset.name,
          url: updateDownloadUrl(asset.id, release.tag),
          os: target.os as PublishedBuild["os"],
          arch: (target.arch || "universal") as PublishedBuild["arch"],
          version: release.version,
          size: release.asset.size,
        },
      ];
    });
    return candidates
      .sort((a, b) => compareVersions(b.version, a.version))
      .slice(0, 1);
  });
}

export async function getPublishedBuilds(): Promise<{
  builds: PublishedBuild[];
  available: boolean;
}> {
  try {
    const response = await fetch(GITHUB_RELEASES_API, {
      headers: githubHeaders(process.env.HARNESS_RELEASES_TOKEN),
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { builds: [], available: false };
    return {
      builds: selectPublishedBuilds(await response.json()),
      available: true,
    };
  } catch {
    return { builds: [], available: false };
  }
}
