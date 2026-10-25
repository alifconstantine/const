import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { parse } from "yaml";
import type { SkillInstallProgress } from "../src/lib/skills/types";

type Fetcher = typeof fetch;
type TreeFile = { path: string; type: string; mode: string; size?: number };
export interface ResolvedRemoteSkill {
  source: string;
  skillId: string;
  sourceId: string;
  revision: string;
  directory: string;
  content: string;
  files: TreeFile[];
}
export interface SkillSource {
  sourceId: string;
  source: string;
  sourceSkillId: string;
  revision: string;
}
const metadataFile = ".const-source.json";
const maxBytes = 25 * 1024 * 1024;
const maxFileBytes = 10 * 1024 * 1024;

export function installError(code: string): Error {
  return new Error(`SKILL_INSTALL_${code.toUpperCase()}`);
}

export function validateSkill(content: string): {
  name: string;
  description: string;
} {
  try {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    const meta = match ? parse(match[1]!) : null;
    if (
      typeof meta?.name !== "string" ||
      !meta.name.trim() ||
      typeof meta?.description !== "string" ||
      !meta.description.trim()
    )
      throw installError("invalid");
    return { name: meta.name.trim(), description: meta.description.trim() };
  } catch {
    throw installError("invalid");
  }
}

export function safeRelative(file: string): string {
  if (
    !file ||
    file.includes("\\") ||
    file
      .split("/")
      .some(
        (part) =>
          !part ||
          part === "." ||
          part === ".." ||
          /[<>:"|?*\x00-\x1f]/.test(part) ||
          /[. ]$/.test(part) ||
          /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
      )
  )
    throw installError("invalid");
  return file;
}

async function request(
  url: string,
  signal?: AbortSignal,
  fetcher: Fetcher = fetch,
): Promise<Response> {
  signal?.throwIfAborted();
  try {
    const response = await fetcher(url, {
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
        : AbortSignal.timeout(20000),
      headers: {
        "User-Agent": "Const-Desktop-Harness",
        Accept: "application/json",
      },
    });
    if (!response.ok)
      throw installError(
        response.status === 403 || response.status === 429
          ? "rate_limit"
          : "download",
      );
    return response;
  } catch (error) {
    if (signal?.aborted) throw installError("cancelled");
    if (error instanceof Error && error.message.startsWith("SKILL_INSTALL_"))
      throw error;
    throw installError("download");
  }
}

async function readBytes(
  response: Response,
  limit: number,
  signal?: AbortSignal,
): Promise<Buffer> {
  if (Number(response.headers.get("content-length")) > limit)
    throw installError("too_large");
  const reader = response.body?.getReader();
  if (!reader) throw installError("download");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw installError("too_large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks);
}

function rawUrl(source: string, revision: string, file: string): string {
  return `https://raw.githubusercontent.com/${source}/${revision}/${file.split("/").map(encodeURIComponent).join("/")}`;
}

/** Resolve an exact skill against one immutable Git revision. No path guessing. */
export async function resolveRemoteSkill(
  source: string,
  skillId: string,
  signal?: AbortSignal,
  fetcher: Fetcher = fetch,
): Promise<ResolvedRemoteSkill> {
  if (
    !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(source) ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skillId)
  )
    throw installError("invalid");
  const repo = (await (
    await request(`https://api.github.com/repos/${source}`, signal, fetcher)
  ).json()) as { default_branch: string };
  const commit = (await (
    await request(
      `https://api.github.com/repos/${source}/commits/${encodeURIComponent(repo.default_branch)}`,
      signal,
      fetcher,
    )
  ).json()) as { sha: string };
  if (!commit.sha) throw installError("invalid");
  const tree = (await (
    await request(
      `https://api.github.com/repos/${source}/git/trees/${commit.sha}?recursive=1`,
      signal,
      fetcher,
    )
  ).json()) as { sha: string; truncated: boolean; tree: TreeFile[] };
  if (tree.truncated || !tree.sha || !Array.isArray(tree.tree))
    throw installError("too_large");
  const candidates = tree.tree.filter(
    (file) =>
      file.type === "blob" &&
      (file.path === "SKILL.md" || file.path.endsWith("/SKILL.md")),
  );
  const exact = candidates.filter(
    (file) => path.posix.basename(path.posix.dirname(file.path)) === skillId,
  );
  let target = exact.length === 1 ? exact[0] : undefined;
  // A root skill must identify itself; a single unrelated skill is never selected.
  if (!target && exact.length === 0) {
    const root = candidates.find((file) => file.path === "SKILL.md");
    if (root) {
      const content = (
        await readBytes(
          await request(rawUrl(source, commit.sha, root.path), signal, fetcher),
          maxFileBytes,
          signal,
        )
      ).toString("utf8");
      if (validateSkill(content).name === skillId) target = root;
    }
  }
  if (!target) throw installError("not_found");
  const directory =
    path.posix.dirname(target.path) === "."
      ? ""
      : path.posix.dirname(target.path);
  const prefix = directory ? `${directory}/` : "";
  const files = tree.tree.filter(
    (file) => file.type === "blob" && file.path.startsWith(prefix),
  );
  if (
    !files.length ||
    files.length > 1000 ||
    files.reduce((sum, file) => sum + (file.size ?? 0), 0) > maxBytes
  )
    throw installError("too_large");
  const names = new Set<string>();
  for (const file of files) {
    const relative = safeRelative(file.path.slice(prefix.length));
    if (
      relative === metadataFile ||
      names.has(relative.toLowerCase()) ||
      !["100644", "100755"].includes(file.mode)
    )
      throw installError("invalid");
    names.add(relative.toLowerCase());
  }
  const content = (
    await readBytes(
      await request(rawUrl(source, commit.sha, target.path), signal, fetcher),
      maxFileBytes,
      signal,
    )
  ).toString("utf8");
  validateSkill(content);
  return {
    source,
    skillId,
    sourceId: `${source}/${skillId}`.toLowerCase(),
    revision: commit.sha,
    directory,
    content,
    files,
  };
}

export async function readSkillSource(
  directory: string,
): Promise<SkillSource | undefined> {
  try {
    return JSON.parse(
      await fs.readFile(path.join(directory, metadataFile), "utf8"),
    ) as SkillSource;
  } catch {
    return undefined;
  }
}

/** Download to a sibling staging directory, then publish only a complete package. */
export async function installRemoteSkill(
  skill: ResolvedRemoteSkill,
  parent: string,
  report: (progress: Omit<SkillInstallProgress, "requestId">) => void,
  signal?: AbortSignal,
  fetcher: Fetcher = fetch,
): Promise<string> {
  await fs.mkdir(parent, { recursive: true });
  let destination = path.join(parent, skill.skillId);
  const existing = await fs.lstat(destination).catch(() => null);
  if (existing) {
    const installed = await readSkillSource(destination);
    if (installed?.sourceId === skill.sourceId) return destination;
    destination = path.join(
      parent,
      `${skill.skillId}-${createHash("sha256").update(skill.sourceId).digest("hex").slice(0, 8)}`,
    );
    if (await fs.lstat(destination).catch(() => null)) {
      if ((await readSkillSource(destination))?.sourceId === skill.sourceId)
        return destination;
      throw installError("conflict");
    }
  }
  const staging = await fs.mkdtemp(path.join(parent, ".install-"));
  let completed = 0;
  let bytes = 0;
  let next = 0;
  const prefix = skill.directory ? `${skill.directory}/` : "";
  const controller = new AbortController();
  const combinedSignal = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal;
  let firstFailure: unknown;
  try {
    report({ phase: "downloading", completed, total: skill.files.length });
    const outcomes = await Promise.allSettled(
      Array.from({ length: Math.min(4, skill.files.length) }, async () => {
        try {
          while (next < skill.files.length) {
            combinedSignal.throwIfAborted();
            const file = skill.files[next++]!;
            const relative = safeRelative(file.path.slice(prefix.length));
            const buffer = await readBytes(
              await request(
                rawUrl(skill.source, skill.revision, file.path),
                combinedSignal,
                fetcher,
              ),
              maxFileBytes,
              combinedSignal,
            );
            bytes += buffer.length;
            if (bytes > maxBytes) throw installError("too_large");
            const target = path.join(staging, relative);
            await fs.mkdir(path.dirname(target), { recursive: true });
            await fs.writeFile(target, buffer, {
              mode: file.mode === "100755" ? 0o755 : 0o644,
            });
            report({
              phase: "downloading",
              completed: ++completed,
              total: skill.files.length,
              file: relative,
            });
          }
        } catch (error) {
          firstFailure ??= error;
          controller.abort();
          throw error;
        }
      }),
    );
    if (signal?.aborted) throw installError("cancelled");
    if (outcomes.some((result) => result.status === "rejected"))
      throw firstFailure;
    report({ phase: "validating", completed, total: skill.files.length });
    validateSkill(await fs.readFile(path.join(staging, "SKILL.md"), "utf8"));
    await fs.writeFile(
      path.join(staging, metadataFile),
      JSON.stringify({
        sourceId: skill.sourceId,
        source: skill.source,
        sourceSkillId: skill.skillId,
        revision: skill.revision,
      } satisfies SkillSource),
    );
    signal?.throwIfAborted();
    await fs.rename(staging, destination);
    report({ phase: "complete", completed, total: skill.files.length });
    return destination;
  } finally {
    // mkdtemp creates this exact sibling beneath parent; never remove destination.
    if (path.dirname(staging) === path.resolve(parent))
      await fs.rm(staging, { recursive: true, force: true });
  }
}
