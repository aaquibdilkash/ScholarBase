#!/usr/bin/env python3
"""
Generates the static Open Graph image: og-image.png (1200x630).
Dark background (#020617), no rounded border, with "SB" text centered.
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

def create_og_image(output_path: str) -> None:
    """Create OG image (1200x630) with dark background and SB text."""
    width, height = 1200, 630
    img = Image.new("RGB", (width, height), hex_to_rgb(BACKGROUND))
    draw = ImageDraw.Draw(img)
    
    # Font size for OG image
    font_size = 260
    font = None
    
    font_paths = [
        os.path.join(PUBLIC_DIR, "fonts", "DejaVuSans-Bold.ttf"),
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/System/Library/Fonts/HelveticaBold.ttf",
    ]
    
    for font_path in font_paths:
        if os.path.exists(font_path):
            try:
                font = ImageFont.truetype(font_path, font_size)
                break
            except:
                continue
    
    if font is None:
        font = ImageFont.load_default()
    
    # Calculate vertical centering using text bbox
    bbox_test = draw.textbbox((0, 0), "SB", font=font)
    center_rel_baseline = (bbox_test[1] + bbox_test[3]) / 2
    start_y = (height / 2) - center_rel_baseline
    
    # Calculate horizontal centering
    text_s = "S"
    text_b = "B"
    bbox_s = draw.textbbox((0, 0), text_s, font=font)
    bbox_b = draw.textbbox((0, 0), text_b, font=font)
    width_s = bbox_s[2] - bbox_s[0]
    width_b = bbox_b[2] - bbox_b[0]
    total_width = width_s + width_b
    start_x = (width - total_width) // 2
    
    # Draw "S" in white
    draw.text((start_x, start_y), text_s, font=font, fill=WHITE)
    
    # Draw "B" in blue
    draw.text((start_x + width_s, start_y), text_b, font=font, fill=BLUE)
    
    img.save(output_path, "PNG", optimize=True)
    print(f"Generated {os.path.relpath(output_path, ROOT)} ({width}x{height})")

def main() -> None:
    create_og_image(os.path.join(PUBLIC_DIR, "og-image.png"))
    print("Done!")

if __name__ == "__main__":
    main()