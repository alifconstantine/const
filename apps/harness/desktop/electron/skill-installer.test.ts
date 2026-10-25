import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  installRemoteSkill,
  resolveRemoteSkill,
  safeRelative,
  type ResolvedRemoteSkill,
} from "./skill-installer";

const markdown =
  "---\nname: pdf\ndescription: Read and create PDF files.\n---\n# PDF\n";
const file = (name: string) => ({
  path: `skills/pdf/${name}`,
  type: "blob",
  mode: "100644",
  size: 100,
});
const resolved = (source = "owner/repo"): ResolvedRemoteSkill => ({
  source,
  skillId: "pdf",
  sourceId: `${source}/pdf`,
  revision: "abc123",
  directory: "skills/pdf",
  content: markdown,
  files: [file("SKILL.md"), file("template.png"), file("scripts/run.py")],
});

test("resolves an exact directory on the repository default branch and pins file requests", async () => {
  const requests: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    requests.push(url);
    if (url.endsWith("/repos/owner/repo"))
      return Response.json({ default_branch: "trunk" });
    if (url.includes("/commits/")) return Response.json({ sha: "abc123" });
    if (url.includes("/git/trees/"))
      return Response.json({
        sha: "different-tree-sha",
        truncated: false,
        tree: [
          { ...file("SKILL.md"), path: "skills/not-pdf/SKILL.md" },
          file("SKILL.md"),
        ],
      });
    return new Response(markdown);
  };
  const skill = await resolveRemoteSkill(
    "owner/repo",
    "pdf",
    undefined,
    fetcher,
  );
  assert.equal(skill.directory, "skills/pdf");
  assert(requests.some((url) => url.endsWith("/commits/trunk")));
  assert(requests.some((url) => url.endsWith("/abc123/skills/pdf/SKILL.md")));
  assert(
    !requests.some(
      (url) =>
        url.includes("not-pdf/SKILL.md") &&
        url.includes("raw.githubusercontent"),
    ),
  );
});

test("never substitutes a single unrelated skill", async () => {
  const fetcher: typeof fetch = async (input) =>
    String(input).includes("/git/trees/")
      ? Response.json({
          sha: "abc123",
          truncated: false,
          tree: [{ ...file("SKILL.md"), path: "skills/not-pdf/SKILL.md" }],
        })
      : Response.json({ default_branch: "main", sha: "abc123" });
  await assert.rejects(
    resolveRemoteSkill("owner/repo", "pdf", undefined, fetcher),
    /NOT_FOUND/,
  );
});

test("downloads binary bytes intact and publishes after every file succeeds", async (t) => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "const-skill-test-"));
  t.after(() => fs.rm(parent, { recursive: true, force: true }));
  const binary = Uint8Array.from([137, 80, 78, 71, 255, 0, 128]);
  const phases: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    assert.equal(
      await fs.stat(path.join(parent, "pdf")).catch(() => null),
      null,
    );
    return new Response(
      String(input).endsWith("SKILL.md")
        ? markdown
        : String(input).endsWith(".png")
          ? binary
          : "print('ready')",
    );
  };
  const destination = await installRemoteSkill(
    resolved(),
    parent,
    (progress) => phases.push(progress.phase),
    undefined,
    fetcher,
  );
  assert.deepEqual(
    await fs.readFile(path.join(destination, "template.png")),
    Buffer.from(binary),
  );
  assert.equal(
    (await fs.readdir(parent)).filter((name) => name.startsWith(".install-"))
      .length,
    0,
  );
  assert.equal(
    JSON.parse(
      await fs.readFile(path.join(destination, ".const-source.json"), "utf8"),
    ).revision,
    "abc123",
  );
  assert.deepEqual(phases.slice(-2), ["validating", "complete"]);
});

test("a failed supporting file rolls back staging without touching existing skills", async (t) => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "const-skill-test-"));
  t.after(() => fs.rm(parent, { recursive: true, force: true }));
  await fs.mkdir(path.join(parent, "pdf"));
  await fs.writeFile(
    path.join(parent, "pdf", "SKILL.md"),
    "existing user skill",
  );
  const fetcher: typeof fetch = async (input) =>
    String(input).endsWith("run.py")
      ? new Response("", { status: 503 })
      : new Response(String(input).endsWith("SKILL.md") ? markdown : "asset");
  await assert.rejects(
    installRemoteSkill(resolved(), parent, () => {}, undefined, fetcher),
    /DOWNLOAD/,
  );
  assert.deepEqual(await fs.readdir(parent), ["pdf"]);
  assert.equal(
    await fs.readFile(path.join(parent, "pdf", "SKILL.md"), "utf8"),
    "existing user skill",
  );
});

test("two sources with the same skill name coexist and reinstalls are idempotent", async (t) => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "const-skill-test-"));
  t.after(() => fs.rm(parent, { recursive: true, force: true }));
  const fetcher: typeof fetch = async (input) =>
    new Response(String(input).endsWith("SKILL.md") ? markdown : "asset");
  const first = await installRemoteSkill(
    resolved(),
    parent,
    () => {},
    undefined,
    fetcher,
  );
  const second = await installRemoteSkill(
    resolved("another/repo"),
    parent,
    () => {},
    undefined,
    fetcher,
  );
  assert.notEqual(first, second);
  assert.equal(
    await installRemoteSkill(
      resolved("another/repo"),
      parent,
      () => {},
      undefined,
      fetcher,
    ),
    second,
  );
  assert.equal((await fs.readdir(parent)).length, 2);
});

test("cancellation removes incomplete files", async (t) => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "const-skill-test-"));
  t.after(() => fs.rm(parent, { recursive: true, force: true }));
  const controller = new AbortController();
  const fetcher: typeof fetch = async () => new Response(markdown);
  await assert.rejects(
    installRemoteSkill(
      resolved(),
      parent,
      (progress) => {
        if (progress.phase === "downloading") controller.abort();
      },
      controller.signal,
      fetcher,
    ),
    /CANCELLED/,
  );
  assert.deepEqual(await fs.readdir(parent), []);
});

test("rejects traversal and platform-specific unsafe file paths", () => {
  for (const value of [
    "../outside",
    "/absolute",
    "scripts/../outside",
    "C:/outside",
    "folder\\file",
    "CON.txt",
    "trailing.",
  ])
    assert.throws(() => safeRelative(value), /INVALID/);
  assert.equal(safeRelative("references/guide.md"), "references/guide.md");
});
