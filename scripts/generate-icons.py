#!/usr/bin/env python3
"""
Generates the static PWA icons: logo.png (512x512) and icon-192.png (192x192).
Both have dark background (#020617), no rounded border, with "SB" text.
"""

import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(ROOT, "public")
BACKGROUND = "#020617"
BLUE = "#3b82f6"
WHITE = "#ffffff"

def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i:i+2], 16) for i in (0, 2, 4))

def load_font(font_size: int):
    """Load the boldest available font, preferring the bundled one.

    Falls back through system paths so the script still runs on a machine that
    has not fetched the bundled font, rather than silently producing a
    default-sized glyph that would differ from the committed icons.
    """
    font_paths = [
        os.path.join(PUBLIC_DIR, "fonts", "DejaVuSans-Bold.ttf"),
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/System/Library/Fonts/HelveticaBold.ttf",
    ]

    for font_path in font_paths:
        if os.path.exists(font_path):
            try:
                return ImageFont.truetype(font_path, font_size)
            except Exception:
                continue

    return ImageFont.load_default()


def draw_centered_sb(draw: "ImageDraw.ImageDraw", size: int, font) -> None:
    """Draw the two-tone "SB" glyph pair centred both ways.

    The letters are drawn separately because they carry different colours, so
    they cannot be drawn as one string. Centring is therefore measured from the
    real per-glyph bounding boxes rather than assumed from the advance width.
    """
    text_s = "S"
    text_b = "B"

    bbox_s = draw.textbbox((0, 0), text_s, font=font)
    bbox_b = draw.textbbox((0, 0), text_b, font=font)

    width_s = bbox_s[2] - bbox_s[0]
    width_b = bbox_b[2] - bbox_b[0]
    total_width = width_s + width_b

    # Center horizontally
    start_x = (size - total_width) // 2

    # Proper vertical centering using actual text bounding box
    # bbox[1] = top (negative = above baseline), bbox[3] = bottom (positive = below baseline)
    bbox_test = draw.textbbox((0, 0), "SB", font=font)
    # bbox[1] = top (negative = above baseline), bbox[3] = bottom (positive = below baseline)
    center_rel_baseline = (bbox_test[1] + bbox_test[3]) / 2
    # We want: start_y + center_rel_baseline = size/2
    # So: start_y = size/2 - center_rel_baseline
    start_y = (size / 2) - center_rel_baseline

    # Draw "S" in white
    draw.text((start_x, start_y), text_s, font=font, fill=WHITE)

    # Draw "B" in blue
    draw.text((start_x + width_s, start_y), text_b, font=font, fill=BLUE)


def create_icon(size: int, output_path: str) -> None:
    """Create a square icon with dark background and SB text."""
    # Create base image with dark background
    img = Image.new("RGB", (size, size), hex_to_rgb(BACKGROUND))
    draw = ImageDraw.Draw(img)

    draw_centered_sb(draw, size, load_font(int(size * 0.55)))

    # Save
    img.save(output_path, "PNG", optimize=True)
    print(f"Generated {os.path.relpath(output_path, ROOT)} ({size}x{size})")

def create_favicon_ico(output_path: str) -> None:
    """Create the multi-size favicon.ico with a fully opaque canvas.

    Why this file is generated rather than hand-maintained: it was previously a
    committed binary that nothing in this script produced, which is exactly how
    it drifted into carrying an alpha channel while every other icon was opaque.

    Why opaque matters: Google fetches /favicon.ico for the favicon it shows in
    search results and, historically, flattened transparent pixels onto white
    before masking the image to a circle. Against a dark logo that produced a
    visible white halo around the icon. With a full-bleed opaque canvas there is
    nothing to flatten, so the circular mask clips dark pixels instead.

    This is a deliberate trade-off: the previous rounded corners were only ever
    visible *because* they were transparent, so an opaque canvas is necessarily a
    square. That matches favicon.svg and src/app/icon.tsx, which are also square,
    and browsers that do not mask (tab bars) show a square tile instead of a
    rounded one.
    """
    # Rendered large then downscaled, rather than drawing at each target size.
    # Text hinted onto a 16px grid is noticeably worse than the same glyphs
    # scaled down from a large render, and this is the icon most people see.
    source = Image.new("RGB", (256, 256), hex_to_rgb(BACKGROUND))
    draw = ImageDraw.Draw(source)
    font = load_font(int(256 * 0.55))
    draw_centered_sb(draw, 256, font)

    # Explicit sizes, matching what browsers and Google actually request.
    source.save(
        output_path,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )
    print(f"Generated {os.path.relpath(output_path, ROOT)} (16/32/48, opaque)")


def main() -> None:
    # Generate logo.png (512x512)
    create_icon(512, os.path.join(PUBLIC_DIR, "logo.png"))
    
    # Generate icon-192.png (192x192)
    create_icon(192, os.path.join(PUBLIC_DIR, "icon-192.png"))

    # Generate favicon.ico (16/32/48, opaque -- see the docstring above)
    create_favicon_ico(os.path.join(PUBLIC_DIR, "favicon.ico"))
    
    print("Done!")

if __name__ == "__main__":
    main()