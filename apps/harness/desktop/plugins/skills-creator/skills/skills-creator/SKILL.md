---
name: skills-creator
description: Create or improve reusable agent skills for Const Harness. Use when a user wants to capture a repeated workflow, repair a skill, or validate its instructions and resources.
---

Inspect the user's workflow and existing skill first. Preserve their purpose and scope. Create a folder with `SKILL.md`, YAML frontmatter containing a specific `name` and `description`, and concise instructions that change the agent's decisions. Explain when the skill applies without attracting unrelated tasks.

Prefer a short self-contained skill. Add `references/`, `scripts/`, or `assets/` only for resources the workflow needs. Resolve references relative to the skill folder. Keep secrets out of all packaged files. A skill supplies instructions; it cannot create MCP tools or grant execution permissions by naming them.

For external services, inspect the available tools or current primary documentation before naming commands, endpoints, or tool arguments. Distinguish requirements from suggestions. Keep approvals proportional to real actions and do not introduce extra onboarding for an explanation-only request.

Validate YAML, referenced paths, and executable scripts. Exercise representative tasks and check likely misrouting cases. If the user asked only to create the skill, return its location and validation; install it only in the scope they requested (`.agents/skills` for a workspace or `~/.const/harness/skills` for the local user). Do not duplicate a skill already provided by a plugin.
