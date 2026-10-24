// Visual fixtures use real view components and UI primitives, without a login bypass in the app.
const fs = require("node:fs"),
  path = require("node:path");
const { sourceLoader, appRequire, root } = require("./source-loader.cjs");
const React = appRequire("react"),
  { renderToStaticMarkup } = appRequire("react-dom/server");
const overrides = {
  "@const/ui/lib/utils": null,
  "@const/ui": null,
  "@const/backend/_generated/api": { api: {} },
  "@/components/providers/convex-client-provider": {
    useRouterAuth: () => ({ isAuthenticated: false }),
  },
};
const load = sourceLoader(overrides);
overrides["@const/ui/lib/utils"] = load("packages/ui/src/lib/utils.ts");
const ui = {};
for (const name of ["button", "badge", "skeleton", "scroll-area", "input"])
  Object.assign(ui, load("packages/ui/src/components/ui/" + name + ".tsx"));
ui.toast = { success() {}, error() {} };
overrides["@const/ui"] = ui;
const { CreditsView } = load(
    "apps/router/src/app/(dashboard)/credits/page.tsx",
  ),
  { ModelCatalog } = load("apps/router/src/app/(dashboard)/models/page.tsx");
const chunks = path.join(root, "apps/router/.next/static/chunks");
const css = fs
  .readdirSync(chunks)
  .filter((p) => p.endsWith(".css"))
  .map((p) => fs.readFileSync(path.join(chunks, p), "utf8"))
  .join("\n")
  .replace(/@import[^;]+;/g, "");
const output = path.resolve(root, "apps/router/.next/router-qa");
fs.mkdirSync(output, { recursive: true });
function write(name, element) {
  fs.writeFileSync(
    path.join(output, name + ".html"),
    '<!doctype html><html class="dark" lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Router ' +
      name +
      " QA</title><style>" +
      css +
      "\nbody{font-family:Inter,Arial,sans-serif;background:hsl(var(--background));color:hsl(var(--foreground));margin:0}main{padding:32px;max-width:1280px;margin:auto}@media(max-width:600px){main{padding:20px}}</style></head><body><main>" +
      renderToStaticMarkup(element) +
      "</main></body></html>",
  );
}
write(
  "credits-empty",
  React.createElement(CreditsView, {
    wallet: {
      balanceUsd: 0,
      availableUsd: 0,
      reservedUsd: 0,
      totalDepositedUsd: 0,
      totalSpentUsd: 0,
    },
    transactions: [],
  }),
);
write(
  "credits-history",
  React.createElement(CreditsView, {
    wallet: {
      balanceUsd: 14.30251,
      availableUsd: 14.28251,
      reservedUsd: 0.02,
      totalDepositedUsd: 20,
      totalSpentUsd: 5.69749,
    },
    transactions: [
      {
        _id: "example",
        type: "deduction",
        amountUsd: 0.00001234,
        balanceAfterUsd: 14.30251,
        status: "completed",
        description: "gpt-6.1-sol usage",
        requestId: "req_example",
        createdAt: Date.UTC(2026, 9, 25, 0, 0),
      },
    ],
  }),
);
write("models", React.createElement(ModelCatalog, {}));
console.log("Rendered fixtures in " + output);
