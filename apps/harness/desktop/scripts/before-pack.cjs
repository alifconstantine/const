const { buildMacComputerUse } = require("./build-computer-use-macos.cjs");
module.exports = async context => {
  if (context.electronPlatformName !== "darwin") return;
  if (process.platform !== "darwin") throw new Error("macOS packaging requires macOS to compile and sign the native computer-use helper");
  const arch = { 1: "x64", 3: "arm64" }[context.arch];
  if (!arch) throw new Error(`Unsupported macOS package architecture: ${context.arch}`);
  buildMacComputerUse(arch);
};
