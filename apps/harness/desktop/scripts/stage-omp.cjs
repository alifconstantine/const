const { createHash, randomUUID } = require("node:crypto");
const { createReadStream, createWriteStream } = require("node:fs");
const { chmod, copyFile, mkdir, rename, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const release = require("../omp-release.json");

async function digest(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function getAsset(name) {
  const expected = release.sha256[name];
  if (!expected) throw new Error(`No pinned oh-my-pi asset for ${name}.`);
  const cache = path.join(os.homedir(), ".cache", "const-harness", "omp", release.version);
  const target = path.join(cache, name);
  if (await digest(target).catch(() => undefined) === expected) return target;

  await mkdir(cache, { recursive: true, mode: 0o700 });
  const part = `${target}.${randomUUID()}.part`;
  try {
    console.log(`Downloading oh-my-pi ${release.version} ${name}`);
    const url = `https://github.com/can1357/oh-my-pi/releases/download/v${release.version}/${name}`;
    const signal = AbortSignal.timeout(240_000);
    const response = await fetch(url, { signal });
    if (!response.ok || !response.body) throw new Error(`Could not download ${name} (HTTP ${response.status}).`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(part, { flags: "wx", mode: 0o600 }), { signal });
    if (await digest(part) !== expected) throw new Error(`Checksum mismatch for ${name}.`);
    await chmod(part, name === "LICENSE" ? 0o644 : 0o755);
    await rename(part, target);
    return target;
  } finally {
    await rm(part, { force: true });
  }
}

async function stageOmp(platform, arch, destination) {
  const executable = platform === "win32" ? "omp.exe" : "omp";
  const asset = platform === "win32" ? `omp-windows-${arch}.exe` : `omp-${platform}-${arch}`;
  const binary = await getAsset(asset);
  if (destination) {
    const license = await getAsset("LICENSE");
    await mkdir(destination, { recursive: true });
    const output = path.join(destination, executable);
    await copyFile(binary, output);
    await chmod(output, 0o755);
    await copyFile(license, path.join(destination, "LICENSE"));
  }
  return binary;
}

module.exports = { stageOmp };

if (require.main === module) {
  stageOmp(process.platform, process.arch).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
