#!/usr/bin/env python3
"""
Generates the static Open Graph image: og-image.png (1200x630).

This file is what WhatsApp, Slack, LinkedIn, X and Facebook unfurl, so it has to
carry the brand on its own: the mark alone ("SB" on navy) was legible but said
nothing about what the site is. The layout is therefore mark + wordmark +
one-line value proposition + domain, all inside the 1080x540 central safe area
that some clients crop to.

1200x630 (1.91:1) is exactly Twitter's `summary_large_image` ratio and matches
the dimensions advertised in `src/app/layout.tsx` and `src/lib/seo.ts`. Do not
change one without the others, or crawlers get a size that disagrees with the
file.

Run with `python3 scripts/generate-og-image.py` (needs Pillow). The output is
committed; it is not generated at build time.
"""

import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(ROOT, "public")
BACKGROUND = "#020617"
SURFACE = "#0f172a"
DIVIDER = "#1e293b"
BLUE = "#3b82f6"
WHITE = "#ffffff"
MUTED = "#94a3b8"
FAINT = "#64748b"

WIDTH, HEIGHT = 1200, 630
MARGIN = 88


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """The bundled DejaVu Bold, with the system copies as a fallback."""
    font_paths = [
        os.path.join(PUBLIC_DIR, "fonts", "DejaVuSans-Bold.ttf"),
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/System/Library/Fonts/HelveticaBold.ttf",
    ]

    for font_path in font_paths:
        if os.path.exists(font_path):
            try:
                return ImageFont.truetype(font_path, size)
            except OSError:
                continue

    # Last resort. Text will still render, just not at the intended size.
    return ImageFont.load_default()


def create_og_image(output_path: str) -> None:
    """Create the 1200x630 card."""
    img = Image.new("RGB", (WIDTH, HEIGHT), hex_to_rgb(BACKGROUND))
    draw = ImageDraw.Draw(img)

    mark_font = load_font(64)
    word_font = load_font(80)
    tagline_font = load_font(38)
    domain_font = load_font(28)

    # --- Brand mark: the same rounded tile, white S / blue B as the favicon ---
    tile = 128
    tile_x, tile_y = MARGIN, MARGIN
    draw.rounded_rectangle(
        [tile_x, tile_y, tile_x + tile, tile_y + tile],
        radius=28,
        fill=hex_to_rgb(SURFACE),
        outline=hex_to_rgb(DIVIDER),
        width=2,
    )

    center_y = tile_y + tile // 2
    s_width = draw.textlength("S", font=mark_font)
    b_width = draw.textlength("B", font=mark_font)
    mark_x = tile_x + (tile - (s_width + b_width)) / 2
    draw.text((mark_x, center_y), "S", font=mark_font, fill=WHITE, anchor="lm")
    draw.text((mark_x + s_width, center_y), "B", font=mark_font, fill=BLUE, anchor="lm")

    # --- Wordmark: "Scholar" white, "Base" blue, matching <BrandMark /> ---
    word_x = tile_x + tile + 36
    draw.text((word_x, center_y), "Scholar", font=word_font, fill=WHITE, anchor="lm")
    draw.text(
        (word_x + draw.textlength("Scholar", font=word_font), center_y),
        "Base",
        font=word_font,
        fill=BLUE,
        anchor="lm",
    )

    # --- Value proposition: two lines, so nothing reaches the crop edge ---
    draw.text(
        (MARGIN, 306),
        "Connect with scholars, share research,",
        font=tagline_font,
        fill=MUTED,
        anchor="lm",
    )
    draw.text(
        (MARGIN, 362),
        "find supervisors and academic opportunities.",
        font=tagline_font,
        fill=MUTED,
        anchor="lm",
    )

    # --- Footer: hairline + domain, the one thing a shared card must state ---
    draw.rectangle([MARGIN, 486, WIDTH - MARGIN, 488], fill=hex_to_rgb(DIVIDER))
    draw.text((MARGIN, 540), "scholarbase.app", font=domain_font, fill=FAINT, anchor="lm")

    img.save(output_path, "PNG", optimize=True)


def main() -> None:
    create_og_image(os.path.join(PUBLIC_DIR, "og-image.png"))
    print(f"Generated og-image.png ({WIDTH}x{HEIGHT})")
    print("Done!")


if __name__ == "__main__":
    main()
