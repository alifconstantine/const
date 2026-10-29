import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";

// Isolated browser fixture: no Electron process, credentials, or model calls.
export default defineConfig({
  optimizeDeps: {
    entries: process.env.CONST_FIXTURE_ENTRY || "tests/intelligence-ui.html",
    include: [
      "react",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "lucide-react",
      "@thesvg/react",
      "@iconify/react",
      "@openuidev/react-ui/genui-lib",
      "@openuidev/react-lang",
      "@openuidev/lang-core",
      "dompurify",
      "marked",
      "mermaid",
    ],
    // Restrict scanning to the selected fixture rather than every desktop page.
  },
  plugins: [
    react(),
    {
      name: "intelligence-ui-live-result",
      configureServer(server) {
        server.middlewares.use("/__excalidraw-fixture", (request, response) => {
          response.setHeader("Content-Type", "application/json");
          response.setHeader("Cache-Control", "no-store");
          const file = process.env.EXCALIDRAW_FIXTURE;
          if (request.method !== "GET" || !file) {
            response.statusCode = 404;
            response.end("{}");
            return;
          }
          try {
            response.end(fs.readFileSync(file, "utf8"));
          } catch {
            response.statusCode = 500;
            response.end("{}");
          }
        });
        server.middlewares.use(
          "/__intelligence-ui-live",
          (request, response) => {
            const file = process.env.INTELLIGENCE_UI_LIVE_RESULT;
            response.setHeader("Content-Type", "application/json");
            response.setHeader("Cache-Control", "no-store");
            if (request.method !== "GET") {
              response.statusCode = 405;
              response.end("{}");
              return;
            }
            if (!file) {
              response.statusCode = 404;
              response.end("{}");
              return;
            }
            try {
              const result = JSON.parse(fs.readFileSync(file, "utf8"));
              if (typeof result.content !== "string")
                throw new Error("Invalid result");
              // Only serve the generated text and model label, never configuration.
              response.end(
                JSON.stringify({
                  content: result.content,
                  model: result.model,
                }),
              );
            } catch {
              response.statusCode = 500;
              response.end("{}");
            }
          },
        );
      },
    },
  ],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "../src") } },
  server: { host: "127.0.0.1", port: 5189, strictPort: true, open: false },
});
