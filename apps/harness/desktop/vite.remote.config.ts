import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
  base: "/remote/",
  plugins: [react()],
  // OpenUI also reads process.env["NODE_ENV"], which a dotted define misses.
  // Only this fixed public value is embedded; no host environment is exposed.
  define: { "process.env": JSON.stringify({ NODE_ENV: "production" }) },
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(import.meta.dirname, "src") },
      {
        find: "@const/agent/token-meter",
        replacement: path.resolve(
          import.meta.dirname,
          "../../../packages/agent/src/const/token-meter.ts",
        ),
      },
      {
        find: "@const/agent",
        replacement: path.resolve(
          import.meta.dirname,
          "../../../packages/agent/src/const/index.ts",
        ),
      },
    ],
  },
  build: {
    outDir: "../web/public/remote",
    emptyOutDir: true,
    reportCompressedSize: false,
    minify: "esbuild",
    cssCodeSplit: false,
    lib: {
      entry: "src/remote-entry.tsx",
      formats: ["es"],
      fileName: () => "workspace.js",
      cssFileName: "workspace",
    },
  },
});
