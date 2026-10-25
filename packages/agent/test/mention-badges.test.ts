import { describe, expect, it, vi } from "vitest";
vi.mock("@const/ui", () => ({ cn: (...values: string[]) => values.join(" ") }));
vi.mock("../../../apps/harness/desktop/src/lib/i18n.tsx", () => ({
  translate: () => "Plugin: {name}", useI18n: () => ({ t: () => "" }),
}));
import { renderMentionBadgeHtml } from "../../../apps/harness/desktop/src/components/workbench/rich-mention-editor.tsx";

describe("plugin mention markup", () => {
  it("keeps the plugin identity, icon, and translated tooltip", () => {
    const html = renderMentionBadgeHtml({ href: "plugin://hyperframes", title: "HyperFrames", kind: "plugin" });
    expect(html).toContain('data-mention-kind="plugin"');
    expect(html).toContain('<svg');
    expect(html).toContain('M10 22V7');
    expect(html).toContain('title="Plugin: HyperFrames"');
  });
  it("escapes names and paths instead of creating injected HTML or attributes", () => {
    const html = renderMentionBadgeHtml({ href: 'plugin://hyperframes" onclick="alert(1)', title: '<img src=x onerror="alert(1)">', kind: "plugin" });
    expect(html).toContain("&lt;img");
    expect(html).toContain("&quot;");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain('" onclick="');
  });
});
