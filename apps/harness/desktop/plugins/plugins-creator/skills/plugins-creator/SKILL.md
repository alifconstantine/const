---
name: plugins-creator
description: Create or update a plugin package for Const Harness, including skills, MCP connections, and optional UI declarations. Use for Const plugins rather than publishing to another platform's directory.
---

Build a Const plugin in its own folder. Inspect the current Const plugin registry and working examples before choosing the manifest fields; the installed host determines which capabilities can actually run.

A package has root `plugin.json` with `name` (lowercase hyphenated), semantic `version`, `description`, `author.name`, and `interface.displayName` / `interface.icon`. A plugin can contain `skills/<slug>/SKILL.md`, inline `mcpServers`, or both. `entrypoint` is optional; when present it names an existing skill folder. MCP-only plugins do not need a dummy skill. Metadata-only placeholders explicitly set `placeholder: true`.

Each inline MCP server declares `transport` (`http` or `stdio`), `url` or `command` and optional `args`, and `auth` (`none`, `oauth`, or `api-key`). Never put credentials in a package. Users connect accounts in Settings > MCP Servers. Native capabilities and UI declarations depend on host support; declaring a panel does not implement one. Do not claim an unsupported UI is operational.

Keep package references relative, inside the package, and free of symbolic links. Include only files the plugin needs. Add workflow instructions only when they improve use of its tools. Preserve existing plugin identities and unrelated settings when editing.

Validate JSON field types, names, versions, MCP configuration, package-relative paths, and any declared skill entrypoint. When working in the Const source repository, also use `readPluginManifest` or the registry tests. Outside that repository, do not assume its internal modules are installed in the user's project. Test the requested workflow when dependencies are available and report unavailable account/runtime testing precisely. Creating a local package does not publish it or install it into every workspace. Use the user's chosen scope when installation is requested.
