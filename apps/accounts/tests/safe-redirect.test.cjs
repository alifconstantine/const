const { test } = require("node:test");
const assert = require("node:assert/strict");
const { sourceLoader } = require("../../router/tests/source-loader.cjs");
const { getSafeRedirectUrl } = sourceLoader()("apps/accounts/src/lib/safe-redirect.ts");

test("production authentication rejects untrusted deployments and insecure redirects", () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    for (const target of ["https://attacker.vercel.app/callback", "http://harness.const.web.id", "https://const.web.id.evil.example", "https://user:pass@const.web.id", "http://192.168.1.2/callback", "http://localhost:3012/", "/\\evil.example", "/\t/evil.example"])
      assert.equal(getSafeRedirectUrl(target, { allowRelative: true }), null, target);
    for (const target of ["https://harness.const.web.id/r/session", "const-harness://callback", "http://127.0.0.1:24139/callback", "/settings"])
      assert.equal(getSafeRedirectUrl(target, { allowRelative: true }), target);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
