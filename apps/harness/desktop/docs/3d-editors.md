# Local 3D editor plugins

Blender, Godot, Unity and Unreal Engine are optional MCP-only plugins in the desktop marketplace. Install a plugin, open its detail page, and follow the three setup steps. Configuration also appears in **Settings → MCP Servers**. No Const publisher OAuth app, API key, cloud console or end-user environment variables are required.

| Plugin        | Supported editor     | Bridge                                              | User's final setup                                                                                                     |
| ------------- | -------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Blender       | 5.1+                 | Official Blender Lab 1.0.3                          | Install the prepared add-on ZIP, enable MCP and Online Access, open a saved `.blend`                                   |
| Godot         | 4.2+, recommend 4.5+ | NPGameDev toolkit/server 1.1.1                      | Enable Godot MCP Toolkit in the selected project's Plugins settings                                                    |
| Unity         | 6+                   | Official Unity CLI 1.0.0-beta.14 and Unity Pipeline | Sign in to Unity if required, install Pipeline using the button, open the project and finish compilation               |
| Unreal Engine | 5.8+                 | Engine's experimental Unreal MCP                    | Restart after preparation, enable Const Harness Project Context, Unreal MCP and All Toolsets; enable server auto-start |

## Setup

1. **Choose project** inside the current Const workspace. Blender selects a saved `.blend`; Unreal selects a `.uproject`; Godot and Unity select the project directory. A project at the workspace root is detected automatically for Godot, Unity and a single Unreal project. Selecting a project for a globally installed plugin creates a workspace configuration override.
2. **Prepare connection** downloads supporting components into the user's Const home under `editor-runtimes`. Godot copies its editor add-on into `addons/godot_mcp_toolkit`; Unreal creates `Plugins/ConstHarnessBridge` with a read-only project identity tool. Existing project add-ons are preserved. For Blender use **Show Blender add-on**, then install `mcp-1.0.3.zip` from Blender's Preferences → Add-ons → Install from Disk. For Unity use **Sign in to Unity** when necessary, then **Install Unity Pipeline**. These are vendor CLI actions; Const does not collect Unity credentials.
3. Enable the bridge in the editor as described on the plugin page. Run **Test connection** in Const. The MCP handshake alone does not mark an editor connected: a live project/readiness check must pass.

Use a different local port in the detail page if Blender's default `9876` or Unreal's `8000` conflicts. Set that same port in the editor. Blender's internal socket is not an MCP HTTP URL. Godot discovers a project-scoped local token and WebSocket port automatically. Unity is pinned with `--project-path`. Unreal uses loopback HTTP `/mcp` only.

Unreal's generated context plugin depends on Python Script Plugin, Unreal MCP and All Toolsets. It registers `ConstHarnessContext.project_file` using Epic's Python Toolset Registry API. Until that read-only tool can confirm the selected `.uproject`, Const refuses editor actions. Older Unreal versions need a separate custom MCP server; this plugin does not install a third-party C++ bridge or upgrade projects.

## Main Chat and outputs

Enabled, prepared plugins expose two approved gateways in Main Chat: `discover_tools` and `call_tool`. They start a connection lazily and return actual schemas from the editor. Blender advertises the live-editor tools; duplicate `_for_cli` variants are hidden so users do not need a separate Blender executable path or environment variable. Godot can activate additional groups through its own `discover_tools`; Const refreshes the catalog before each call. Unreal exposes its native `list_toolsets`, `describe_toolset`, and `call_tool` discovery flow.

Edits appear in the open editor. The document is shared across chats, so calls to the same editor endpoint are serialized across connection aliases. Project identity is checked again before dispatch. This is target verification, not a filesystem sandbox: editor tools can execute code and have the editor's normal local permissions.

Save native project files explicitly. Exports can be placed in a workspace `artifacts` folder; the agent can show confirmed image results and absolute file links in Main Chat. The plugin does not embed a 3D editor viewport. A cancelled or timed-out action may have completed. Const blocks further use of that uncertain MCP session until explicit reconnection, without automatically replaying the write. Verify the result in the editor first.

Example prompts:

> Use the Blender plugin to inspect the selected scene, add a sphere beside the cube, save the .blend, render a PNG into artifacts, and show the result.

> Use the Godot plugin to create a Node3D scene with a box mesh, camera and directional light. Save it as res://ConstScene.tscn and report the saved file.

## Runtime maintenance

Native archives are pinned by version and SHA-256 for Windows/macOS/Linux x64 and arm64, extracted into private staging directories, then renamed into place. No shell scripts, global npm installs, or editor installers run. The Node runtime invokes npm's JavaScript entry directly with `ci --omit=dev --ignore-scripts` and the pinned upstream lockfile. Blender's Python dependencies are pinned with cross-platform wheel hashes in `electron/mcp/blender-requirements.json`; uv prepares Python 3.12.16 and installs with `--require-hashes --no-deps --only-binary :all:`. Official Blender source runs directly with isolated Python imports and namespaced Windows paths to handle long cache locations. Runtime downloads require network access and sufficient disk space. Full editors are installed separately by the user.

To update Blender dependencies, resolve the official bundle in a scratch directory, export with `uv export --frozen --no-dev --no-emit-project --no-header --format requirements-txt`, retain pins/markers/hashes in `blender-requirements.json`, and repeat native integration validation. Bump the runtime directory version when changing pins so existing installations are not silently reused. Preserve third-party license files in downloaded caches.

## Validation and limits

Windows x64 native validation on 2026-10-29:

- Blender 5.1.2: official add-on + MCP server discovery, project verification, add a sphere, save `.blend`, render a PNG.
- Godot 4.7.2 headless editor: project token authentication, discovery, create/open a Node3D scene, add a box mesh, save `.tscn`, inspect the tree, activate the 3D tools group and rediscover its schemas. GUI viewport/playtest capture was not validated headlessly.
- Unity: actual pinned CLI download/integrity and no-editor status reporting. No Unity Editor was installed, so native scene edits, Pipeline installation and vendor login were not exercised.
- Unreal: native MCP protocol and project identity fixtures, generated plugin installation/preservation, and Epic's documented APIs. No Unreal Editor was installed, so the generated Python plugin and native actor/Blueprint operations still require live UE 5.8 validation.
- Automated SDK fixtures exercise approval allow/deny through the real Main Chat agent, deferred routing, trust changes, wrong-project refusal, queues, cancellation, project selection, and archive traversal/link rejection. Typecheck and the production build are required. macOS/Linux native editor runs remain unverified.

## Upstream references

- [Blender Lab MCP](https://www.blender.org/lab/mcp-server/) and [official source/releases](https://projects.blender.org/lab/blender_mcp).
- [Godot toolkit](https://github.com/NPGameDev/godot-mcp-toolkit) and [MCP server](https://github.com/NPGameDev/godot-mcp-server), MIT.
- [Unity CLI setup](https://docs.unity.com/en-us/unity-cli/use-unity-cli) and [replacement of the older MCP server](https://docs.unity.com/en-us/unity-cli/replace-mcp-server-unity-cli).
- [Epic Unreal MCP](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-mcp-in-unreal-editor) and [Python toolset authoring](https://github.com/EpicGames/unreal-engine-skills-for-claude-code-plugin/blob/main/skills/create-toolset/SKILL.md).
