# Harness browser automation audit

Date: 2026-10-25. Scope: `apps/harness/desktop/` and its native browser-tool definitions, fallback parser, and read-only agent policy in `packages/agent/`. Existing edits in `apps/learn/` are outside this commit.

## Assessment

**9/10 for the embedded Harness workflow covered by this audit.** This is an engineering assessment supported by the checks below, not a claim of universal browser compatibility or parity with Playwright.

The original changes were not ready: the ARIA serializer included credential input values, human control did not consistently stop automation, secret entry could follow the active tab instead of the requesting tab, and renderer-only URL validation missed redirects and other navigation paths.

## Findings and fixes

| Finding | Severity | Resolution |
| --- | --- | --- |
| Password/OTP values present in the ARIA serializer as well as element metadata | High | Mask synchronous serializer reads, redact known field values from returned text, preserve the original field descriptors and values, and cover credential fields in screenshots. |
| Explicit secret fields became readable after handoff | High | Mark the destination field for continued masking after control returns to AI. |
| Secret could reach another tab, replaced guest, changed origin, stale ref, or fallback input | High | Bind requests to tab, guest ID and origin; verify origin again inside the write script; reject stale snapshots and missing explicit targets. Require a pending request and verify exact resulting value. |
| Manual takeover and expired help could allow automation to continue | High | Honor the human holder independently of the requested flag; recheck during polling; keep manual control on expiry. |
| Scheme/host checks could be bypassed through links or redirects | High | Share navigation validation with main-process session and guest policies; check initial attachment, navigation and redirects. |
| Missing explicit tab silently selected a different tab | High | Fail instead of acting on another tab. |
| Text assertion treated script failure or missing scope as successful absence | Medium | Propagate execution errors and reject a missing scope; exclude hidden rendered text. |
| Hidden semantic selector incorrectly appeared detached | Medium | Allow attachment probes to resolve hidden semantic targets. |
| Click/type readiness accepted hidden, disabled, covered, read-only or non-editable controls | Medium | Check visibility, disabled state, hit target and actual focus before delivering input. Resolve text selectors to the matching leaf. |
| Hover/paste could report success without delivering input | Medium | Propagate hover dispatch errors; reject invalid paste targets rather than silently falling through to keystrokes. |
| Background screenshot capture could wait indefinitely | Medium | Prefer Electron capturePage to wake hidden guest rendering, bound capture attempts and fail on empty images. |
| Native telemetry exposed credentials and used deprecated event arguments | Medium | Redact console/network fields, return known fields only, and use the current Electron console event object. |
| New secret UI violated localization/design requirements | Medium | Translate new strings in all five dictionaries, use the studio palette, clear retained input on request changes, and show the form only on the requesting tab. |

The existing additions also include `browser_wait_for`, `browser_verify_text`, `browser_find`, `browser_hover`, and `browser_paste`, wired through controller dispatch, IPC, preload, renderer types, agent schemas and fallback parsing. Popup denial, guest sandboxing, permission default-deny and temporary screenshot retention are retained.

## Verification

- `pnpm --filter @const/harness-desktop test:browser`: **27 checks passed**, using actual sandboxed Electron 44.1.1 webviews and a local HTTP fixture. Covers ARIA/element/readable-text masking without changing input values, hidden and delayed controls, covered clicks, text selectors, typing/paste/hover, failed assertions, manual takeover, missing tabs, cross-tab secret handoff, stale refs, changed origins, expired requests, telemetry, screenshot pixels and mask cleanup, denied popups, denied permission requests, and server redirects.
- `pnpm --filter @const/agent exec vitest run test/browser-tools.test.ts`: **15 tests passed**, covering schema registration, fallback parsing and desktop-handler dispatch/error propagation for all five tools.
- `pnpm --filter @const/harness-desktop check-types`: **passed**.
- `pnpm --filter @const/harness-desktop build`: **passed**. Vite reports large chunks and an unknown `platform` input option; these are build warnings, not compilation failures.
- `git diff --check`: **passed**.
- Additional existing suites, `test/const-agent.test.ts` and `test/subagent.test.ts`: **26 passed, 4 failed**. Re-running with the three changed agent modules loaded from the original HEAD reproduced exactly the same four failures: shell-output truncation, the security role alias, background notice wording, and the concurrent-subagent limit. They are outside this browser change.

The test runner builds its fixture into a unique temporary directory, uses a separate Electron user-data profile, hides its window, has an overall timeout, and removes its generated artifacts. It does not use the application's normal browser profile or live model credentials.

## Embedded CDP versus Playwright MCP

Keep embedded CDP as Harness's primary browser driver: it already controls the same webviews the user sees and integrates with the app's tab selection and human handoff. Replacing that boundary would require additional work to preserve those behaviors. This recommendation follows the local architecture; it is not a measured performance comparison.

[Microsoft's Playwright MCP documentation](https://github.com/microsoft/playwright-mcp) describes an accessibility-snapshot server, existing-browser/CDP connections, external browser choices, and additional tracing and browser capabilities. It is a useful optional external adapter. Its own documentation warns that allowed/blocked origins are not a security boundary and do not cover redirects; an adapter would still need the application's navigation and handoff policies.

The [Electron webContents documentation](https://www.electronjs.org/docs/latest/api/web-contents) documents cancellable frame navigation/redirect events, current console event fields, and capturePage behavior for hidden pages. The implementation and real-webview tests use those APIs directly.

## Remaining limits

- The host allowlist constrains frame navigation. It is optional and is not a general network-egress or SSRF firewall; subresource fetches remain allowed.
- Arbitrary `browser_evaluate` scripts execute in page context and can inspect page data. Masking reduces accidental disclosure through standard snapshots, screenshots and diagnostics; it does not make a secret inaccessible to arbitrary scripts or a malicious page. Telemetry redaction is heuristic.
- `apps/learn/` still has its own browser implementation. Consolidation into a shared package is a separate follow-up.
- Popups are deliberately denied, so popup-based login flows may need direct navigation or a future managed-popup implementation.
- Verification covers local Windows Electron behavior and the tool bridge. It does not cover a complete live-model conversation, external websites, every iframe interaction, macOS/Linux or Firefox/WebKit.
