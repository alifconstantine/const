# Computer Use native runtimes

The Electron controller owns session leases, a bounded snapshot cache without image
payloads, and serialized requests. A timed-out action is never replayed automatically:
input might already have been delivered before observation failed.

## Platform requirements

| Platform | Runtime | Requirements and limits |
| --- | --- | --- |
| Windows | Persistent Windows PowerShell STA process, UI Automation, checked Win32 input | An interactive desktop. An ordinary process cannot inject input into an elevated application or a secure desktop. |
| Linux X11 | Persistent Python 3 process, PyGObject/AT-SPI, GDK 3 | An active desktop D-Bus session, accessibility enabled, `xdotool` for shortcuts, and `xclip` or `xsel` for paste. |
| Linux Wayland | AT-SPI semantic actions | Global synthetic input, shortcuts, clipboard paste, and screenshots are unsupported until a compositor/portal backend is implemented. Capabilities report these limits and unsupported input fails explicitly. |
| macOS 14+ | Swift helper application with an AppKit run loop | Build on macOS with Swift 6/Xcode command-line tools. Grant Accessibility and Screen Recording to **Const Computer Use** in System Settings. GUI operation still requires testing on a real Mac. |

Windows/Linux use flat NDJSON requests with `requestId`, `tool`, and a startup
`ready` announcement. macOS uses `id`, `method`, and `params`; the host translates
its RPC responses, sparse element indices, window bounds, and Retina screenshot
scale. The macOS inherited-pipe agent verifies its actual Const parent before
starting; the legacy authenticated socket interface remains separate.

On macOS, `pnpm --filter @const/harness-desktop dev` and `build:native` compile and
ad-hoc sign `computer-use-macos/bin/<arch>/ConstComputerUse.app`. Packaging builds
the requested architecture in `beforePack` and includes that helper bundle.
Distribution builds must sign/notarize the application and its embedded helper
with the distributor's normal Apple identity; local tests do not verify that step.

## Tests

From the repository root:

```text
pnpm --filter @const/agent exec vitest run test/desktop-computer.test.ts test/tool-observations.test.ts
pnpm --filter @const/harness-desktop check-types
python3 -B -m unittest discover -s apps/harness/desktop/native/computer-use-linux -p "*_test.py"
```

On Windows:

```text
powershell.exe -NoProfile -NonInteractive -File apps/harness/desktop/native/computer-use-windows/runtime-input.test.ps1
powershell.exe -NoProfile -NonInteractive -File apps/harness/desktop/native/computer-use-windows/runtime-render.test.ps1
powershell.exe -NoProfile -NonInteractive -STA -File apps/harness/desktop/native/computer-use-windows/runtime-input.integration.ps1 -RunInteractive
```

The last command deliberately opens a temporary test window and sends real input
only to that fixture. Its assertions cover screenshots, coordinate clicks, Unicode,
shortcuts, paste, punctuation, and closing the window after an action.

On macOS:

```text
swift test --package-path apps/harness/desktop/native/computer-use-macos
pnpm --filter @const/harness-desktop build:native
```

Protocol tests use mocked native surfaces. They do not prove that a particular
Linux compositor or Mac permission configuration permits real GUI input. The CI
matrix compiles/tests each platform; real desktop validation remains a separate
step. Native delivery metadata alone is never evidence that the requested task
completed: inspect the returned tree/image before claiming success.
