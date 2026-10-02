import { describe, it, expect } from "vitest";
import path from "node:path";
import {
  convertHtmlToMarkdown,
  executeWebSearch,
  executeWebFetch,
} from "../src/const/web.js";
import { executeNativeTool } from "../src/const/tools.js";

describe("Web Research Tools (web_search & web_fetch)", () => {
  const workspaceRoot = path.resolve(__dirname, "..");

  describe("HTML to Markdown converter", () => {
    it("should convert basic HTML formatting to Markdown", () => {
      const html = `
        <html>
          <head><title>Test Page</title><script>alert('bad');</script></head>
          <body>
            <h1>Heading 1</h1>
            <p>This is a <strong>bold</strong> and <em>italic</em> text with a <a href="https://example.com">link</a>.</p>
            <ul>
              <li>Item 1</li>
              <li>Item 2</li>
            </ul>
            <pre><code>const x = 42;</code></pre>
          </body>
        </html>
      `;

      const md = convertHtmlToMarkdown(html);
      expect(md).toContain("# Heading 1");
      expect(md).toContain("**bold**");
      expect(md).toContain("*italic*");
      expect(md).toContain("[link](https://example.com)");
      expect(md).toContain("- Item 1");
      expect(md).toContain("- Item 2");
      expect(md).toContain("```");
      expect(md).toContain("const x = 42;");
      expect(md).not.toContain("alert('bad');");
    });
  });

  describe("web_search tool", () => {
    it("should search web and return structured sources", async () => {
      const result = await executeWebSearch("TypeScript", 3);
      expect(result.query).toBe("TypeScript");
      expect(result.sources.length).toBeGreaterThan(0);
      expect(result.formatted).toContain("[web_search");
      expect(result.sources[0].url).toBeDefined();
    }, 20000);

    it("should route through executeNativeTool router", async () => {
      const res = await executeNativeTool(
        "web_search",
        {
          query: "Node.js official website",
          num_results: 2,
        },
        workspaceRoot
      );

      expect(res.isError).toBe(false);
      expect(res.result).toContain("[web_search");
    }, 20000);
  });

  describe("web_fetch tool", () => {
    it("should fetch a live page and convert it to clean Markdown", async () => {
      const result = await executeWebFetch("https://example.com", 5000);
      expect(result.url).toBe("https://example.com");
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.formatted).toContain("Example Domain");
    }, 20000);

    it("should route through executeNativeTool router", async () => {
      const res = await executeNativeTool(
        "web_fetch",
        {
          url: "https://example.com",
        },
        workspaceRoot
      );

      expect(res.isError).toBe(false);
      expect(res.result).toContain("[web_fetch");
      expect(res.result).toContain("Example Domain");
    }, 20000);

    it("should handle invalid URL gracefully", async () => {
      const res = await executeNativeTool(
        "web_fetch",
        {
          url: "https://this-domain-does-not-exist-at-all-xyz123987.org",
        },
        workspaceRoot
      );

      expect(res.isError).toBe(true);
      expect(res.result).toContain("Failed to fetch URL");
    }, 20000);
  });
});
