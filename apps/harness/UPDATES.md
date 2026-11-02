# Harness application updates

Desktop and Android use the shared update controls in `shared/updates`. Desktop places the control before the sidebar collapse button and in General settings. Android places it in the app header and the connected workspace header.

Controls are localized in English, Indonesian, Spanish, Japanese and Chinese. Release notes are taken from the release body and remain in the language authored by the publisher (English). The viewer supports headings and list items and never executes release HTML or embedded links. There is no View release on GitHub action; users can dismiss the panel with Later.

## Release source

- Repository: `alifconstantine/const`.
- Only published, non-prerelease tags matching `harness-vMAJOR.MINOR.PATCH` are considered. Const Learn tags such as `v0.0.1` are excluded.
- Versions are compared numerically, and asset selection matches the installed platform and architecture. Missing artifacts do not get invented URLs.
- Apps fetch the public feed at `https://harness.const.web.id/api/app-updates`. Installer URLs point to its `/download` endpoint, not to the private repository.
- Automatic checks run shortly after startup and every six hours when enabled. Manual checking is always available.
- Automatic downloading can be disabled separately. Installation is always initiated by the user.

## Windows

The main process checks the public feed, streams its matching installer into the private app update directory, checks its exact size and published SHA-256 digest, and reports progress to the UI. A completed download is checked again before launching. Downloads can be reused after restarting the application if the hash still matches.

The install action is refused while an agent, sub-agent, or background job is running. It opens the Windows installer and quits Harness using its normal shutdown path. The installer controls installation and relaunch; the UI does not claim installation succeeded before that happens.

Update IPC is local-only and excluded from the remote desktop capability contract. The renderer cannot supply a filesystem path or arbitrary executable URL. Development builds, other desktop operating systems, and assets without a SHA-256 digest use the system download flow instead of automatic installation.

## Android APK distribution

The Capacitor `HarnessUpdates` plugin downloads the APK into app-private cache. Before installation it checks the SHA-256 digest, byte count, package ID, higher Android versionCode, release versionName, and matching signing certificate. Android owns the installation permission and confirmation screens. If permission is missing, the UI directs the user to the app-specific installation settings and lets them retry.

This APK distribution flow requests `REQUEST_INSTALL_PACKAGES`; a future Google Play build must use the appropriate Play update flow and distribution policy instead.

## Publishing

1. Increase desktop/mobile package versions and Android versionName/versionCode.
2. Build Windows installers separately for x64 and ARM64. Build and sign the Android APK with the existing release key.
3. Publish all compatible artifacts with a GitHub release tagged, for example, `harness-v0.0.3`. GitHub's uploaded asset SHA-256 digest is required for automatic downloads/installation. If it is absent the app offers the system download flow.
4. Write English Markdown release notes using `## New Features`, `## Fixes`, and `## Improvements` as needed. The release body is what users see in the update panel.

The feed reads the release API and asset digests on the server; it does not depend on `latest.yml`. Updating the website alone does not update a bundled APK or desktop installer. Existing packages without these controls require one manual installation of the rebuilt app.

## Private source repository, public installers

The publisher explicitly permits public installer/APK downloads while the source repository becomes private. Deploy the Harness web app containing `/api/app-updates` and `/api/app-updates/download` before distributing these clients.

Set `HARNESS_RELEASES_TOKEN` in the web server's environment. Use a GitHub fine-grained token with Contents: Read access to this repository. Do not prefix this secret with `NEXT_PUBLIC_` or `VITE_`, commit it, or place it in the desktop/APK configuration. Without the secret, a public repository works; a private repository returns a recoverable update-check error until server access is configured.

The server only publishes stable Harness release notes and approved installer files. Arbitrary repository files, source archives, draft releases, and Learn releases are excluded. Download requests are authenticated to GitHub on the server, then redirected to a short-lived signed asset URL. The GitHub credential is never sent to the client. Redirect responses are not cached. The website download page uses the same public relay.

Release notes are public app-facing text: use curated English notes and omit private issue/commit links.

## Verification and preview

From the repository root:

```powershell
pnpm --filter @const/harness-desktop test:updates
pnpm --filter @const/harness-desktop check-types
pnpm --filter @const/harness-mobile check-types
pnpm --filter @const/harness-desktop test:updates:preview
```

Open `http://127.0.0.1:5197/tests/app-updates.html` for desktop or append `?mobile&lang=id` for a localized mobile preview. The preview simulates version 0.0.3, downloads and installation; it never downloads or runs an installer. Production update requests use actual GitHub releases.
