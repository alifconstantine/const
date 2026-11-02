import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({ plugins: [react()],
  build: { rollupOptions: { input: path.resolve(import.meta.dirname, "app-updates.html") }, reportCompressedSize: false },
  server: { host: "127.0.0.1", port: 5197, strictPort: true },
});
