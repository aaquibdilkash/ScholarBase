#!/usr/bin/env python3
"""
Generates the iOS startup images plus the apple-touch-icon.

Why this script and not `npx pwa-asset-generator`
--------------------------------------------------
iOS does not read the Web App Manifest for splash screens; it needs an explicit
`<link rel="apple-touch-startup-image">` whose image is an EXACT 1:1 pixel match
for the device, selected by a `media` query that matches the device width,
height AND pixel ratio precisely. That makes the device list below a piece of
real data, not a formatting exercise -- and a device list that lives only inside
one `npx` invocation is a list nobody can review, diff, or regenerate when a new
iPhone ships.

So the device table is committed here, in reviewable form, and the PNGs in
`public/splash/` are a build artifact of it. Re-run after editing the table:

    python3 scripts/generate-ios-splash.py

iOS reads these at *install* time and caches them for the life of the Home Screen
icon; it never re-fetches. See README note in the file header for testing.

Design constraints
------------------
* Background is `#020617`, the value already declared as `background_color` /
  `theme_color` in `public/manifest.json`. It MUST match, or the app visibly
  jumps between two dark backgrounds at launch -- the exact "flash" this work
  exists to remove. `test/pwa-assets.test.ts` asserts the two agree.
* The emblem is composited from `public/logo.png`, which has a transparent
  border, so no square of icon background shows through.
* The emblem is deliberately small. iOS renders splash images letterboxed at
  launch; a logo larger than roughly a fifth of the shortest edge gets cropped
  on the devices with the tallest aspect ratios.
"""

from __future__ import annotations

import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPLASH_DIR = os.path.join(ROOT, "public", "splash")
LOGO = os.path.join(ROOT, "public", "logo.png")
TOUCH_ICON = os.path.join(ROOT, "public", "apple-touch-icon.png")
MODULE_OUT = os.path.join(ROOT, "src", "lib", "ios-startup-images.ts")

# Must stay in sync with `background_color` in public/manifest.json.
BACKGROUND = "#020617"

# Fraction of the image's shortest edge occupied by the emblem.
LOGO_SCALE = 0.20

# (css_width, css_height, device_pixel_ratio, [device names in comments])
#
# These are CSS pixels as reported by `device-width` / `device-height`, not
# device pixels: the pixel size of the PNG is css * ratio. Several models share a
# geometry, and iOS only cares that the media query matches, so a shared entry
# is correct rather than a duplicate.
IPHONE_DEVICES = [
    # iPhone 16 Pro Max
    (440, 956, 3),
    # iPhone 16 Plus / 15 Plus / 15 Pro Max / 14 Plus / 14 Pro Max
    (430, 932, 3),
    # iPhone 16 Pro / 16 / 15 Pro / 15 / 14 Pro
    (402, 874, 3),
    # iPhone 14 Pro Max / 13 Pro Max / 12 Pro Max
    (428, 926, 3),
    # iPhone 14 / 13 Pro / 13 / 12 Pro / 12
    (390, 844, 3),
    # iPhone 13 mini / 12 mini / 11 Pro / X / XS
    (375, 812, 3),
    # iPhone 11 Pro Max / XS Max
    (414, 896, 3),
    # iPhone 11 / XR
    (414, 896, 2),
    # iPhone 6 Plus / 7 Plus / 8 Plus
    (414, 736, 3),
    # iPhone SE (2nd, 3rd gen) / 8 / 7 / 6s
    (375, 667, 2),
    # iPhone SE (1st gen) / 5s
    (320, 568, 2),
]

IPAD_DEVICES = [
    # iPad Pro 12.9" (1st gen and later)
    (1024, 1366, 2),
    # iPad Pro 11"
    (834, 1194, 2),
    # iPad Air 10.9" / iPad (10th gen)
    (820, 1180, 2),
    # iPad mini (6th gen)
    (744, 1133, 2),
    # iPad (9.7", 6th-9th gen)
    (768, 1024, 2),
]


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def build_splash(width: int, height: int, logo: Image.Image) -> Image.Image:
    """One startup image: flat background, emblem centred.

    `logo` is square, so its side is derived from the *shortest* canvas edge.
    That keeps the emblem the same apparent size on every device instead of
    letting it swell on squarer screens.
    """
    canvas = Image.new("RGB", (width, height), hex_to_rgb(BACKGROUND))

    side = int(round(min(width, height) * LOGO_SCALE))
    emblem = logo.resize((side, side), Image.LANCZOS)

    # Paste through the alpha channel so the logo's transparent margin really
    # is transparent, rather than compositing onto a dark copy of the emblem.
    canvas.paste(emblem, ((width - side) // 2, (height - side) // 2), emblem)
    return canvas


def main() -> None:
    os.makedirs(SPLASH_DIR, exist_ok=True)

    logo = Image.open(LOGO).convert("RGBA")

    # The home-screen icon. iOS ignores manifest icons entirely for this, and
    # never letterboxes or rounds an apple-touch-icon, so it is the full square
    # on the brand background.
    touch = Image.new("RGBA", (180, 180), hex_to_rgb(BACKGROUND) + (255,))
    side = 180
    emblem = logo.resize((side, side), Image.LANCZOS)
    touch.paste(emblem, (0, 0), emblem)
    touch.convert("RGB").save(TOUCH_ICON, "PNG", optimize=True)
    print(f"wrote {os.path.relpath(TOUCH_ICON, ROOT)}")

    written: set[str] = set()
    entries: list[tuple[int, int, int, int, int, str]] = []

    for css_w, css_h, ratio in IPHONE_DEVICES + IPAD_DEVICES:
        for orientation in ("portrait", "landscape"):
            if orientation == "portrait":
                # Media query reports CSS pixels; the file is in device pixels.
                query_w, query_h = css_w, css_h
                width, height = css_w * ratio, css_h * ratio
            else:
                # Rotating swaps which edge is the long one, and the media query
                # follows the rotation -- `device-width` is the *viewport* width,
                # not the panel's native one.
                query_w, query_h = css_h, css_w
                width, height = css_h * ratio, css_w * ratio

            name = f"apple-splash-{width}-{height}.png"
            build_splash(width, height, logo).save(
                os.path.join(SPLASH_DIR, name), "PNG", optimize=True
            )
            written.add(name)
            entries.append((width, height, query_w, query_h, ratio, orientation))

    print(f"wrote {len(written)} startup images to {os.path.relpath(SPLASH_DIR, ROOT)}")

    write_metadata_module(entries)


def write_metadata_module(entries: list[tuple[int, int, int, int, int, str]]) -> None:
    """Emit the TypeScript module the root layout imports.

    Generated from the same device table as the PNGs on purpose: the two must
    never drift. A `startupImage` entry whose file does not exist is not a
    cosmetic mistake, it is the exact condition that leaves iOS showing the
    blank white screen, so the list is written out mechanically and asserted
    against the filesystem in `test/pwa-assets.test.ts`.
    """
    body = "\n".join(
        f"  {{\n"
        f'    url: "/splash/apple-splash-{pxw}-{pxh}.png",\n'
        f"    media:\n"
        f'      "(device-width: {fw}px) and (device-height: {fh}px) and " +\n'
        f'      "(-webkit-device-pixel-ratio: {ratio}) and (orientation: {orientation})",\n'
        f"  }},"
        for pxw, pxh, fw, fh, ratio, orientation in entries
    )

    module = f'''/**
 * iOS startup images -- GENERATED, do not edit by hand.
 *
 * Regenerate with: `python3 scripts/generate-ios-splash.py`
 *
 * iOS ignores the Web App Manifest for splash screens entirely. It only reads
 * `<link rel="apple-touch-startup-image">`, and it will only show one whose
 * `media` query matches the device's width, height and pixel ratio *exactly* --
 * a near miss is treated as no match at all, and Safari falls back to a blank
 * white screen for the whole of the web view boot.
 *
 * That exactness is why this is a generated file rather than a hand-written
 * list: the failure mode is silent. Nothing errors when a query is wrong, a
 * file is renamed, or a device is missed; the app just flashes white again. The
 * generator holds the device table and the pixel math in one place, and
 * `test/pwa-assets.test.ts` checks every URL here against a real file.
 */
import type {{ Metadata }} from "next";

/**
 * The shape `appleWebApp.startupImage` accepts.
 *
 * Extracted rather than imported: Next types `appleWebApp` as
 * `boolean | AppleWebApp`, so reaching the field means narrowing the union
 * first. Deriving it also means a future change to that field breaks here,
 * loudly, instead of silently rejecting the assignment in `layout.tsx`.
 */
type AppleWebAppConfig = Extract<
  NonNullable<Metadata["appleWebApp"]>,
  {{ startupImage?: unknown }}
>;

export const IOS_STARTUP_IMAGES: NonNullable<
  AppleWebAppConfig["startupImage"]
> = [
{body}
];
'''

    with open(MODULE_OUT, "w", encoding="utf-8") as handle:
        handle.write(module)

    print(f"wrote {os.path.relpath(MODULE_OUT, ROOT)}")


if __name__ == "__main__":
    main()
