const path = require("node:path");
const { stageOmp } = require("./stage-omp.cjs");

module.exports = async context => {
  const arch = { 1: "x64", 3: "arm64" }[context.arch];
  if (!arch) throw new Error(`oh-my-pi is unavailable for package architecture ${context.arch}.`);
  const resources = context.packager.getResourcesDir(context.appOutDir);
  await stageOmp(context.electronPlatformName, arch, path.join(resources, "omp"));
};
