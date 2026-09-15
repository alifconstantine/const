import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron";
import path from "node:path";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    electron([
      {
        entry: "electron/main.ts",
        vite: {
          build: {
            outDir: "dist-electron",
          },
          resolve: {
            alias: {
              "@const/agent/models": path.resolve(__dirname, "../../../packages/agent/src/const/models.ts"),
              "@const/agent/types": path.resolve(__dirname, "../../../packages/agent/src/const/types.ts"),
              "@const/agent": path.resolve(__dirname, "../../../packages/agent/src/const/index.ts"),
            },
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
          },
        },
      },
    ]),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@const/agent/models": path.resolve(__dirname, "../../../packages/agent/src/const/models.ts"),
      "@const/agent/types": path.resolve(__dirname, "../../../packages/agent/src/const/types.ts"),
      "@const/agent": path.resolve(__dirname, "../../../packages/agent/src/const/index.ts"),
    },
  },
  server: {
    port: 3004,
    host: true,
    proxy: {
      "/v1": {
        target: "https://router.const.web.id",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
