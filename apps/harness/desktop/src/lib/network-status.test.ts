import assert from "node:assert/strict";
import test from "node:test";
import { isLocalProviderBaseUrl, isNetworkErrorText } from "./network-status";

test("isLocalProviderBaseUrl detects loopback and local hostnames only", () => {
  assert.equal(isLocalProviderBaseUrl("http://localhost:11434/v1"), true);
  assert.equal(isLocalProviderBaseUrl("http://127.0.0.1:1234/v1"), true);
  assert.equal(isLocalProviderBaseUrl("http://[::1]:8080/v1"), true);
  assert.equal(isLocalProviderBaseUrl("http://my-mac.local:11434/v1"), true);
  assert.equal(isLocalProviderBaseUrl("https://router.const.web.id/v1"), false);
  assert.equal(isLocalProviderBaseUrl("https://api.openai.com/v1"), false);
  assert.equal(isLocalProviderBaseUrl(""), false);
  assert.equal(isLocalProviderBaseUrl(undefined), false);
});

test("isNetworkErrorText identifies common offline and DNS/socket failures", () => {
  assert.equal(isNetworkErrorText("TypeError: fetch failed"), true);
  assert.equal(isNetworkErrorText("net::ERR_INTERNET_DISCONNECTED"), true);
  assert.equal(isNetworkErrorText("getaddrinfo ENOTFOUND router.const.web.id"), true);
  assert.equal(isNetworkErrorText("connect ECONNREFUSED 127.0.0.1:443"), true);
  assert.equal(isNetworkErrorText("Bad tool schema"), false);
  assert.equal(isNetworkErrorText("HTTP 401 Unauthorized"), false);
  assert.equal(isNetworkErrorText(undefined), false);
});
