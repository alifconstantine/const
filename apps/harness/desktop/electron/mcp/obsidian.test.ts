import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { ObsidianVault } from "./obsidian";
import { McpStore } from "./store";
import { McpService } from "./service";
import { readPluginManifest } from "@const/agent";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "const-obsidian-"));
  const folder = path.join(root, "vault");
  fs.mkdirSync(path.join(folder, ".obsidian"), { recursive: true });
  const cleanup = () => {
    if (
      path.dirname(path.resolve(root)) === path.resolve(os.tmpdir()) &&
      path.basename(root).startsWith("const-obsidian-")
    )
      fs.rmSync(root, { recursive: true, force: true });
  };
  return { root, folder, cleanup };
}
test("local Obsidian notes preserve Markdown, pagination, literal search, links and concurrent user edits", () => {
  const f = fixture();
  try {
    const vault = new ObsidianVault(f.folder);
    const text =
      "---\ntags: [const]\n---\n# Plan\n\nSee [[Project]] and [Task](Tasks/Today.md).\n";
    vault.call("write_note", { path: "Plan.md", content: text });
    vault.call("write_note", {
      path: "Project.md",
      content: "# Project\n[[Plan|Roadmap]]\n",
    });
    vault.call("write_note", {
      path: "Tasks/Today.md",
      content: "# Today\n[Plan](../Plan.md)\n",
    });
    assert.equal(
      (vault.call("read_note", { path: "Plan.md" }) as any).content,
      text,
    );
    assert.equal(
      (vault.call("list_notes", { folder: "Tasks" }) as any).total,
      1,
    );
    assert.equal((vault.call("list_notes", { limit: 1 }) as any).nextOffset, 1);
    assert.equal(
      (vault.call("search_notes", { query: "const" }) as any).matches.length,
      1,
    );
    assert.equal(
      (vault.call("search_notes", { query: ".*" }) as any).matches.length,
      0,
    );
    assert.deepEqual(
      (vault.call("get_links", { path: "Plan.md" }) as any).backlinks,
      ["Project.md", "Tasks/Today.md"],
    );
    assert.throws(
      () => vault.call("write_note", { path: "Plan.md", content: "erase" }),
      /Read it again/i,
    );
    fs.writeFileSync(path.join(f.folder, "Plan.md"), text + "Manual edit\n");
    assert.throws(
      () =>
        vault.call("append_note", {
          path: "Plan.md",
          content: "stale",
          expectedHash: hash(text),
        }),
      /Read it again/i,
    );
    vault.call("append_note", {
      path: "Plan.md",
      content: "Agent edit\n",
      expectedHash: hash(text + "Manual edit\n"),
    });
    assert.equal(
      fs.readFileSync(path.join(f.folder, "Plan.md"), "utf8"),
      text + "Manual edit\nAgent edit\n",
    );
  } finally {
    f.cleanup();
  }
});
test("Obsidian refuses traversal, configuration access, symlinks, hardlinks and writes outside the chosen vault", () => {
  const f = fixture();
  try {
    const vault = new ObsidianVault(f.folder);
    for (const name of [
      "../outside.md",
      "/absolute.md",
      "C:/outside.md",
      ".obsidian/config.md",
      ".git/config.md",
      "Notes/../outside.md",
      "Notes\\outside.md",
      "CON.md",
      "Notes/secret.txt",
      "trailing /note.md",
    ]) {
      assert.throws(() =>
        vault.call("write_note", { path: name, content: "blocked" }),
      );
    }
    const outside = path.join(f.root, "outside");
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "secret.md"), "private");
    fs.symlinkSync(
      outside,
      path.join(f.folder, "Linked"),
      process.platform === "win32" ? "junction" : "dir",
    );
    fs.linkSync(
      path.join(outside, "secret.md"),
      path.join(f.folder, "hardlink.md"),
    );
    assert.throws(() => vault.call("read_note", { path: "Linked/secret.md" }));
    assert.throws(() =>
      vault.call("write_note", { path: "Linked/new.md", content: "blocked" }),
    );
    assert.throws(() => vault.call("read_note", { path: "hardlink.md" }));
    assert.deepEqual((vault.call("list_notes", {}) as any).notes, []);
    assert.equal(
      fs.readFileSync(path.join(outside, "secret.md"), "utf8"),
      "private",
    );
    assert.throws(() => new ObsidianVault(outside), /vault/);
    assert.throws(
      () => new ObsidianVault(path.join(f.folder, "Linked")),
      /vault/,
    );
    assert.throws(
      () =>
        vault.call("write_note", {
          path: "big.md",
          content: "あ".repeat(400_000),
        }),
      /1 MB/,
    );
  } finally {
    f.cleanup();
  }
});
test("Obsidian uses the real in-process MCP SDK, explicit vault selection, trust and independent workspace overrides", async () => {
  const f = fixture();
  const pluginPath = path.resolve("plugins/obsidian");
  const plugin = {
    ...readPluginManifest(pluginPath),
    id: "obsidian",
    path: pluginPath,
    scope: "user" as const,
    skills: [],
    isEnabled: true,
    isEffective: true,
  };
  const store = new McpStore(path.join(f.root, "home"), {
    encrypt: (v) => Buffer.from(v),
    decrypt: (v) => v.toString(),
  });
  const service = new McpService(
    store,
    () => {},
    async () => {},
    () => [plugin],
  );
  try {
    const id = service.list()[0]!.id;
    assert.deepEqual(await service.tools(f.root), []);
    await service.chooseVault(id, undefined, async () => null);
    assert.equal(store.get(id).vaultPath, undefined);
    await service.chooseVault(id, undefined, async () => f.folder);
    const tools = await service.tools(f.root);
    assert.equal(tools.length, 6);
    assert.ok(tools.every((tool) => tool.requiresApproval));
    const write = tools.find((tool) =>
      tool.function.name.endsWith("write_note"),
    )!;
    const result = await service.execute(
      write.function.name,
      { path: "From Chat.md", content: "# Hello from MCP\n" },
      f.root,
    );
    assert.equal(result.isError, false);
    assert.match(
      fs.readFileSync(path.join(f.folder, "From Chat.md"), "utf8"),
      /Hello from MCP/,
    );
    assert.equal(service.list()[0]!.status, "connected");
    assert.equal(service.list()[0]!.hasCredentials, false);
    assert.ok(!fs.existsSync(path.join(store.home, "mcp-secrets.json")));
    const workspace = path.join(f.root, "workspace");
    fs.mkdirSync(workspace);
    await service.override(id, workspace);
    const overridden = service.list(workspace)[0]!;
    assert.equal(overridden.vaultPath, undefined);
    assert.deepEqual(await service.tools(workspace), []);
    assert.equal(
      (
        await service.execute(
          write.function.name,
          { path: "no.md", content: "no" },
          workspace,
        )
      ).isError,
      true,
    );
    await assert.rejects(
      service.chooseVault(id, undefined, async () => {
        store.save({ ...store.get(id), enabled: false });
        return f.folder;
      }),
      /invalid/,
    );
    assert.equal(store.get(id).enabled, false);
    store.save({ ...store.get(id), enabled: true });
    await assert.rejects(
      service.save({
        name: "Impersonator",
        scope: "user",
        transport: "builtin",
        builtin: "obsidian",
        auth: "none",
        vaultPath: f.folder,
      }),
      /invalid/,
    );
    const json = path.join(store.home, "mcp.json");
    const config = JSON.parse(fs.readFileSync(json, "utf8"));
    config.connections[0].vaultPath = f.root;
    fs.writeFileSync(json, JSON.stringify(config));
    assert.deepEqual(await service.tools(f.root), []);
  } finally {
    await service.invalidate();
    f.cleanup();
  }
});
test("new builtin support preserves existing HTTP and stdio configuration fingerprints", () => {
  const f = fixture();
  try {
    const store = new McpStore(f.root, {
      encrypt: (v) => Buffer.from(v),
      decrypt: (v) => v.toString(),
    });
    const record = store.save({
      name: "Existing",
      transport: "http",
      scope: "user",
      auth: "none",
      url: "https://example.com/mcp",
    });
    const original = hash(
      JSON.stringify([
        record.id,
        record.key,
        record.scope,
        record.workspacePath,
        record.transport,
        record.url,
        record.command,
        record.args ?? [],
        record.cwd,
        record.auth,
        record.clientId,
        record.scopes,
      ]),
    );
    assert.equal(store.fingerprint(record), original);
    assert.ok(store.isTrusted(record));
  } finally {
    f.cleanup();
  }
});
