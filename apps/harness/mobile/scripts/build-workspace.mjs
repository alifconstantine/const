import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const mobile = fileURLToPath(new URL("..", import.meta.url));
const desktop = path.resolve(mobile, "../desktop");
const target = path.resolve(
  mobile,
  process.argv.includes("--dev") ? "public/remote" : "dist/remote",
);
const result = spawnSync(
  process.execPath,
  [
    "--max-old-space-size=6144",
    "node_modules/vite/bin/vite.js",
    "build",
    "--config",
    "vite.remote.config.ts",
    "--outDir",
    target,
    "--base",
    "/remote/",
    "--logLevel",
    "warn",
  ],
  { cwd: desktop, stdio: "inherit" },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
mkdirSync(target, { recursive: true });
cpSync(
  path.join(mobile, "workspace/index.html"),
  path.join(target, "index.html"),
);
