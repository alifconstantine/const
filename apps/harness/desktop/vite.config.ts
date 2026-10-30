import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron";
import path from "node:path";

export default defineConfig({
  base: "./",
  // Electron ships these assets locally; gzip reporting adds costly work for large diagram chunks.
  build: { reportCompressedSize: false, emptyOutDir: true },
  plugins: [
    react(),
    electron([
      {
        entry: "electron/main.ts",
        async onstart(args) {
          await args.startup([path.resolve(__dirname)]);
        },
        vite: {
          build: {
            outDir: "dist-electron",
            emptyOutDir: true,
            reportCompressedSize: false,
            // Keep ws's optional native addons inside its guarded Node require().
            // Bundling them creates eager Vite error stubs and crashes Electron.
            rollupOptions: { external: ["ws"] },
          },
          resolve: {
            alias: [
              { find: "@const/agent/token-meter", replacement: path.resolve(__dirname, "../../../packages/agent/src/const/token-meter.ts") },
              { find: "@const/agent", replacement: path.resolve(__dirname, "../../../packages/agent/src/const/index.ts") },
              { find: "@const/remote", replacement: path.resolve(__dirname, "../../../packages/remote/src") },
            ],
          },
        },
      },
      {
        entry: "electron/preload.ts",
        onstart(args) {
          args.reload();
        },
        vite: {
          build: {
            outDir: "dist-electron",
            emptyOutDir: false,
            reportCompressedSize: false,
          },
        },
      },
    ]),
  ],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      { find: "@const/agent/token-meter", replacement: path.resolve(__dirname, "../../../packages/agent/src/const/token-meter.ts") },
      { find: "@const/agent", replacement: path.resolve(__dirname, "../../../packages/agent/src/const/index.ts") },
      { find: "@const/remote", replacement: path.resolve(__dirname, "../../../packages/remote/src") },
    ],
  },
});
