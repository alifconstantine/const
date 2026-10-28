const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const source = path.join(
  path.dirname(require.resolve("@excalidraw/excalidraw")),
  "fonts",
);
const target = path.join(root, "public", "excalidraw-assets", "fonts");
if (!fs.existsSync(target) || fs.readdirSync(target).length === 0) {
  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(source, target, { recursive: true, force: true });
}
