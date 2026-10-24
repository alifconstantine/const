# Intelligence UI

The main chat and side chat share `AssistantResponse`. Ordinary Markdown keeps
its existing renderer; explicit `openui-lang` fences render with OpenUI's React
runtime. User messages and normal code examples are never interpreted as UI.

`schema.ts` defines the allowed components and positional prop order. Both the
Electron system prompt (`prompt.ts`) and React library (`library.tsx`) derive
from these contracts. Existing tools and agent permissions remain in the agent
execution path. This library exposes no tool provider or arbitrary code/HTML.
Every rendered component also validates its props with Zod: the streaming parser
alone does not enforce constraints such as array limits or identifier patterns.

Available components: `Stack`, `Text`, `Card`, `Metric`, `Table`, `BarChart`, and
`Form`. Tables share the same searchable, sortable, exportable presentation as
Markdown tables. Charts use a zero baseline and support signed values.

```openui-lang
root = Stack([summary, changes])
summary = Metric("Files changed", "2", "From the inspected diff")
changes = Table("Changes", ["File", "Purpose"], [["App.tsx", "Main chat"], ["side-chat-tab.tsx", "Side chat"]])
```

Form state lives on its assistant message in `intelligenceUiState`, keyed by the
block's character offset. That keeps multiple blocks and chat threads separate.
Raw-history normalization shifts offsets when joining assistant messages. Forms
are disabled during execution, on incomplete or invalid output, and in read-only
views. A submission becomes a user message in the originating conversation and
uses that conversation's existing model, workspace, and mode. Search/sort/chart
view preferences are local to a mounted view; form values persist with history.

Completed invalid output retains surrounding Markdown and any renderable
components, with a localized notice and inspectable source. Cancelled unclosed
blocks cannot submit actions. Copy and side-to-main transfer project valid UI
into readable text instead of copying the program.

## Verification

From the repository root:

```sh
pnpm --filter @const/harness-desktop test:intelligence-ui
pnpm --filter @const/harness-desktop check-types
pnpm --filter @const/harness-desktop build
pnpm --filter @const/harness-desktop test:intelligence-ui:preview
```

The last command serves the browser fixture at
`http://127.0.0.1:5189/tests/intelligence-ui.html`. It uses fixture data and makes
no model requests. Verify both panel widths, table search/sort/expand, signed
chart values, form submission routing, reload/remount restoration, and the busy,
streaming, and invalid-output controls. Fixture state uses its own localStorage
key and does not alter application conversations.

OpenUI packages are pinned to 1.0.1. The optional install telemetry script is
disabled through the workspace's build-script policy. The runtime's automatic
CDN inspector is suppressed in desktop development; no cloud service is needed.
Actual UI generation still depends on the selected model following the supplied
schema and framing instructions.
