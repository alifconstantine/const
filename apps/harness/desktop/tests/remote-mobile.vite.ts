import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
  root: path.resolve(import.meta.dirname, "../../web"),
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@const/remote/client",
        replacement: path.resolve(
          import.meta.dirname,
          "../../web/tests/remote-client.fixture.ts",
        ),
      },
      {
        find: "@",
        replacement: path.resolve(import.meta.dirname, "../../web/src"),
      },
    ],
  },
  server: { host: "127.0.0.1", port: 5198, strictPort: true },
});
