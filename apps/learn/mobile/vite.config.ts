import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const composioKey = env.COMPOSIO_API_KEY || env.VITE_COMPOSIO_API_KEY || "";
  const groqKey = env.GROQ_API_KEY || env.VITE_GROQ_API_KEY || "";
  const routerUrl = env.VITE_CONST_ROUTER_BASE_URL || env.CONST_ROUTER_BASE_URL || "https://router.const.web.id/v1";
  const engineUrl = env.VITE_CONST_ENGINE_BASE_URL || "https://engine.const.web.id/v1";
  const engineKey = env.VITE_CONST_ENGINE_API_KEY || "";
  const accountsUrl = env.VITE_ACCOUNTS_URL || "https://accounts.const.web.id";
  const convexUrl = env.VITE_CONVEX_URL || "";

  return {
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
      "process.env.COMPOSIO_API_KEY": JSON.stringify(composioKey),
      "process.env.VITE_COMPOSIO_API_KEY": JSON.stringify(composioKey),
      "process.env.GROQ_API_KEY": JSON.stringify(groqKey),
      "process.env.VITE_GROQ_API_KEY": JSON.stringify(groqKey),
      "process.env.CONST_ROUTER_BASE_URL": JSON.stringify(routerUrl),
      "process.env.VITE_CONST_ROUTER_BASE_URL": JSON.stringify(routerUrl),
      "process.env.VITE_CONST_ENGINE_BASE_URL": JSON.stringify(engineUrl),
      "process.env.VITE_CONST_ENGINE_API_KEY": JSON.stringify(engineKey),
      "process.env.VITE_ACCOUNTS_URL": JSON.stringify(accountsUrl),
      "process.env.VITE_CONVEX_URL": JSON.stringify(convexUrl),
      "process.env": JSON.stringify({
        COMPOSIO_API_KEY: composioKey,
        VITE_COMPOSIO_API_KEY: composioKey,
        GROQ_API_KEY: groqKey,
        VITE_GROQ_API_KEY: groqKey,
        CONST_ROUTER_BASE_URL: routerUrl,
        VITE_CONST_ROUTER_BASE_URL: routerUrl,
        VITE_CONST_ENGINE_BASE_URL: engineUrl,
        VITE_CONST_ENGINE_API_KEY: engineKey,
        VITE_ACCOUNTS_URL: accountsUrl,
        VITE_CONVEX_URL: convexUrl,
      }),
    },
  };
});
