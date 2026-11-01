// Local-only browser fixtures. Production routes and authentication are never changed.
const path = require("node:path");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const { pathToFileURL } = require("node:url");
const appRoot = path.resolve(__dirname, "..");
const workspace = path.resolve(appRoot, "../..");
const harnessRequire = createRequire(
  path.join(workspace, "apps/harness/desktop/package.json"),
);
const appRequire = createRequire(path.join(appRoot, "package.json"));

async function main() {
  const { createServer } = await import(
    pathToFileURL(harnessRequire.resolve("vite")).href
  );
  const { default: react } = await import(
    pathToFileURL(harnessRequire.resolve("@vitejs/plugin-react")).href
  );
  process.chdir(appRoot);
  // Reuse next/font's downloaded Latin font, if Next has run in this checkout.
  const mediaDir = path.join(appRoot, ".next/dev/static/media");
  const font = fs.existsSync(mediaDir)
    ? fs
        .readdirSync(mediaDir)
        .find((file) => file.startsWith("a343f882") && file.endsWith(".woff2"))
    : null;
  const fontStyle =
    (font
      ? `@font-face{font-family:Manrope;font-style:normal;font-weight:200 800;font-display:swap;src:url('/@fs/${path.join(mediaDir, font).replaceAll("\\", "/")}') format('woff2')}`
      : "") +
    "html{--font-sans:Manrope,Arial,sans-serif}body{margin:0;font-family:var(--font-sans)}";
  const server = await createServer({
    configFile: false,
    root: appRoot,
    plugins: [
      react(),
      {
        name: "router-fixture-pages",
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (!(req.headers.accept || "").includes("text/html"))
              return next();
            const html = await server.transformIndexHtml(
              req.url,
              '<!doctype html><html lang="en" class="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Const Router UI fixture</title><style>' +
                fontStyle +
                '</style></head><body><div id="root"></div><script type="module" src="/tests/fixture-entry.tsx"></script></body></html>',
            );
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/html");
            res.end(html);
          });
        },
      },
    ],
    resolve: {
      alias: [
        {
          find: "next/link",
          replacement: path.join(__dirname, "fixture-next-link.tsx"),
        },
        {
          find: "next/navigation",
          replacement: path.join(__dirname, "fixture-navigation.ts"),
        },
        {
          find: /^convex\/react$/,
          replacement: path.join(__dirname, "fixture-convex.ts"),
        },
        {
          find: "@/components/providers/convex-client-provider",
          replacement: path.join(__dirname, "fixture-auth.tsx"),
        },
        {
          find: "@/",
          replacement: path.join(appRoot, "src/").replaceAll("\\", "/"),
        },
      ],
      dedupe: ["react", "react-dom", "convex"],
    },
    css: {
      postcss: {
        plugins: [
          appRequire("tailwindcss")({
            config: path.join(appRoot, "tailwind.config.ts"),
          }),
          appRequire("autoprefixer")(),
        ],
      },
    },
    server: {
      host: "127.0.0.1",
      port: 5192,
      strictPort: true,
      fs: { allow: [workspace] },
    },
    define: {
      "process.env.NEXT_PUBLIC_CONVEX_URL": '"https://fixture.invalid"',
      "process.env.NODE_ENV": '"development"',
    },
  });
  await server.listen();
  console.log(
    "Router UI fixtures: http://127.0.0.1:5192/dashboard (also /models, /credits, /endpoints, /settings, /generation; ?state=empty|loading|error)",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
