const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function buildMacComputerUse(arch = process.arch) {
  if (process.platform !== "darwin") return;
  const swiftArch = { x64: "x86_64", arm64: "arm64" }[arch];
  if (!swiftArch) throw new Error(`Unsupported macOS computer-use architecture: ${arch}`);
  const project = path.resolve(__dirname, "../native/computer-use-macos");
  const args = ["build", "--package-path", project, "--configuration", "release", "--arch", swiftArch];
  const built = spawnSync("swift", [...args, "--product", "const-computer-use-macos"], { stdio: "inherit" });
  if (built.error || built.status !== 0) throw built.error ?? new Error("macOS computer-use Swift build failed");
  const located = spawnSync("swift", [...args, "--show-bin-path"], { encoding: "utf8" });
  if (located.error || located.status !== 0) throw located.error ?? new Error("Could not locate the macOS computer-use executable");
  const bundle = path.join(project, "bin", arch, "ConstComputerUse.app");
  const contents = path.join(bundle, "Contents");
  const executable = path.join(contents, "MacOS", "const-computer-use-macos");
  fs.mkdirSync(path.dirname(executable), { recursive: true });
  fs.copyFileSync(path.join(located.stdout.trim(), "const-computer-use-macos"), executable);
  fs.chmodSync(executable, 0o755);
  fs.copyFileSync(path.join(project, "Info.plist"), path.join(contents, "Info.plist"));
  const signed = spawnSync("codesign", ["--force", "--sign", "-", "--identifier", "id.web.const.harness.computer-use", bundle], { stdio: "inherit" });
  if (signed.error || signed.status !== 0) throw signed.error ?? new Error("Could not sign the macOS computer-use helper");
}

module.exports = { buildMacComputerUse };
if (require.main === module) buildMacComputerUse();
