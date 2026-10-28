# ArtCraft plugins

Implemented 2026-10-29 for Const Harness. The 13 local [Craft Apps](https://getartcraft.com/apps) are separate optional MCP-only plugins. This integration runs the official native CLI engines in headless mode. No ArtCraft account, OAuth app, API key, Rust toolchain, or Composio service is required.

## User setup

1. Install the desired plugin from Marketplace / Settings > Plugins.
2. Install that app's official release, preserving its CLI, DLLs and other resources together. The detail page links to the official download. macOS publishes a separate CLI archive alongside the desktop app.
3. Const detects the CLI in the ArtCraft Launcher's Windows locations, system binary directories and absolute PATH entries. Use **Detect CLI** to refresh or **Choose CLI executable** for a portable/custom installation. Only native `<app>-cli` executables are accepted; this picker cannot run a shell script.
4. For FilmCraft, LightCraft, CADCraft and GridCraft, explicitly allow local file access. These inspected releases do not implement folder restriction flags. A working directory alone is not confinement. Other nine profiles pass the upstream read/write root flags.
5. Select a workspace to test the connection. In Main Chat, ask for the app by name. Chat folders created for Outside Project work too. Review-mode tool calls use the existing agent approval flow; full-access mode keeps its existing behavior.

Both plugin availability and MCP settings retain the existing global/workspace override behavior. Changing the executable, app identity, scope or file-access choice changes the trusted configuration fingerprint. Repository-edited configuration cannot launch an engine until reviewed/saved. No token or credential is stored for these apps.

## Runtime and results

`ArtcraftRuntimeManager` owns one client per connection + canonical workspace + conversation. Main Chat, companion chat and scheduled task factories pass their stable conversation ID to execution. It serializes each session's calls and rechecks effective configuration before dispatch. The two lightweight gateway tools, `discover_tools` and `call_tool`, avoid eagerly starting 13 apps or sending hundreds of schemas to the model. Discovery returns actual upstream schemas, version, output folder and (for LightCraft) library folder. Generic deferred MCP search can find these gateways too.

The nine root-aware profiles receive the workspace as read root and the output folder as write root. Output defaults to `<workspace>/artifacts/<app>/<conversation-hash>/`. VectorCraft explicitly selects `--headless` rather than auto-attaching to a desktop window. LightCraft uses a persistent `library/` under this session folder; reopening the same chat reopens that library. FilmCraft gets its own `data/` folder. A symlink/junction in the generated output-folder chain is refused.

Each Settings connection test uses a separate probe session which is closed after discovery, keeping working documents separate. Active chat engines remain alive between turns. Disconnect, configuration/availability changes and app exit close them; deleting a conversation releases its engines. The manager permits up to 24 engine sessions and refuses additional startup instead of silently discarding unsaved work. An unexpectedly closed engine stays unavailable until explicitly disconnected/reconnected; uncertain mutations are never automatically replayed. Saved native files remain on disk, but other in-memory documents must be saved explicitly before disconnecting/restarting. Default tool timeout is three minutes; longer operations should use upstream job/status tools when available.

PNG/JPEG/SVG, PDF, audio, video and ordinary exported document files use the existing Main Chat and file-preview paths. Agent tool image blocks use the existing image observation path. Native files can be opened in their respective desktop apps. No complete native editor is embedded in a sidebar or chat, and these profiles do not attach to already-open desktop windows. The screenshot/UI interaction tools some upstream servers advertise may require their live desktop mode; headless callers must use document/render/export tools instead. These are upstream applications in active development: exposing a tool does not prove every upstream feature works in headless mode.

## Verified release profiles

Official Windows x64 portable archives were downloaded outside the repository, checked against their published SHA256 digests, and exercised through the MCP SDK. No native runtime or archive is bundled into Const or committed. All 13 passed initialize/discovery and a small authored edit/save/reopen/preview workflow; this is not an exhaustive creative feature or OS compatibility test.

| Plugin      | Release | Discovered tools | Workflow                                                                 |
| ----------- | ------- | ---------------: | ------------------------------------------------------------------------ |
| PhotoCraft  | 0.16.0  |               26 | layered `.pcraft`, PNG, reopen and layer inspection                      |
| VectorCraft | 0.17.0  |               32 | rectangle, `.vectorcraft`, SVG, reopen                                   |
| FilmCraft   | 0.13.0  |               17 | project + sequence, `.fcproj`, reopen and frame render                   |
| LightCraft  | 0.14.0  |              393 | import, exposure edit, PNG, persistent catalog reopened in a new process |
| PdfCraft    | 0.14.0  |              179 | text on a new PDF, save/open and page render                             |
| EffectCraft | 0.17.0  |               27 | text composition, `.ecproj`, reopen and PNG                              |
| DesignCraft | 0.13.0  |               26 | text frame, `.designcraft`, reopen and PNG                               |
| FigCraft    | 0.11.2  |               18 | frame, `.figcraft`, reopen/inspect and SVG                               |
| WordCraft   | 0.11.0  |               16 | text, DOCX, reopen/text check and page render                            |
| SoundCraft  | 0.13.1  |               17 | generated test tone, session save/open and WAV bounce                    |
| DeckCraft   | 0.11.1  |               25 | text box, `.deckcraft`, reopen and PNG                                   |
| CADCraft    | 0.13.0  |               12 | line, DXF, reopen and PNG                                                |
| GridCraft   | 0.12.1  |               21 | text/formula, XLSX + CSV, reopen and range check                         |

macOS/Linux discovery paths are implemented but their binaries have not been executed in this Windows verification. Later upstream versions are not assumed to have identical flags or capabilities; profiles record the release used for verification.

## Checks

- `test:mcp` includes deterministic tests for session isolation, lazy startup, serialized mutations, cancellation, trust/consent, stale native picker results, process failure and Main Chat agent allow/deny routing.
- `tests/plugins.html` is a simulated browser fixture for marketplace/detail UI and translations; it is not provider execution evidence.
- Optional real-binary checks: set `CONST_ARTCRAFT_RUNTIMES` to a folder with `<app>/<official portable directory>/<app>-cli.exe`, then run `pnpm --filter @const/harness-desktop exec tsx tests/artcraft.live.ts`. Set `CONST_ARTCRAFT_WORKFLOWS=1` for the authored workflows. It writes verification artifacts and inventory under that external runtime folder, never downloads or installs automatically. `CONST_ARTCRAFT_INSPECT=1` also stores command catalogs.

Official app logos are packaged locally in `public/assets/plugins/artcraft`, with pinned source URLs and upstream MIT license notices. They identify third-party integrations and do not imply ArtCraft endorsement. See that folder's attribution file. Const Guide and creator/browser/computer icon choices are unchanged.

## Upstream references

- [Craft App directory](https://getartcraft.com/apps) and [Launcher installation locations](https://github.com/storytold/craft-launcher#where-apps-are-installed).
- Per-app tagged `docs/mcp.md` in [the official Storytold repositories](https://github.com/storytold); FilmCraft's interface is documented by its tagged `apps/filmcraft-cli/src/main.rs` parser.
- [GridCraft 0.12.1](https://github.com/storytold/gridcraft/blob/v0.12.1/docs/mcp.md), [LightCraft 0.14.0](https://github.com/storytold/lightcraft/blob/v0.14.0/docs/mcp.md), [PhotoCraft 0.16.0](https://github.com/storytold/photocraft/blob/v0.16.0/docs/mcp.md).
