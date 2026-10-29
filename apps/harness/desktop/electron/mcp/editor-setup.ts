import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { spawn } from "node:child_process";
import JSZip from "jszip";
import blenderRequirements from "./blender-requirements.json";
import type { EditorApp } from "../../src/lib/mcp/editors";

const UV_VERSION = "0.13.6";
const NODE_VERSION = "22.23.4";
const UNITY_VERSION = "1.0.0-beta.14";
const UV = {
  "win32-x64": [
    "x86_64-pc-windows-msvc.zip",
    "a2a8820d5eea32f08ef467ef3b7f66883a9b076d5737a2fc2fbb5f458d1bb50f",
  ],
  "win32-arm64": [
    "aarch64-pc-windows-msvc.zip",
    "c2426c0c8e28b53d8c440e47a18d96ad4db51e159866c0e81435b196d7f0081c",
  ],
  "darwin-x64": [
    "x86_64-apple-darwin.tar.gz",
    "63ba17fdda55ad1a230d4b37fc6017ffa10c23688c83818bd3bfdf914c652a02",
  ],
  "darwin-arm64": [
    "aarch64-apple-darwin.tar.gz",
    "60fbd5c8a1ed681845eea28d9d622fcde03c51e91a43465b64a1e17db1ed3472",
  ],
  "linux-x64": [
    "x86_64-unknown-linux-gnu.tar.gz",
    "f29c3e94ffabd7e6f3ba521dba169a9b7ec12100bf3257087f0f24f6123f3645",
  ],
  "linux-arm64": [
    "aarch64-unknown-linux-gnu.tar.gz",
    "229e194255c7958d86d56e8790d969a6f74736592133f0dfd0076f754c642c1d",
  ],
} as Record<string, [string, string]>;
const NODE = {
  "win32-x64": [
    "win-x64.zip",
    "cbc74b5e0982c9dbb41525fd8fb5dcd32fbee237863f7829072f4639a1ce5f20",
  ],
  "win32-arm64": [
    "win-arm64.zip",
    "a8b8cd79cbbb3062435f449591d98dd63730bbbf30ce2d7cc3a6376c236cb111",
  ],
  "darwin-x64": [
    "darwin-x64.tar.gz",
    "efcc2b0db6f94bf53eddb038fe2b370277a042bd29e4f19b8f8e23598795b819",
  ],
  "darwin-arm64": [
    "darwin-arm64.tar.gz",
    "c9e1dbc748b33ed2d14f42445191ecaf14c56259c7a9a26d0042c49ec2b66428",
  ],
  "linux-x64": [
    "linux-x64.tar.gz",
    "b8492284c76a54baf58d61668dd0e41ee0fc98adabf9503d30f05d08f55b4406",
  ],
  "linux-arm64": [
    "linux-arm64.tar.gz",
    "f7a1e486dbc8b286847815b477d4fb5e9fb963ed4489c3e1588853d685f589f9",
  ],
} as Record<string, [string, string]>;
const UNITY = {
  "win32-x64": [
    "windows-x64.exe",
    "78761a0547cd4a9bc212e27a217c66e6a621bf48c753ba440e4b2327ee7ff8ac",
  ],
  "win32-arm64": [
    "windows-arm64.exe",
    "151227182149c7a0122f5170775e189496be7772f04d6305cb976105458d23a3",
  ],
  "darwin-x64": [
    "darwin-x64",
    "578c5923adfcb9e1c789c17ea344a0a71ca94b69681550a793260ba890ee22fc",
  ],
  "darwin-arm64": [
    "darwin-arm64",
    "367ea124c61e91dc22409699cb40d2e65d23952f3220e911ccea1f6d8a1ff37f",
  ],
  "linux-x64": [
    "linux-x64",
    "d9a2c1716ce723b970898f7f40adc09cceee04e84ce2f1f1638f07ac3e9898aa",
  ],
  "linux-arm64": [
    "linux-arm64",
    "485404dca1b6a21dbdc38249aced69bfa9dc2cb26dc995bc1f29fe9b860c51d5",
  ],
} as Record<string, [string, string]>;

export async function runEditorProcess(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    signal?: AbortSignal;
    timeout?: number;
  } = {},
): Promise<string> {
  options.signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let diagnostic = "";
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      if (error) {
        child.kill();
        reject(error);
      } else resolve(output);
    };
    const abort = () => finish(new Error("editor_setup"));
    const timer = setTimeout(abort, options.timeout ?? 180_000);
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
    child.stdout.on("data", (data: Buffer) => {
      output += data.toString();
      if (output.length > 2_000_000) abort();
    });
    // Drain diagnostics, but never return credentials, tokens or raw process errors to the renderer.
    child.stderr.on("data", (data: Buffer) => {
      diagnostic = (diagnostic + data.toString()).slice(-4000);
    });
    child.on("error", () => finish(new Error("editor_setup")));
    child.on("close", (code) =>
      finish(
        code === 0
          ? undefined
          : new Error("editor_setup", {
              cause: {
                exitCode: code,
                diagnostic,
                output: output.slice(-4000),
              },
            }),
      ),
    );
  });
}

export function archivePath(root: string, entry: string): string {
  if (!entry || entry.includes("\\") || entry.includes(":"))
    throw new Error("editor_setup");
  const resolved = path.resolve(root, entry);
  const relative = path.relative(root, resolved);
  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error("editor_setup");
  return resolved;
}

/** Extract pinned archives into a new private staging directory, never into an existing project. */
export async function extractEditorArchive(
  data: Buffer,
  root: string,
  zip: boolean,
) {
  let total = 0;
  let count = 0;
  const write = (name: string, bytes: Buffer, mode = 0o644) => {
    if (++count > 30_000 || (total += bytes.length) > 600_000_000)
      throw new Error("editor_setup");
    const target = archivePath(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes, { flag: "wx", mode: mode & 0o777 });
  };
  if (zip) {
    const archive = await JSZip.loadAsync(data);
    for (const file of Object.values(archive.files)) {
      if (file.unsafeOriginalName && file.name !== file.unsafeOriginalName)
        throw new Error("editor_setup");
      archivePath(root, file.name);
      if ((Number(file.unixPermissions ?? 0) & 0o170000) === 0o120000)
        throw new Error("editor_setup");
      if (file.dir)
        fs.mkdirSync(archivePath(root, file.name), { recursive: true });
      else
        write(
          file.name,
          await file.async("nodebuffer"),
          Number(file.unixPermissions ?? 0o644),
        );
    }
    return;
  }
  const tar = gunzipSync(data, { maxOutputLength: 600_000_000 });
  let longName = "";
  let paxPath = "";
  const str = (b: Buffer) => b.toString("utf8").replace(/\0.*$/s, "");
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const size = parseInt(str(header.subarray(124, 136)).trim() || "0", 8);
    if (
      !Number.isSafeInteger(size) ||
      size < 0 ||
      offset + 512 + size > tar.length
    )
      throw new Error("editor_setup");
    const bytes = tar.subarray(offset + 512, offset + 512 + size);
    const type = String.fromCharCode(header[156]!);
    const prefix = str(header.subarray(345, 500));
    const name =
      paxPath ||
      longName ||
      `${prefix ? `${prefix}/` : ""}${str(header.subarray(0, 100))}`;
    offset += 512 + Math.ceil(size / 512) * 512;
    if (type === "L") {
      longName = str(bytes);
      continue;
    }
    if (type === "x" || type === "g") {
      paxPath = "";
      for (let at = 0; at < bytes.length;) {
        const end = bytes.indexOf(32, at);
        const length = Number(bytes.subarray(at, end).toString());
        if (
          end < 0 ||
          !Number.isSafeInteger(length) ||
          length <= end - at ||
          at + length > bytes.length
        )
          throw new Error("editor_setup");
        const record = bytes.subarray(end + 1, at + length - 1).toString();
        if (record.startsWith("path=")) paxPath = record.slice(5);
        at += length;
      }
      continue;
    }
    longName = "";
    paxPath = "";
    archivePath(root, name);
    // Symlinks in official Node archives are CLI shims. Invoke npm-cli.js directly instead.
    if (type === "5")
      fs.mkdirSync(archivePath(root, name), { recursive: true });
    else if (type === "0" || type === "\0")
      write(
        name,
        bytes,
        parseInt(str(header.subarray(100, 108)).trim() || "644", 8),
      );
    else if (!["1", "2", "5"].includes(type)) throw new Error("editor_setup");
  }
}

async function download(
  url: string,
  hash: string,
  signal: AbortSignal,
): Promise<Buffer> {
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(180_000)]),
  });
  if (!response.ok || !response.body) throw new Error("editor_setup");
  const chunks: Buffer[] = [];
  let size = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      size += chunk.length;
      if (size > 150_000_000) throw new Error("editor_setup");
      chunks.push(Buffer.from(chunk));
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const buffer = Buffer.concat(chunks);
  if (createHash("sha256").update(buffer).digest("hex") !== hash)
    throw new Error("editor_setup");
  return buffer;
}

export const UNREAL_CONTEXT_PYTHON = `import os
import unreal
import toolset_registry

@unreal.uclass()
class ConstHarnessContext(unreal.ToolsetDefinition):
    """Read-only identity of the Unreal project served by this editor."""

    @toolset_registry.tool_call
    @staticmethod
    def project_file() -> str:
        """Return the canonical project file for verifying the target editor."""
        return "const-harness-project:" + os.path.realpath(unreal.Paths.convert_relative_path_to_full(unreal.Paths.get_project_file_path()))

unreal.ToolsetRegistry.register_toolset_class(ConstHarnessContext)
`;

/** All runtime code lives in the user's Const home, outside repositories and the application archive. */
export class EditorSetup {
  private pending = new Map<
    EditorApp,
    { controller: AbortController; promise: Promise<void> }
  >();
  constructor(readonly home: string) {}
  root(app: EditorApp) {
    return path.join(this.home, "editor-runtimes", `${app}-v1`);
  }
  busy(app: EditorApp) {
    return this.pending.has(app);
  }
  prepared(app: EditorApp) {
    const root = this.root(app);
    try {
      if (fs.lstatSync(root).isSymbolicLink()) return false;
      const marker = JSON.parse(
        fs.readFileSync(path.join(root, "ready.json"), "utf8"),
      );
      if (marker.app !== app || marker.version !== 1) return false;
      const files =
        app === "blender"
          ? [
              path.join(
                "bridge",
                ".venv",
                process.platform === "win32" ? "Scripts" : "bin",
                process.platform === "win32" ? "python.exe" : "python",
              ),
              "bridge/blmcp/__init__.py",
              "mcp-1.0.3.zip",
            ]
          : app === "godot"
            ? [
                process.platform === "win32"
                  ? "node/node.exe"
                  : "node/bin/node",
                "server/dist/index.js",
                "addon/godot-mcp-toolkit-1.1.1/addons/godot_mcp_toolkit/plugin.cfg",
              ]
            : app === "unity"
              ? [process.platform === "win32" ? "unity.exe" : "unity"]
              : [];
      return files.every((file) => fs.statSync(path.join(root, file)).isFile());
    } catch {
      return false;
    }
  }
  cancel(app: EditorApp) {
    this.pending.get(app)?.controller.abort();
  }
  async close() {
    for (const job of this.pending.values()) job.controller.abort();
    await Promise.allSettled([...this.pending.values()].map((p) => p.promise));
  }
  private executable(root: string, binary: string): string {
    const files = fs.readdirSync(root, { withFileTypes: true });
    for (const file of files) {
      const candidate = path.join(root, file.name);
      if (file.isFile() && file.name === binary) return candidate;
      if (file.isDirectory()) {
        try {
          return this.executable(candidate, binary);
        } catch {
          /* Keep searching. */
        }
      }
    }
    throw new Error("editor_setup");
  }
  paths(app: EditorApp) {
    if (!this.prepared(app)) throw new Error("editor_setup");
    const root = this.root(app);
    if (app === "blender") {
      const bridge = path.join(root, "bridge");
      const imports =
        process.platform === "win32"
          ? [
              path.toNamespacedPath(bridge),
              path.toNamespacedPath(
                path.join(bridge, ".venv", "Lib", "site-packages"),
              ),
            ]
          : [bridge];
      return {
        command: path.join(
          root,
          "bridge",
          ".venv",
          process.platform === "win32" ? "Scripts" : "bin",
          process.platform === "win32" ? "python.exe" : "python",
        ),
        // Isolate imports from user Python configuration and support long Windows cache paths.
        args: [
          "-I",
          "-c",
          `import sys, runpy; sys.path[:0] = ${JSON.stringify(imports)}; runpy.run_module("blmcp", run_name="__main__")`,
        ],
        cwd: bridge,
      };
    }
    if (app === "godot")
      return {
        command: this.executable(
          path.join(root, "node"),
          process.platform === "win32" ? "node.exe" : "node",
        ),
        args: [path.join(root, "server", "dist", "index.js")],
        cwd: path.join(root, "server"),
      };
    return {
      command: path.join(
        root,
        process.platform === "win32" ? "unity.exe" : "unity",
      ),
      args: [] as string[],
      cwd: root,
    };
  }
  async prepare(app: EditorApp) {
    const previous = this.pending.get(app);
    if (previous) return previous.promise;
    if (this.prepared(app)) return;
    const controller = new AbortController();
    const promise = this.prepareRuntime(app, controller.signal).catch(
      (error: unknown) => {
        throw controller.signal.aborted ? new Error("editor_cancelled") : error;
      },
    );
    this.pending.set(app, { controller, promise });
    try {
      await promise;
    } finally {
      if (this.pending.get(app)?.promise === promise) this.pending.delete(app);
    }
  }
  async unityAction(action: "login" | "pipeline", project: string) {
    if (this.pending.has("unity")) throw new Error("busy");
    const controller = new AbortController();
    const launch = this.paths("unity");
    const promise = runEditorProcess(
      launch.command,
      action === "login"
        ? ["auth", "login"]
        : ["pipeline", "install", "--project-path", project],
      { cwd: project, timeout: 300_000, signal: controller.signal },
    )
      .then(() => {})
      .catch((error: unknown) => {
        throw controller.signal.aborted ? new Error("editor_cancelled") : error;
      });
    this.pending.set("unity", { controller, promise });
    try {
      await promise;
    } finally {
      if (this.pending.get("unity")?.promise === promise)
        this.pending.delete("unity");
    }
  }
  private async prepareRuntime(app: EditorApp, signal: AbortSignal) {
    const target = this.root(app);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const staging = path.join(
      path.dirname(target),
      `.i-${app}-${randomUUID().slice(0, 8)}`,
    );
    fs.mkdirSync(staging);
    const platform = `${process.platform}-${process.arch}`;
    const fetchArchive = async (
      url: string,
      hash: string,
      destination: string,
      zip: boolean,
    ) => {
      fs.mkdirSync(destination, { recursive: true });
      await extractEditorArchive(
        await download(url, hash, signal),
        destination,
        zip,
      );
    };
    try {
      if (app === "blender") {
        const spec = UV[platform];
        if (!spec) throw new Error("editor_setup");
        await fetchArchive(
          `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-${spec[0]}`,
          spec[1],
          path.join(staging, "uv"),
          spec[0].endsWith("zip"),
        );
        await fetchArchive(
          "https://projects.blender.org/lab/blender_mcp/releases/download/v1.0.3/blender-1.0.3.mcpb",
          "d6fe04dd17767f7c7fb452142f1f0e6787db575db49f3976a166142683b5b97e",
          path.join(staging, "bridge"),
          true,
        );
        fs.writeFileSync(
          path.join(staging, "mcp-1.0.3.zip"),
          await download(
            "https://projects.blender.org/lab/blender_mcp/releases/download/v1.0.3/mcp-1.0.3.zip",
            "a7a9da816192502e5a0a202a396444e266b47d8fc4f74ad4698048bd43040707",
            signal,
          ),
        );
        const uv = this.executable(
          path.join(staging, "uv"),
          process.platform === "win32" ? "uv.exe" : "uv",
        );
        // Python is managed by uv. Never resolve the unrelated community package named blender-mcp on PyPI.
        const bridge = path.join(staging, "bridge");
        const python = path.join(
          bridge,
          ".venv",
          process.platform === "win32" ? "Scripts" : "bin",
          process.platform === "win32" ? "python.exe" : "python",
        );
        fs.writeFileSync(
          path.join(bridge, "const-requirements.txt"),
          blenderRequirements.requirements.join("\n") + "\n",
        );
        await runEditorProcess(
          uv,
          ["venv", "--python", "3.12.16", "--relocatable", ".venv"],
          { cwd: bridge, signal, timeout: 600_000 },
        );
        // Run the official source directly; building the bundled manual as Python packages
        // fails on long Windows paths. Every third-party dependency is pinned and hash checked.
        await runEditorProcess(
          uv,
          [
            "pip",
            "install",
            "--python",
            python,
            "--require-hashes",
            "--no-deps",
            "--only-binary",
            ":all:",
            "-r",
            "const-requirements.txt",
          ],
          { cwd: bridge, signal, timeout: 600_000 },
        );
      } else if (app === "godot") {
        const spec = NODE[platform];
        if (!spec) throw new Error("editor_setup");
        await fetchArchive(
          `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-${spec[0]}`,
          spec[1],
          path.join(staging, "node-unpack"),
          spec[0].endsWith("zip"),
        );
        const nodeFolder = fs.readdirSync(path.join(staging, "node-unpack"))[0];
        if (!nodeFolder) throw new Error("editor_setup");
        fs.renameSync(
          path.join(staging, "node-unpack", nodeFolder),
          path.join(staging, "node"),
        );
        await fetchArchive(
          "https://registry.npmjs.org/@npgamedev/godot-mcp-server/-/godot-mcp-server-1.1.1.tgz",
          "68cd88b544f376f8c206921b191d8baf8d64d0946cc4cd7047731591237cf430",
          path.join(staging, "npm-package"),
          false,
        );
        fs.renameSync(
          path.join(staging, "npm-package", "package"),
          path.join(staging, "server"),
        );
        fs.writeFileSync(
          path.join(staging, "server", "package-lock.json"),
          await download(
            "https://raw.githubusercontent.com/NPGameDev/godot-mcp-server/v1.1.1/package-lock.json",
            "58c07977d6607c68c328e27b608cb989d09427a972f88c2e5901b7dfdca817e1",
            signal,
          ),
        );
        const node = this.executable(
          path.join(staging, "node"),
          process.platform === "win32" ? "node.exe" : "node",
        );
        const npm = this.executable(path.join(staging, "node"), "npm-cli.js");
        await runEditorProcess(
          node,
          [
            npm,
            "ci",
            "--omit=dev",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
          ],
          { cwd: path.join(staging, "server"), signal, timeout: 600_000 },
        );
        await fetchArchive(
          "https://codeload.github.com/NPGameDev/godot-mcp-toolkit/zip/refs/tags/v1.1.1",
          "23279a7ddd7ab30c4f006ef13db3f3ffbe45f0eff07ec542f668f818886f7385",
          path.join(staging, "addon"),
          true,
        );
      } else if (app === "unity") {
        const spec = UNITY[platform];
        if (!spec) throw new Error("editor_setup");
        const binary = path.join(
          staging,
          process.platform === "win32" ? "unity.exe" : "unity",
        );
        fs.writeFileSync(
          binary,
          await download(
            `https://public-cdn.cloud.unity3d.com/hub/prod/cli/${UNITY_VERSION}/unity-${spec[0]}`,
            spec[1],
            signal,
          ),
          { mode: 0o755 },
        );
      }
      signal.throwIfAborted();
      fs.writeFileSync(
        path.join(staging, "ready.json"),
        JSON.stringify({ version: 1, app }),
      );
      // Repair incomplete caches without deleting files that may be useful for diagnosis.
      if (fs.existsSync(target)) {
        if (
          fs.lstatSync(target).isSymbolicLink() ||
          path.dirname(path.resolve(target)) !==
            path.dirname(path.resolve(staging))
        )
          throw new Error("editor_setup");
        fs.renameSync(
          target,
          path.join(
            path.dirname(target),
            `.${app}-backup-${randomUUID().slice(0, 8)}`,
          ),
        );
      }
      fs.renameSync(staging, target);
    } finally {
      // staging is a freshly created child with an unguessable name, never a user-selected directory.
      if (path.dirname(staging) === path.dirname(target))
        fs.rmSync(staging, { recursive: true, force: true });
    }
  }
  installProject(app: EditorApp, project: string) {
    if (!this.prepared(app)) throw new Error("editor_setup");
    if (app !== "godot" && app !== "unreal") return;
    const destination =
      app === "godot"
        ? path.join(project, "addons", "godot_mcp_toolkit")
        : path.join(project, "Plugins", "ConstHarnessBridge");
    const parent = path.dirname(destination);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent);
    const actualParent = fs.realpathSync(parent);
    const expectedParent = path.join(
      fs.realpathSync(project),
      path.basename(parent),
    );
    if (
      fs.lstatSync(parent).isSymbolicLink() ||
      (process.platform === "win32"
        ? actualParent.toLowerCase() !== expectedParent.toLowerCase()
        : actualParent !== expectedParent)
    )
      throw new Error("editor_project");
    if (fs.existsSync(destination)) {
      // Preserve existing upstream/custom add-ons. Enabling them is an editor-side action.
      if (fs.lstatSync(destination).isSymbolicLink())
        throw new Error("editor_project");
      return;
    }
    const staging = path.join(parent, `.const-bridge-${randomUUID()}`);
    try {
      if (app === "godot")
        fs.cpSync(
          path.join(
            this.root(app),
            "addon",
            "godot-mcp-toolkit-1.1.1",
            "addons",
            "godot_mcp_toolkit",
          ),
          staging,
          { recursive: true, errorOnExist: true },
        );
      else {
        fs.mkdirSync(path.join(staging, "Content", "Python"), {
          recursive: true,
        });
        fs.writeFileSync(
          path.join(staging, "ConstHarnessBridge.uplugin"),
          JSON.stringify(
            {
              FileVersion: 3,
              Version: 1,
              VersionName: "1.0.0",
              FriendlyName: "Const Harness Project Context",
              Description: "Read-only project identity for Const Harness MCP.",
              Category: "Editor",
              EnabledByDefault: true,
              CanContainContent: true,
              Plugins: [
                { Name: "ModelContextProtocol", Enabled: true },
                { Name: "AllToolsets", Enabled: true },
                { Name: "PythonScriptPlugin", Enabled: true },
              ],
            },
            null,
            2,
          ),
        );
        fs.writeFileSync(
          path.join(staging, "Content", "Python", "init_unreal.py"),
          UNREAL_CONTEXT_PYTHON,
        );
      }
      fs.renameSync(staging, destination);
    } finally {
      fs.rmSync(staging, { recursive: true, force: true });
    }
  }
}
