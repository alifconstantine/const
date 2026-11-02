# Const Harness v0.0.2

Available for Windows x64, Windows ARM64, and Android.

## New Features
- Added a unified Activity panel for progress, background jobs, sub-agents, file changes, and sources.
- Added media and document previews from Activity.
- Added direct preview actions for files created by the AI.
- Added in-app update checks, automatic download preferences, download progress, and installer actions on Windows and Android.
- Added English release notes with update controls localized in five languages.

## Fixes
- Fixed Browser Use and SidePanel isolation between workspaces.
- Improved chat stream recovery and remote pairing persistence.
- Separated working progress from final AI responses.
- Fixed relative file links opening in the SidePanel.
- Preserved literal code, nested blockquotes, and Markdown numbering.
- Hidden empty Activity sections.
- Protected Windows update installation while agents or background jobs are running.

## Improvements
- Added syntax highlighting and Copy actions to code blocks.
- Made implementation details collapsible.
- Refined file preview spacing and workspace tree behavior.
- Improved mobile headers, navigation, and touch controls.
- Made chat statistics show icons in narrow layouts while preserving their original alignment.
- Routed updates through the app's public update service so installers remain available independently of source repository visibility.

## Installation
- Windows: choose the installer matching your device architecture.
- Android: install the signed APK. Future APK updates require the same signing key.
- Existing installations without the new update controls require one manual installation of this release.
