"""Apply the approved brand kit to Accounts, Router and Harness (not Const web).

Run: uv run --no-project --with pillow==13.0.0 --with resvg-py==0.5.0
     scripts/sync-brand-assets.py [--check]
"""

from __future__ import annotations

import argparse
import io
import json
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image
import resvg_py


ROOT = Path(__file__).resolve().parents[1]
KIT = ROOT / "packages/ui/assets/brand/brand-kit-v1"
VARIANTS = ["light", "dark", "light-transparent", "dark-transparent"]
APPLICATIONS = {
    "apps/accounts": ("const", ["const"]),
    "apps/router": ("router", ["const", "router"]),
    "apps/harness/web": ("harness", ["const", "harness", "router"]),
    "apps/harness/desktop": ("harness", ["const", "harness", "router"]),
    "apps/harness/mobile": ("harness", ["const", "harness", "router"]),
}


def png(markup: str, width: int) -> bytes:
    image = Image.open(io.BytesIO(resvg_py.svg_to_bytes(svg_string=markup, width=width))).convert("RGBA")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def master_body(brand: str) -> str:
    document = ET.fromstring((KIT / "masters" / f"{brand}-symbol.svg").read_text(encoding="utf-8"))
    return "".join(ET.tostring(child, encoding="unicode") for child in document if not child.tag.endswith("title"))


def canvas(width: int, height: int, body: str, ink: str = "#ffffff") -> str:
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" color="{ink}">{body}</svg>'


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Report stale/missing application assets without writing")
    arguments = parser.parse_args()
    changes = []
    targets = []

    def output(relative: str | Path, data: bytes) -> None:
        destination = (ROOT / relative).resolve()
        if not destination.is_relative_to(ROOT) or destination.is_relative_to(ROOT / "apps/landing"):
            raise ValueError(f"Asset is outside the approved scope: {relative}")
        targets.append(destination.relative_to(ROOT).as_posix())
        if destination.exists():
            current = destination.read_bytes()
            if current == data or (destination.suffix == ".xml" and current.replace(b"\r\n", b"\n") == data.replace(b"\r\n", b"\n")):
                return
        changes.append(destination.relative_to(ROOT).as_posix())
        if not arguments.check:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)

    def copy(source: Path, relative: str | Path) -> None:
        output(relative, source.read_bytes())

    for brand in ["const", "harness", "router"]:
        for variant in VARIANTS:
            for extension in ["png", "svg"]:
                source = KIT / brand / "symbol" / f"{brand}-symbol-{variant}.{extension}"
                copy(source, f"packages/ui/assets/brand/{brand}-logo-{variant}.{extension}")

    for application, (product, available_brands) in APPLICATIONS.items():
        for brand in available_brands:
            for variant in VARIANTS:
                for extension in ["png", "svg"]:
                    source = KIT / brand / "symbol" / f"{brand}-symbol-{variant}.{extension}"
                    copy(source, f"{application}/public/{brand}-logo-{variant}.{extension}")
        favicon_svg = (KIT / product / "symbol" / f"{product}-symbol-dark.svg").read_text(encoding="utf-8")
        image = Image.open(io.BytesIO(png(favicon_svg, 256)))
        icon = io.BytesIO()
        image.save(icon, format="ICO", sizes=[(size, size) for size in [16, 24, 32, 48, 64, 128, 256]])
        output(f"{application}/public/favicon.ico", icon.getvalue())
        output(f"{application}/public/apple-touch-icon.png", png(favicon_svg, 180))
        if application in {"apps/accounts", "apps/router"}:
            output(f"{application}/src/app/icon.png", png(favicon_svg, 256))

    dock = KIT / "harness/dock"
    for source, target in [
        ("harness-dock-dark-512.png", "apps/harness/desktop/build/icon.png"),
        ("harness-dock-dark-1024.png", "apps/harness/desktop/build/icon-1024.png"),
        ("harness-dock-dark.ico", "apps/harness/desktop/build/icon.ico"),
        ("harness-dock-dark.icns", "apps/harness/desktop/build/icon.icns"),
        ("harness-dock-dark-512.png", "apps/harness/desktop/public/icon.png"),
        ("harness-dock-dark-1024.png", "apps/harness/web/public/assets/image/landing/harness-icon.png"),
    ]:
        copy(dock / source, target)

    android = ROOT / "apps/harness/mobile/android/app/src/main/res"
    harness = master_body("harness")
    # Android adaptive icons reserve the outer area for launcher masks and motion.
    foreground = canvas(1024, 1024, f'<g transform="translate(512 512) scale(.72) translate(-512 -512)">{harness}</g>')
    round_icon = canvas(1024, 1024, '<circle cx="512" cy="512" r="512" fill="#161616"/>' + f'<g transform="translate(512 512) scale(.82) translate(-512 -512)">{harness}</g>')
    rounded = (dock / "harness-dock-dark.svg").read_text(encoding="utf-8")
    for density, icon_size, foreground_size in [
        ("mdpi", 48, 108), ("hdpi", 72, 162), ("xhdpi", 96, 216),
        ("xxhdpi", 144, 324), ("xxxhdpi", 192, 432),
    ]:
        base = android.relative_to(ROOT) / f"mipmap-{density}"
        output(base / "ic_launcher.png", png(rounded, icon_size))
        output(base / "ic_launcher_round.png", png(round_icon, icon_size))
        output(base / "ic_launcher_foreground.png", png(foreground, foreground_size))
    for splash in sorted(android.glob("drawable*/splash.png")):
        with Image.open(splash) as existing:
            width, height = existing.size
        size = min(width, height) * 0.3
        x, y = (width - size) / 2, (height - size) / 2
        markup = canvas(width, height, f'<rect width="{width}" height="{height}" fill="#161616"/>' + f'<g transform="translate({x:g} {y:g}) scale({size/1024:g})">{harness}</g>')
        output(splash.relative_to(ROOT), png(markup, width))
    output(android.relative_to(ROOT) / "drawable/ic_launcher_background.xml", (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">\n'
        '    <solid android:color="@color/ic_launcher_background" />\n'
        '</shape>\n'
    ).encode())

    report = {"assets": len(targets), "changed" if not arguments.check else "stale": len(changes)}
    if arguments.check and changes:
        report["paths"] = changes
    print(json.dumps(report, indent=2))
    if arguments.check and changes:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
