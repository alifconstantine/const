import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig(({ command }) => ({
  plugins: [react()],
  define: command === "build" ? { "process.env": JSON.stringify({ NODE_ENV: "production" }) } : undefined,
  build: {
    rollupOptions: { input: path.resolve(import.meta.dirname, "remote-workspace.html") },
    reportCompressedSize: false,
  },
  optimizeDeps: { entries: ["tests/remote-workspace.html"] },
  resolve: {
    alias: [
      {
        find: "convex/react",
        replacement: path.resolve(
          import.meta.dirname,
          "remote-convex.fixture.tsx",
        ),
      },
      {
        find: "@const/agent/token-meter",
        replacement: path.resolve(
          import.meta.dirname,
          "../../../../packages/agent/src/const/token-meter.ts",
        ),
      },
      {
        find: "@const/agent",
        replacement: path.resolve(
          import.meta.dirname,
          "../../../../packages/agent/src/const/index.ts",
        ),
      },
      { find: "@", replacement: path.resolve(import.meta.dirname, "../src") },
    ],
  },
  server: { host: "127.0.0.1", port: 5198, strictPort: true },
}));
