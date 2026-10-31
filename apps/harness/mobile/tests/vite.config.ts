import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "convex/browser": path.resolve(import.meta.dirname, "convex.fixture.ts") } },
  optimizeDeps: { entries: ["tests/mobile.html"] },
  server: { host: "127.0.0.1", port: 5199, strictPort: true },
});
