const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const source = path.join(
  path.dirname(require.resolve("@excalidraw/excalidraw")),
  "fonts",
);
const target = path.join(root, "public", "excalidraw-assets", "fonts");
fs.mkdirSync(target, { recursive: true });
fs.cpSync(source, target, { recursive: true, force: true });
