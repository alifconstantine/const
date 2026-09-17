import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3003,
    host: true,
    proxy: {
      "/v1": {
        target: "https://router.const.web.id",
        changeOrigin: true,
        secure: false,
      },
      "/composio-api": {
        target: "https://backend.composio.dev",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/composio-api/, "/api/v3.1"),
        secure: false,
      },
    },
  },
  define: {
    "process.env": {},
  },
});
