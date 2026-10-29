import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const accountsUrl = env.VITE_ACCOUNTS_URL || "https://accounts.const.web.id";
  const convexUrl = env.VITE_CONVEX_URL || "https://frequent-lemming-260.convex.cloud";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 3012,
      host: true,
    },
    define: {
      "process.env.VITE_ACCOUNTS_URL": JSON.stringify(accountsUrl),
      "process.env.VITE_CONVEX_URL": JSON.stringify(convexUrl),
    },
  };
});
