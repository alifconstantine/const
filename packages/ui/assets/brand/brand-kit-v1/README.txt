CONST FAMILY / BRAND KIT V1

Const and Accounts share the Trajectory symbol. Harness uses the original Lift.
Router uses the three-ended Presence branch confirmed in the chat.

Folders: const/, accounts/, harness/, router/. Each includes symbol, horizontal
and stacked variants, in SVG and PNG. Symbol PNGs are 1024px; horizontal logos
are 2048px wide; stacked logos are 1536px square.

light: charcoal artwork on warm white. dark: white artwork on charcoal.
light-transparent: charcoal artwork with real alpha.
dark-transparent: white artwork with real alpha.

masters/: scalable currentColor vector symbols and outlined wordmarks.
SVG files contain editable Bezier paths, not embedded raster images.
Wordmarks use consistent Inter Bold, converted to outlines; no fonts required.
Original font and OFL license are included under sources/fonts/.

harness/dock/: rounded tiles with transparent outer corners, SVG, PNG in 12
sizes, multi-resolution ICO for Windows and ICNS for macOS; light and dark.
The rounded tile is only for Harness app/dock use. Transparent symbol files
remain unboxed for navigation bars and general brand usage.

previews/: light/dark overview and checkerboard alpha verification.
validation.json: vector fidelity, alpha and native format checks.
sources/: exact selected concept references retained for provenance.

Rebuild from this folder using the uv command at the top of build_brand_kit.py.
Apply or verify the approved app integration from the repository root:
uv run --no-project --with pillow==13.0.0 --with resvg-py==0.5.0 scripts/sync-brand-assets.py [--check]
Accounts, Router and Harness are included. The Const landing site is deferred.
