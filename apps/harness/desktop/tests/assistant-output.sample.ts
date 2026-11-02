/** A deterministic specimen for human review; no model or project execution. */
export const outputCodeSample = 'const marker = "@[Report](outputs/report.html)";\nconsole.log(marker);';

export const assistantOutputSample = [
  "The hero page is ready to preview.",
  "[Open result](outputs/04-driftlab/index.html)",
  "## What changed",
  "- One self-contained HTML page with a scroll-driven hero.\n- Responsive layout and reduced-motion support.\n- A compact summary keeps shader parameters in the optional section below.",
  "## Verification",
  "This is a UI review sample. No model request, project build, or server check was performed for this sample.",
  "## Implementation details",
  "Inline code stays literal: `@[Report](outputs/report.html)`. An authored mention still opens a file: @[Brief](docs/brief.md).",
  "### JavaScript",
  "```javascript\n" + outputCodeSample + "\n```",
  "### HTML safety",
  '```html\n<img src="x" onerror="window.__outputXss = true">\n```',
  "### Structured notes",
  "> - Inspect the preview at desktop and mobile widths.\n> - Keep quoted lists and code as real Markdown blocks.\n>\n> ```ts\n> const nested = true;\n> ```",
  "3. Preserve ordered-list numbering.\n4. Support keyboard focus and touch controls.",
  "| View | Layout |\n| --- | --- |\n| Desktop | Wide content and sidebar |\n| Mobile | Single column |",
  "## Remaining limitations",
  "The preview uses fixture files so you can inspect the interface without account access. [Open image](assets/preview.png).",
].join("\n\n");
