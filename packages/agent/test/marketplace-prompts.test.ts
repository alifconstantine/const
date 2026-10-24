import { describe, expect, it, vi } from "vitest";
vi.mock("../../../apps/harness/desktop/src/lib/db.ts", () => ({ db: {} }));
import { extractSkillsAndAugmentPrompt } from "../../../apps/harness/desktop/src/lib/skills/skills-service.ts";
import type { LocalSkill } from "../../../apps/harness/desktop/src/lib/skills/types.ts";

const skill: LocalSkill = {
  id: "skill-pdf",
  slug: "pdf",
  name: "PDF",
  description: "Process PDF files",
  content: "Read the PDF workflow.",
  category: "document",
  isBuiltIn: false,
  isEnabled: true,
  createdAt: 0,
  updatedAt: 0,
};

describe("marketplace skill prompt activation", () => {
  it("does not activate skills from URLs, absolute paths, or filenames", () => {
    for (const prompt of [
      "Read https://example.com/pdf",
      "Open /pdf/reference.md",
      "Read /pdf.py",
      "Look at dir/pdf",
      "Use /pdf-helper",
    ]) {
      expect(
        extractSkillsAndAugmentPrompt(prompt, [skill]).matchedSkills,
      ).toHaveLength(0);
    }
  });
  it("activates explicit slash mentions and serialized badges exactly once", () => {
    for (const prompt of [
      "/pdf process this",
      "Use /pdf.",
      "/[PDF](skill://pdf) /pdf",
    ]) {
      const result = extractSkillsAndAugmentPrompt(prompt, [skill]);
      expect(result.matchedSkills).toEqual([skill]);
      expect(result.augmentedPrompt).toContain(skill.content);
    }
  });
  it("cannot invoke a disabled skill through a badge or slash command", () => {
    expect(
      extractSkillsAndAugmentPrompt("/[PDF](skill://pdf) /pdf", [
        { ...skill, isEnabled: false },
      ]).matchedSkills,
    ).toHaveLength(0);
  });
});
