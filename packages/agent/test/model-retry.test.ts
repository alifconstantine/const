import { expect, it } from "vitest";
import { isPermanentQuotaResponse } from "../src/const/model-retry.js";

it("distinguishes permanent account limits from transient rate limits without consuming the error", async () => {
  for (const message of ["Weekly free token quota exceeded. Select a paid model or wait for reset.", "Daily API key limit reached", "insufficient_quota"]) {
    const response = Response.json({ error: { message } }, { status: 429 });
    expect(await isPermanentQuotaResponse(response)).toBe(true);
    expect(await response.json()).toEqual({ error: { message } });
  }
  expect(await isPermanentQuotaResponse(Response.json({ error: "Too many requests" }, { status: 429 }))).toBe(false);
  expect(await isPermanentQuotaResponse(new Response("server error", { status: 503 }))).toBe(false);
});
