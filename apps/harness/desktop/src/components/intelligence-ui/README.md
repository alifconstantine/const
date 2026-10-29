# Intelligence UI

Main chat and side chat share `AssistantResponse`. Only assistant output with an
explicit, top-level fence is interpreted as UI. Code examples nested inside a
longer fence remain code. Markdown and Mermaid keep their existing renderers.

## Presentation selection

- Markdown: direct answers, prose, code, progress, tool results and diffs.
- OpenUI (`openui-lang`): standard charts, tables, cards, forms and grouped content.
- Mermaid (`mermaid`): technical flowcharts, sequence, class, ER and state diagrams.
- Widgets (`const-widget`): custom calculators, simulations, interactive explanations,
  maps and 3D when the standard components do not meet the task.
- Excalidraw: use the installed app's tools when manual diagram editing is wanted.

The agent uses the existing desktop model and tools. No second routing provider,
Python service or CopilotKit runtime is required.

## One OpenUI catalog

`schema.ts` derives the native component signatures from the installed OpenUI
catalog and adds chat blocks without mutating the upstream registry. Library
extensions rewrite nested component references when adding validation. The prompt,
parser, preflight checks, production React wrappers and live-model validator use
these same contracts.

Electron imports only the generated `prompt-text.ts` string to keep startup light.
After changing `prompt-source.ts` or the catalog, regenerate it with
`pnpm --filter @const/harness-desktop exec tsx scripts/generate-intelligence-ui-prompt.ts`.
The prompt test checks that this generated text exactly matches the shared catalog
and current rules.

The current catalog has 86 entries including supporting components: layouts,
cards, tables/columns, editable tables, bar/line/area/pie/radar/radial/scatter
charts, forms and inputs, selection controls, images, modal and chat blocks.
This count is not a count of independent end-user features.

The former hand-written seven-component schema (Stack, Text, Card, Metric, Table,
BarChart and Form) has been removed. Shared names now resolve to upstream OpenUI
components with their native signatures; Metric is not registered. Clipboard
projection no longer carries the old Metric, table-row or chart-item formats.
An audit test checks every catalog entry and positional signature against the
installed upstream libraries.

Const-specific code implements framing, validation, state persistence, localization
and the widget host bridge. It adapts OpenIntelligentUI's sandbox patterns rather
than importing its application runtime. `response-table.tsx` is the active Markdown
table renderer, not an OpenUI component. Synthetic examples live in `tests/` and
are imported only by test/preview entry points, never the application runtime.

Native positional signatures are preserved. For example:

```openui-lang
root = Stack([summary, changes])
summary = Card([TextContent("Two files changed")])
changes = Table([files, purposes])
files = Col("File", ["App.tsx", "side-chat-tab.tsx"])
purposes = Col("Purpose", ["Main chat", "Side chat"])
```

Props are checked against Zod schemas in the production renderer. The validator
unwraps child element envelopes for Zod references but preserves those envelopes
for native rendering. Shared resource limits reject non-finite numbers, oversized
arrays/text, unsafe state identifiers and password inputs. Programs have a
200,000-character limit, arrays 500 items, tables 20 columns and forms 20 fields.
There is no OpenUI tool provider: Query/Mutation operations are rejected.
Busy, streaming, incomplete and read-only controls are inert and native inputs
receive the runtime's disabled state. Host action handlers also enforce it.
Native label/control IDs are scoped per rendered block without changing persisted
field names, including when the same response is visible in main and side chat.

## Custom widget contract

`const-widget` contains strict JSON version 1. Fields are ordered for streaming:
`version`, `title`, `description`, `css`, `html`, `js`, `initialState`, `libraries`.
Title, description, CSS, HTML and JS are required strings. State and libraries
default to an empty object and array. Unknown fields/capabilities are rejected.

Limits: total source 200,000 characters; CSS 40,000; HTML 100,000; JS 60,000;
state 32,000 characters. Put body markup in HTML and event listeners/module code
in JS. Scripts, iframe/object/embed elements and inline event handlers in the HTML
are removed by DOMPurify. Complete CSS/HTML values can render a script-free
preview before JS finishes. Partial or cancelled output never executes.

A completed valid widget runs in an opaque-origin `sandbox="allow-scripts"`
iframe with a nonce CSP, no same-origin access and no Electron/tool bridge.
The host validates window source, opaque origin, channel, message shape, bounds,
URLs and message rate. CSP is placed before generated content. It denies network
access by default; explicit library imports use a small pinned import map.

Optional libraries: `three`, `d3`, `chart.js`, `leaflet`. Use dynamic imports,
for example `const {default: Chart} = await import("chart.js")`. Those libraries
need internet. Leaflet additionally permits OpenStreetMap tile images and its
stylesheet. Maps require attribution and do not imply verified driving routes,
traffic or travel times. Plain SVG/HTML/JS widgets need no external service.

The injected runtime exposes:

- `window.constWidget.state`: a copy of restored JSON state.
- `setState({...})`: merge custom JSON state.
- `sendPrompt({text})`: stage a visible follow-up in the host.
- `openLink({url})`: stage a visible HTTP(S) link in the host.

Generated code cannot send a user message or open a host window directly. The
user clicks the host's Send to chat or Open link button. Analyze this scenario
also works without a generated follow-up button. Before submitting or exporting,
the host requests a fresh state snapshot, with timeout and cleanup on unmount.
The originating chat's existing callback determines conversation/model/project/mode.

Named input/select/textarea values persist automatically under `state.$controls`;
custom visualization state must use `setState`. Input names must be unique,
stable identifiers. Password/file inputs are disabled. Initialize computations
from the restored controls/state. Reset restores document defaults. Theme and
language follow the desktop; the iframe receives Const CSS variables and
reduced-motion defaults. Generated labels should follow the conversation language.

HTML export embeds the current saved values, runtime and theme. Local controls
remain functional; workspace actions display a localized notice. Optional library
imports and map tiles still require internet. Export does not embed chat history,
credentials or host access.

This implementation adapts the architectural patterns in OpenIntelligentUI's
streaming renderer, sandbox bridge and standalone exports. It uses Const's own
fence protocol, callbacks, persistence, theme and isolation policy.

## Persistence and invalid output

OpenUI and widget state live in `intelligenceUiState` on the assistant message,
keyed by fence character offset (`ui-N`). History normalization shifts offsets
when joining assistant turns. Blocks, chats and main/side views remain isolated.
Only bounded JSON state with valid block IDs is accepted.

Invalid completed output preserves surrounding Markdown and exposes localized
feedback plus inspectable source. Copy and side-to-main transfer project UI into
readable text; widgets project their title and description instead of source JS.
Generated answer documents are independent snapshots; there is no cross-answer
DOM patch mechanism.

## Verification

From the repository root:

```sh
pnpm --filter @const/harness-desktop test:intelligence-ui
pnpm --filter @const/harness-desktop test:markdown
pnpm --filter @const/harness-desktop check-types
pnpm --filter @const/harness-desktop build
pnpm --filter @const/harness-desktop test:intelligence-ui:preview
```

The fixture is `http://127.0.0.1:5189/tests/intelligence-ui.html`. It makes no
model calls and uses a separate storage key. Renderer selection covers OpenUI,
widget and mixed Markdown/OpenUI/widget/Mermaid content at 760px and 340px widths.
Exercise native form submission, calculator validation, main/side routing,
remount/reload persistence, reset, HTML download, staged follow-ups/links, dark
and light themes, busy, streaming, and invalid output. Unit tests cover the real
production OpenUI library, framing, contract limits, bridge payload rejection,
script-boundary escaping, export state, history offsets and clipboard projection.

## Optional live model verification

`test:intelligence-ui:live --check-config` prints only the selected model,
provider host and whether a credential is configured. Without `--check-config`
it makes one streaming request with synthetic project data and no tools/private
history, validates the requested native formats, and writes a fresh JSON artifact.
`--output <new-file-path>` selects a non-overwriting destination.

Overrides: `INTELLIGENCE_UI_MODEL`, `INTELLIGENCE_UI_BASE_URL`,
`CONST_ROUTER_API_KEY`. No desktop login cookies are read, and credentials/provider
error payloads are not printed or saved. Set `INTELLIGENCE_UI_LIVE_RESULT` to
the artifact and open the fixture with `?live=1` to inspect that response.

Deterministic tests/builds, browser fixture checks, native Electron integration
and provider-backed generation are distinct checks. Report which actually ran.
