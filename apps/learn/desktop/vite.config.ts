import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const composioKey = env.COMPOSIO_API_KEY || env.VITE_COMPOSIO_API_KEY || "";
  const groqKey = env.GROQ_API_KEY || env.VITE_GROQ_API_KEY || "";
  const routerUrl = env.CONST_ROUTER_BASE_URL || env.VITE_CONST_ROUTER_BASE_URL || "https://router.const.web.id/v1";
  const accountsUrl = env.VITE_ACCOUNTS_URL || "https://accounts.const.web.id";
  const convexUrl = env.VITE_CONVEX_URL || "";

  const sharedDefine = {
    "process.env.COMPOSIO_API_KEY": JSON.stringify(composioKey),
    "process.env.VITE_COMPOSIO_API_KEY": JSON.stringify(composioKey),
    "process.env.GROQ_API_KEY": JSON.stringify(groqKey),
    "process.env.VITE_GROQ_API_KEY": JSON.stringify(groqKey),
    "process.env.CONST_ROUTER_BASE_URL": JSON.stringify(routerUrl),
    "process.env.VITE_CONST_ROUTER_BASE_URL": JSON.stringify(routerUrl),
    "process.env.VITE_ACCOUNTS_URL": JSON.stringify(accountsUrl),
    "process.env.VITE_CONVEX_URL": JSON.stringify(convexUrl),
  };

  return {
    base: "./",
    define: sharedDefine,
    plugins: [
      react(),
      electron([
        {
          entry: "electron/main.ts",
          vite: {
            define: sharedDefine,
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
            define: sharedDefine,
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
  };
});
