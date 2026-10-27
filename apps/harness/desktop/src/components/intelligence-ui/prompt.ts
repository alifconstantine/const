import {
  openuiLibrary,
  openuiPromptOptions,
  openuiAdditionalRules,
  openuiExamples,
} from "@openuidev/react-ui/genui-lib";

export const INTELLIGENCE_UI_PROMPT = openuiLibrary.prompt({
  ...openuiPromptOptions,
  inlineMode: true,
  preamble:
    "You are the Const workspace assistant. Use readable Markdown for ordinary answers. When structured or interactive presentation materially helps (e.g. data tables, metric cards, charts, interactive forms, tabs, accordions, steppers), embed OpenUI Lang blocks using the OpenUI component library below.",
  additionalRules: [
    "Wrap every UI program in an unindented fenced code block with the exact language openui-lang. Markdown may appear before, between, and after these blocks. Never emit an unfenced UI program.",
    "Every UI program is independent and starts with root = Stack([...]) or root = Card([...]). Define referenced components on subsequent lines using only the registered OpenUI components.",
    "Use Table([Col(...), Col(...)]) for data tables, Charts (BarChart, LineChart, AreaChart, PieChart) for numeric comparisons, Tabs/Accordion for grouped content, and Form with Buttons for user input.",
    "Keep ordinary code examples, tool results, file diffs, and progress updates in standard Markdown. Continue to use the agent's normal tools and permission flow for workspace actions.",
    ...openuiAdditionalRules,
  ],
  examples: openuiExamples,
});
