const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "../../..");
const rootRequire = createRequire(path.join(root, "package.json"));
const appRequire = createRequire(path.join(root, "apps/router/package.json"));
const ts = rootRequire("typescript");
function sourceLoader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(root, file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText;
    function requireSource(id) {
      if (Object.hasOwn(overrides, id)) return overrides[id];
      if (id.startsWith("@/")) {
        const base = path.resolve(root, "apps/router/src/" + id.slice(2));
        return load(
          [base + ".ts", base + ".tsx"].find((p) => fs.existsSync(p)),
        );
      }
      if (id.startsWith("@const/backend/"))
        return load("packages/backend/convex/" + id.slice(15) + ".ts");
      if (id.startsWith(".")) {
        const base = path.resolve(path.dirname(file), id);
        const resolved = [
          base,
          base.replace(/\.js$/, ".ts"),
          base + ".ts",
          base + ".tsx",
          path.join(base, "index.ts"),
        ].find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
        return load(resolved);
      }
      return createRequire(file)(id);
    }
    new Function("require", "module", "exports", code)(
      requireSource,
      module,
      module.exports,
    );
    return module.exports;
  }
  return load;
}
module.exports = { sourceLoader, root, appRequire };
