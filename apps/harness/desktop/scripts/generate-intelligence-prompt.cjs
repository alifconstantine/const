const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function generate() {
  const libPath = path.resolve(__dirname, "../node_modules/@openuidev/react-ui/dist/genui-lib/index.mjs");
  const m = await import(pathToFileURL(libPath).href);
  const prompt = m.openuiLibrary.prompt({
    ...m.openuiPromptOptions,
    // Chat blocks are independent programs, not patches to a persistent canvas.
    inlineMode: false,
    editMode: false,
    preamble:
      "You are the Const workspace assistant. Use readable Markdown for ordinary answers. When structured or interactive presentation materially helps (e.g. data tables, metric cards, charts, interactive forms, tabs, accordions, steppers), embed OpenUI Lang blocks using the OpenUI component library below.",
    additionalRules: [
      "Wrap every UI program in an unindented fenced code block with the exact language openui-lang. Markdown may appear before, between, and after these blocks. Never emit an unfenced UI program.",
      "Every UI program is independent and starts with root = Stack([...]). Define referenced components on subsequent lines using only the registered OpenUI components. When revising a previous UI block, emit the complete replacement program including all its definitions; never emit only changed statements.",
      "Use Table([Col(...), Col(...)]) for data tables, Charts (BarChart, LineChart, AreaChart, PieChart) for numeric comparisons, Tabs/Accordion for grouped content, and Form with Buttons for user input.",
      "When illustrating processes, system architectures, workflows, sequence flows, ER database models, or state machines, use standard Markdown fenced code blocks with language ```mermaid (e.g. flowchart TD, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram). The desktop workspace renders valid Mermaid diagrams with interactive zoom, fullscreen, and SVG download.",
      'For Mermaid flowchart nodes, quote labels containing parentheses or other special characters, e.g. node["Label (Details)"]. Prefer plain text over HTML tags inside labels, and use the syntax appropriate to the chosen diagram type.',
      "When the user requests Excalidraw or another installed diagram app, use that app's available tools instead. For an existing app diagram, read its latest app context before making changes so user edits are preserved.",
      "Keep ordinary code examples, tool results, file diffs, and progress updates in standard Markdown. Continue to use the agent's normal tools and permission flow for workspace actions.",
      "Use data supplied by the user or verified tool results. If data is unavailable, state what is missing. Generate sample data only when the user requests it. Label sample data explicitly.",
      ...m.openuiAdditionalRules.filter(
        (rule) => rule !== "When asked about data, generate realistic/plausible data",
      ),
    ],
    examples: m.openuiExamples,
  });

  const outPath = path.resolve(__dirname, "../src/components/intelligence-ui/prompt-text.ts");
  fs.writeFileSync(outPath, "export const INTELLIGENCE_UI_PROMPT = " + JSON.stringify(prompt) + ";\n");
  const referencePath = path.resolve(__dirname, "../plugins/intelligence-ui/skills/intelligence-ui/references/openui.md");
  fs.mkdirSync(path.dirname(referencePath), { recursive: true });
  fs.writeFileSync(referencePath, prompt + "\n");
  console.log(`Generated ${outPath} (${prompt.length} chars)`);
}

generate().catch((err) => {
  console.error("Failed to generate intelligence prompt:", err);
  process.exit(1);
});
