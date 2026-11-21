"""Export selected Const family artwork as real SVG paths and PNG/native icons.

Run with: uv run --no-project --with pillow==13.0.0 --with vtracer==0.6.15
          --with resvg-py==0.5.0 --with fonttools==4.68.0
          --with uharfbuzz==0.57.0 build_brand_kit.py
"""

from __future__ import annotations

import copy
import hashlib
import io
import json
import tempfile
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from PIL import Image, ImageChops, ImageOps
import resvg_py
import vtracer
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen


ROOT = Path(__file__).resolve().parent
SVG_NS = "http://www.w3.org/2000/svg"
INK = "#161616"
PAPER = "#fafaf8"
VARIANTS = {
    "light": (INK, PAPER),
    "dark": ("#ffffff", INK),
    "light-transparent": (INK, None),
    "dark-transparent": ("#ffffff", None),
}
SOURCES = {
    "const": ("const-trajectory.png", (70, 150, 470, 550)),
    "harness": ("harness-lift.png", (470, 60, 1100, 555)),
    "router": ("router-presence.png", (1050, 150, 1500, 555)),
}
DISPLAY = {"const": "Const", "accounts": "Accounts", "harness": "Harness", "router": "Router"}
METRICS: dict = {}


def svg(width: float, height: float, body: str, title: str, ink: str | None = None) -> str:
    color = f' color="{ink}"' if ink else ""
    return (
        f'<svg xmlns="{SVG_NS}" width="{width:g}" height="{height:g}" '
        f'viewBox="0 0 {width:g} {height:g}" role="img"{color}>'
        f"<title>{title}</title>{body}</svg>\n"
    )


def rendered(markup: str, width: int | None = None) -> Image.Image:
    return Image.open(io.BytesIO(resvg_py.svg_to_bytes(
        svg_string=markup, width=width, skip_system_fonts=True,
        shape_rendering="geometric_precision",
    ))).convert("RGBA")


def write_svg(path: Path, markup: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(markup, encoding="utf-8")


def clean_paths(root: ET.Element) -> str:
    children = []
    for child in root:
        if child.tag.rsplit("}", 1)[-1] not in {"path", "g"}:
            continue
        child = copy.deepcopy(child)
        for element in child.iter():
            element.tag = element.tag.rsplit("}", 1)[-1]
            if element.tag == "path":
                element.set("fill", "currentColor")
        children.append(ET.tostring(child, encoding="unicode"))
    return "".join(children)


def trace(name: str, filename: str, region: tuple[int, int, int, int]) -> dict:
    source = Image.open(ROOT / "sources" / filename).convert("L")
    area = source.crop(region)
    mask = area.point(lambda value: 255 if value < 130 else 0)
    bounds = mask.getbbox()
    if bounds is None:
        raise ValueError(f"No artwork found for {name}")
    mask = ImageOps.expand(mask.crop(bounds), border=4, fill=0)
    # Preserve subpixel contour positions from the reference's antialiasing.
    # Tracing at native poster resolution shifts a small boundary by ~0.5 px.
    grayscale = ImageOps.expand(area.crop(bounds), border=4, fill=255)
    trace_scale = 4
    trace_bitmap = grayscale.resize(
        (grayscale.width * trace_scale, grayscale.height * trace_scale),
        Image.Resampling.BICUBIC,
    ).point(lambda value: 0 if value < 130 else 255)
    with tempfile.TemporaryDirectory(prefix="const-brand-trace-") as temporary:
        bitmap = Path(temporary) / "shape.png"
        vector = Path(temporary) / "shape.svg"
        trace_bitmap.save(bitmap)
        vtracer.convert_image_to_svg_py(
            str(bitmap), str(vector), colormode="binary", mode="spline",
            filter_speckle=4, corner_threshold=60, length_threshold=3.5,
            max_iterations=10, splice_threshold=45, path_precision=3,
        )
        root = ET.fromstring(vector.read_text(encoding="utf-8"))
    body = f'<g transform="scale({1 / trace_scale:g})">{clean_paths(root)}</g>'
    width, height = mask.size
    markup = svg(width, height, body, name, INK)
    result_mask = rendered(markup).getchannel("A").point(lambda value: 255 if value >= 128 else 0)
    if result_mask.size != mask.size:
        raise ValueError(f"Trace dimensions differ for {name}")
    intersection = sum(ImageChops.darker(mask, result_mask).histogram()[128:])
    union = sum(ImageChops.lighter(mask, result_mask).histogram()[128:])
    iou = intersection / union
    if iou < 0.99:
        raise ValueError(f"Trace fidelity below tolerance for {name}: {iou:.5f}")
    METRICS[name] = {
        "source": f"sources/{filename}", "source_region": list(region),
        "artwork_bounds_in_region": list(bounds), "raster_size": list(mask.size),
        "raster_vector_silhouette_iou": round(iou, 6),
        "path_count": sum(1 for item in root.iter() if item.tag.endswith("path")),
    }
    return {"width": width, "height": height, "body": body, "mask": mask, "name": name}


def place(piece: dict, x: float, y: float, width: float, height: float) -> str:
    scale = min(width / piece["width"], height / piece["height"])
    tx = x + (width - piece["width"] * scale) / 2
    ty = y + (height - piece["height"] * scale) / 2
    return f'<g transform="translate({tx:.5f} {ty:.5f}) scale({scale:.7f})">{piece["body"]}</g>'


def outlined_wordmarks() -> dict:
    # Rebuild clean, consistent typography instead of tracing rasterized letters.
    font = instantiateVariableFont(
        TTFont(ROOT / "sources/fonts/InterVariable.ttf"), {"wght": 700, "opsz": 32}
    )
    data = io.BytesIO()
    font.save(data)
    face = hb.Face(data.getvalue())
    shape_font = hb.Font(face)
    shape_font.scale = (face.upem, face.upem)
    glyphs = font.getGlyphSet()
    output = {}
    for brand, text in DISPLAY.items():
        buffer = hb.Buffer()
        buffer.add_str(text)
        buffer.guess_segment_properties()
        hb.shape(shape_font, buffer, {"kern": True, "liga": True})
        pen = SVGPathPen(glyphs)
        bounds_pen = BoundsPen(glyphs)
        cursor = 0
        for info, position in zip(buffer.glyph_infos, buffer.glyph_positions):
            glyph = glyphs[font.getGlyphName(info.codepoint)]
            transform = (1, 0, 0, 1, cursor + position.x_offset, position.y_offset)
            glyph.draw(TransformPen(pen, transform))
            glyph.draw(TransformPen(bounds_pen, transform))
            cursor += position.x_advance - face.upem * 0.01
        left, bottom, right, top = bounds_pen.bounds
        body = (
            f'<g transform="translate({-left:g} {top:g}) scale(1 -1)">'
            f'<path fill="currentColor" d="{pen.getCommands()}"/></g>'
        )
        output[brand] = {"width": right-left, "height": top-bottom, "body": body}
    return output


def variant_svg(width: float, height: float, body: str, title: str, variant: str) -> str:
    ink, background = VARIANTS[variant]
    rect = f'<rect width="{width:g}" height="{height:g}" fill="{background}"/>' if background else ""
    return svg(width, height, rect + body, title, ink)


def save_family(brand: str, symbol: dict, word: dict) -> None:
    label = DISPLAY[brand]
    symbol_body = place(symbol, 128, 128, 768, 768)
    write_svg(ROOT / "masters" / f"{brand}-symbol.svg", svg(1024, 1024, symbol_body, f"{label} symbol"))
    word_width = word["width"] / word["height"] * 132
    horizontal_width = round(64 + 320 + 72 + word_width + 64)
    horizontal = place(symbol, 64, 64, 320, 320) + place(word, 456, 158, word_width, 132)
    stacked = place(symbol, 172, 64, 680, 624) + place(word, 72, 760, 880, 148)
    write_svg(ROOT / "masters" / f"{brand}-wordmark.svg", svg(word["width"], word["height"], word["body"], f"{label} wordmark"))
    for variant in VARIANTS:
        layouts = [
            ("symbol", 1024, 1024, symbol_body, 1024),
            ("horizontal", horizontal_width, 448, horizontal, 2048),
            ("stacked", 1024, 1024, stacked, 1536),
        ]
        for layout, width, height, body, render_width in layouts:
            base = ROOT / brand / layout / f"{brand}-{layout}-{variant}"
            markup = variant_svg(width, height, body, f"{label} {layout} logo", variant)
            write_svg(base.with_suffix(".svg"), markup)
            rendered(markup, render_width).save(base.with_suffix(".png"), optimize=True)


def export_dock(symbol: dict) -> dict:
    sizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256, 512, 1024]
    outputs = {}
    for theme, tile, ink in [("light", PAPER, INK), ("dark", INK, "#ffffff")]:
        body = (
            f'<rect x="64" y="64" width="896" height="896" rx="200" fill="{tile}"/>'
            + place(symbol, 192, 192, 640, 640)
        )
        markup = svg(1024, 1024, body, f"Harness rounded dock icon, {theme}", ink)
        base = ROOT / "harness" / "dock" / f"harness-dock-{theme}"
        write_svg(base.with_suffix(".svg"), markup)
        for size in sizes:
            rendered(markup, size).save(base.with_name(f"{base.name}-{size}.png"), optimize=True)
        full = rendered(markup, 1024)
        full.save(base.with_suffix(".ico"), format="ICO", sizes=[(n, n) for n in sizes if n <= 256])
        full.save(base.with_suffix(".icns"), format="ICNS")
        outputs[theme] = markup
    return outputs


def write_previews(symbols: dict, words: dict, dock: dict) -> None:
    # All artwork is embedded as vector paths; only preview labels use a system font.
    items = [f'<rect width="1800" height="1370" fill="{PAPER}"/>', f'<rect x="900" width="900" height="1370" fill="{INK}"/>']
    items += [
        '<text x="70" y="80" fill="#161616" font-size="36">Const family / Light</text>',
        '<text x="970" y="80" fill="#ffffff" font-size="36">Const family / Dark</text>',
    ]
    for index, brand in enumerate(["const", "harness", "router"]):
        y = 155 + index * 260
        word = words[brand]
        for origin, ink in [(0, INK), (900, "#ffffff")]:
            body = place(symbols[brand], origin + 68, y, 210, 210)
            body += place(word, origin + 326, y + 58, 488, 94)
            items.append(f'<g color="{ink}">{body}</g>')
            if brand == "const":
                items.append(f'<text x="{origin + 329}" y="{y + 187}" fill="{ink}" font-size="24">Also used by Accounts</text>')
    items += ['<rect y="980" width="900" height="390" fill="#dededb"/>', '<rect x="900" y="980" width="900" height="390" fill="#303030"/>']
    for origin, theme, ink in [(0, "light", INK), (900, "dark", "#ffffff")]:
        items.append(f'<text x="{origin + 70}" y="1025" fill="{ink}" font-size="29">Harness / Rounded dock icon</text>')
        root = ET.fromstring(dock[theme])
        body = "".join(ET.tostring(e, encoding="unicode") for e in root if not e.tag.endswith("title"))
        items.append(f'<g transform="translate({origin + 54} 1060) scale(.225)" color="{ink}">{body}</g>')
        for index, size in enumerate([16, 24, 32, 48, 64]):
            x = origin + 355 + index * 87
            items.append(f'<g transform="translate({x} {1175-size/2}) scale({size/1024})" color="{ink}">{body}</g>')
            items.append(f'<text x="{x+size/2}" y="1250" text-anchor="middle" fill="{ink}" font-size="20">{size}</text>')
    preview = svg(1800, 1370, '<g font-family="Segoe UI">' + "".join(items) + '</g>', "Selected Const logo family, light and dark")
    write_svg(ROOT / "previews" / "brand-kit-overview.svg", preview)
    (ROOT / "previews" / "brand-kit-overview.png").write_bytes(resvg_py.svg_to_bytes(
        svg_string=preview, skip_system_fonts=True,
        font_files=[str(Path("C:/Windows/Fonts/segoeui.ttf"))],
        font_family="Segoe UI", sans_serif_family="Segoe UI",
    ))

    checker = ['<defs><pattern id="checker" width="32" height="32" patternUnits="userSpaceOnUse"><rect width="32" height="32" fill="#e1e1e1"/><path d="M0 0h16v16H0z M16 16h16v16H16z" fill="#bdbdbd"/></pattern></defs>', '<rect width="1800" height="700" fill="url(#checker)"/>']
    for index, brand in enumerate(["const", "harness", "router"]):
        x = index * 600
        checker.append(f'<g color="{INK}">{place(symbols[brand], x+165, 60, 270, 270)}</g>')
        checker.append(f'<g color="#ffffff">{place(symbols[brand], x+165, 370, 270, 270)}</g>')
    (ROOT / "previews" / "transparent-check.png").write_bytes(resvg_py.svg_to_bytes(svg_string=svg(1800, 700, "".join(checker), "Actual transparent symbol exports")))


def validate() -> dict:
    count_svg = count_png = 0
    for path in ROOT.rglob("*.svg"):
        root = ET.fromstring(path.read_text(encoding="utf-8"))
        if any(e.tag.rsplit("}", 1)[-1] == "image" for e in root.iter()):
            raise ValueError(f"Embedded raster in SVG: {path}")
        if not any(e.tag.rsplit("}", 1)[-1] == "path" for e in root.iter()):
            raise ValueError(f"No vector paths: {path}")
        if "previews" not in path.parts and any(e.tag.rsplit("}", 1)[-1] == "text" for e in root.iter()):
            raise ValueError(f"Logo depends on an external font: {path}")
        count_svg += 1
    for path in ROOT.rglob("*.png"):
        if "sources" in path.parts or "previews" in path.parts:
            continue
        image = Image.open(path).convert("RGBA")
        alpha = image.getchannel("A")
        if "transparent" in path.stem or "dock" in path.stem:
            if alpha.getextrema() != (0, 255) or alpha.getpixel((0, 0)) != 0:
                raise ValueError(f"Missing actual alpha: {path}")
        elif alpha.getextrema() != (255, 255):
            raise ValueError(f"Unexpected alpha on opaque logo: {path}")
        count_png += 1
    for variant in VARIANTS:
        const_png = ROOT / "const/symbol" / f"const-symbol-{variant}.png"
        accounts_png = ROOT / "accounts/symbol" / f"accounts-symbol-{variant}.png"
        if const_png.read_bytes() != accounts_png.read_bytes():
            raise ValueError("Const and Accounts symbol exports differ")
    for brand in DISPLAY:
        for layout in ["symbol", "horizontal", "stacked"]:
            folder = ROOT / brand / layout
            light_alpha = Image.open(folder / f"{brand}-{layout}-light-transparent.png").getchannel("A")
            dark_alpha = Image.open(folder / f"{brand}-{layout}-dark-transparent.png").getchannel("A")
            if ImageChops.difference(light_alpha, dark_alpha).getbbox():
                raise ValueError(f"Theme silhouettes differ: {brand}/{layout}")
    native = {}
    for theme in ["light", "dark"]:
        base = ROOT / "harness/dock" / f"harness-dock-{theme}"
        ico = Image.open(base.with_suffix(".ico"))
        ico_sizes = sorted(ico.ico.sizes())
        if (256, 256) not in ico_sizes or (16, 16) not in ico_sizes:
            raise ValueError("ICO is missing required resolutions")
        for size in ico_sizes:
            decoded = ico.ico.getimage(size).convert("RGBA")
            if decoded.size != size or decoded.getpixel((0, 0))[3] != 0:
                raise ValueError("ICO frame decode/alpha failed")
        icns = Image.open(base.with_suffix(".icns"))
        if not any(max(size[:2]) * (size[2] if len(size) > 2 else 1) == 1024 for size in icns.info["sizes"]):
            raise ValueError("ICNS is missing 1024px artwork")
        icns.load()
        if icns.size != (1024, 1024) or icns.convert("RGBA").getpixel((0, 0))[3] != 0:
            raise ValueError("ICNS decode/alpha failed")
        native[theme] = {"ico_sizes": ico_sizes, "icns_sizes": icns.info["sizes"]}
    return {
        "passed": True, "vector_svg_count": count_svg, "export_png_count": count_png,
        "real_alpha_verified": True, "const_accounts_symbols_identical": True,
        "native_icons": native, "source_trace_metrics": METRICS,
    }


def main() -> None:
    symbols = {name: trace(f"{name}-symbol", *source) for name, source in SOURCES.items()}
    symbols["accounts"] = symbols["const"]
    words = outlined_wordmarks()
    for brand in ["const", "accounts", "harness", "router"]:
        save_family(brand, symbols[brand], words[brand])
    dock = export_dock(symbols["harness"])
    write_previews(symbols, words, dock)
    report = validate()
    (ROOT / "validation.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    manifest = {
        "version": 1, "date": "2026-11-21",
        "selection": {"const": "Trajectory from attachment 1", "accounts": "Identical Const symbol", "harness": "Original approved Lift", "router": "Three-ended Presence branch, explicitly confirmed by user"},
        "variants": {key: {"ink": ink, "background": background or "transparent alpha"} for key, (ink, background) in VARIANTS.items()},
        "layouts": ["symbol", "horizontal", "stacked"],
        "raster_sizes": {"symbol": "1024 x 1024", "horizontal": "2048 px wide, aspect ratio preserved", "stacked": "1536 x 1536", "dock": "16, 20, 24, 32, 40, 48, 64, 96, 128, 256, 512, 1024 px"},
        "master_format": "Actual Bezier path SVGs; no embedded PNGs and no external font dependencies",
        "typography": {"family": "Inter Variable", "weight": 700, "optical_size": 32, "tracking_em": -0.01, "source": "https://github.com/rsms/inter", "license": "sources/fonts/Inter-LICENSE.txt", "method": "Consistent clean outlined type; approved symbols retain their original silhouettes."},
        "method": "Deterministic raster-to-vector tracing and theme exports. Approved geometry preserved; no AI image regeneration.",
        "deployment": "Accounts, Router and Harness assets are integrated by scripts/sync-brand-assets.py; the Const landing site is deferred.",
        "source_sha256": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in (ROOT / "sources").glob("*.png")},
        "dependencies": {"pillow": "13.0.0", "vtracer": "0.6.15", "resvg-py": "0.5.0", "fonttools": "4.68.0", "uharfbuzz": "0.57.0"},
    }
    (ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (ROOT / "README.txt").write_text(
        "CONST FAMILY / BRAND KIT V1\n\n"
        "Const and Accounts share the Trajectory symbol. Harness uses the original Lift.\n"
        "Router uses the three-ended Presence branch confirmed in the chat.\n\n"
        "Folders: const/, accounts/, harness/, router/. Each includes symbol, horizontal\n"
        "and stacked variants, in SVG and PNG. Symbol PNGs are 1024px; horizontal logos\n"
        "are 2048px wide; stacked logos are 1536px square.\n\n"
        "light: charcoal artwork on warm white. dark: white artwork on charcoal.\n"
        "light-transparent: charcoal artwork with real alpha.\n"
        "dark-transparent: white artwork with real alpha.\n\n"
        "masters/: scalable currentColor vector symbols and outlined wordmarks.\n"
        "SVG files contain editable Bezier paths, not embedded raster images.\n"
        "Wordmarks use consistent Inter Bold, converted to outlines; no fonts required.\n"
        "Original font and OFL license are included under sources/fonts/.\n\n"
        "harness/dock/: rounded tiles with transparent outer corners, SVG, PNG in 12\n"
        "sizes, multi-resolution ICO for Windows and ICNS for macOS; light and dark.\n"
        "The rounded tile is only for Harness app/dock use. Transparent symbol files\n"
        "remain unboxed for navigation bars and general brand usage.\n\n"
        "previews/: light/dark overview and checkerboard alpha verification.\n"
        "validation.json: vector fidelity, alpha and native format checks.\n"
        "sources/: exact selected concept references retained for provenance.\n\n"
        "Rebuild from this folder using the uv command at the top of build_brand_kit.py.\n"
        "Apply or verify the approved app integration from the repository root:\n"
        "uv run --no-project --with pillow==13.0.0 --with resvg-py==0.5.0 scripts/sync-brand-assets.py [--check]\n"
        "Accounts, Router and Harness are included. The Const landing site is deferred.\n",
        encoding="utf-8",
    )
    archive = ROOT.with_suffix(".zip")
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as package:
        for path in sorted(ROOT.rglob("*")):
            if path.is_file() and "__pycache__" not in path.parts:
                package.write(path, Path(ROOT.name) / path.relative_to(ROOT))
    print(json.dumps({"kit": str(ROOT), "archive": str(archive), "validation": report}, indent=2))


if __name__ == "__main__":
    main()
