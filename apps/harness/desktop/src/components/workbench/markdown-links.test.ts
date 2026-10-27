import assert from "node:assert/strict";
import test from "node:test";
import { resolveMarkdownLink } from "./markdown-links";

test("resolveMarkdownLink correctly resolves standard http and https URLs", () => {
  assert.deepEqual(resolveMarkdownLink("https://google.com"), {
    type: "web",
    url: "https://google.com",
  });
  assert.deepEqual(resolveMarkdownLink("http://example.com/page?query=1"), {
    type: "web",
    url: "http://example.com/page?query=1",
  });
});

test("resolveMarkdownLink ensures web URLs with trailing slashes are NOT classified as folders", () => {
  assert.deepEqual(resolveMarkdownLink("https://vitejs.dev/"), {
    type: "web",
    url: "https://vitejs.dev/",
  });
  assert.deepEqual(resolveMarkdownLink("http://localhost:3000/"), {
    type: "web",
    url: "http://localhost:3000/",
  });
  assert.deepEqual(resolveMarkdownLink("https://docs.github.com/en/"), {
    type: "web",
    url: "https://docs.github.com/en/",
  });
});

test("resolveMarkdownLink resolves localhost and IP addresses", () => {
  assert.deepEqual(resolveMarkdownLink("localhost:3000"), {
    type: "web",
    url: "http://localhost:3000",
  });
  assert.deepEqual(resolveMarkdownLink("localhost:5173/"), {
    type: "web",
    url: "http://localhost:5173/",
  });
  assert.deepEqual(resolveMarkdownLink("127.0.0.1:8080/app"), {
    type: "web",
    url: "http://127.0.0.1:8080/app",
  });
});

test("resolveMarkdownLink normalizes www and domain-like URLs to https", () => {
  assert.deepEqual(resolveMarkdownLink("www.const.web.id"), {
    type: "web",
    url: "https://www.const.web.id",
  });
  assert.deepEqual(resolveMarkdownLink("github.com/const/platform"), {
    type: "web",
    url: "https://github.com/const/platform",
  });
  assert.deepEqual(resolveMarkdownLink("//cdn.jsdelivr.net/npm/marked"), {
    type: "web",
    url: "https://cdn.jsdelivr.net/npm/marked",
  });
});

test("resolveMarkdownLink handles browser:// pseudo scheme", () => {
  assert.deepEqual(resolveMarkdownLink("browser://https://news.ycombinator.com"), {
    type: "web",
    url: "https://news.ycombinator.com",
  });
  assert.deepEqual(resolveMarkdownLink("browser://localhost:3000"), {
    type: "web",
    url: "http://localhost:3000",
  });
});

test("resolveMarkdownLink handles mailto and external links", () => {
  assert.deepEqual(resolveMarkdownLink("mailto:contact@const.web.id"), {
    type: "external",
    url: "mailto:contact@const.web.id",
  });
  assert.deepEqual(resolveMarkdownLink("tel:+1234567890"), {
    type: "external",
    url: "tel:+1234567890",
  });
});

test("resolveMarkdownLink correctly resolves trajectory and conversation links", () => {
  assert.deepEqual(resolveMarkdownLink("trajectory://convo_abc123"), {
    type: "trajectory",
    idOrPath: "convo_abc123",
  });
  assert.deepEqual(resolveMarkdownLink("conversation://convo_xyz789"), {
    type: "trajectory",
    idOrPath: "convo_xyz789",
  });
});

test("resolveMarkdownLink correctly resolves local folders and files", () => {
  assert.deepEqual(resolveMarkdownLink("folder:///D:/Code/Platform/apps/harness/"), {
    type: "folder",
    path: "D:/Code/Platform/apps/harness/",
  });
  assert.deepEqual(resolveMarkdownLink("src/components/workbench/"), {
    type: "folder",
    path: "src/components/workbench/",
  });
  assert.deepEqual(resolveMarkdownLink("file:///D:/Code/Platform/package.json"), {
    type: "file",
    path: "D:/Code/Platform/package.json",
  });
});

test("resolveMarkdownLink handles plugin protocol", () => {
  assert.deepEqual(resolveMarkdownLink("plugin://anthropic-claude"), {
    type: "plugin",
    id: "anthropic-claude",
  });
});
