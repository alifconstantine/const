# Intelligence UI

The main chat and side chat share `AssistantResponse`. Ordinary Markdown keeps
its existing renderer; explicit `openui-lang` fences render with OpenUI's React
runtime. User messages and normal code examples are never interpreted as UI.

`schema.ts` defines the allowed components and positional prop order. The
generated prompt fixture (`prompt.ts`), bundled Intelligence UI skill reference,
and React library (`library.tsx`) use the component contracts. The full OpenUI
reference is loaded through the skill when needed, rather than injected into
every Electron system prompt. Regenerate it with `generate:intelligence-prompt`.
Existing tools and agent permissions remain in the agent
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

## Live model verification

`pnpm --filter @const/harness-desktop test:intelligence-ui:live --check-config`
shows the selected model, provider host, and whether a credential is configured.
Remove `--check-config` to make one streaming request using synthetic project
data, with no tools or private conversation history. The test checks all seven
component types and writes a JSON artifact to a fresh temporary directory.
`--output <new-file-path>` selects another output file without overwriting it.

The test reads the desktop provider configuration and supports
`INTELLIGENCE_UI_MODEL`, `INTELLIGENCE_UI_BASE_URL`, and `CONST_ROUTER_API_KEY`
overrides. It uses the configured API key when present, and otherwise sends a
normal request without an Authorization header. Providers requiring
authentication need a configured key; desktop login cookies are not read.
Credentials and provider error payloads are never printed or saved.

To inspect the real result in both panel widths, set
`INTELLIGENCE_UI_LIVE_RESULT` to the JSON artifact path, run
`test:intelligence-ui:preview`, and open
`http://127.0.0.1:5189/tests/intelligence-ui.html?live=1`. The local fixture serves
only generated text and the model label. Form state uses a separate storage key.
This validates live generation and the shared response renderer; native Electron
IPC and model responses after a real form submission are separate integration
checks.
