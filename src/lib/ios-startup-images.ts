/**
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
import type { Metadata } from "next";

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
  { startupImage?: unknown }
>;

export const IOS_STARTUP_IMAGES: NonNullable<
  AppleWebAppConfig["startupImage"]
> = [
  {
    url: "/splash/apple-splash-1320-2868.png",
    media:
      "(device-width: 440px) and (device-height: 956px) and " +
      "(-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    url: "/splash/apple-splash-2868-1320.png",
    media:
      "(device-width: 956px) and (device-height: 440px) and " +
      "(-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
  },
  {
    url: "/splash/apple-splash-1290-2796.png",
    media:
      "(device-width: 430px) and (device-height: 932px) and " +
      "(-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    url: "/splash/apple-splash-2796-1290.png",
    media:
      "(device-width: 932px) and (device-height: 430px) and " +
      "(-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
  },
  {
    url: "/splash/apple-splash-1206-2622.png",
    media:
      "(device-width: 402px) and (device-height: 874px) and " +
      "(-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    url: "/splash/apple-splash-2622-1206.png",
    media:
      "(device-width: 874px) and (device-height: 402px) and " +
      "(-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
  },
  {
    url: "/splash/apple-splash-1284-2778.png",
    media:
      "(device-width: 428px) and (device-height: 926px) and " +
      "(-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    url: "/splash/apple-splash-2778-1284.png",
    media:
      "(device-width: 926px) and (device-height: 428px) and " +
      "(-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
  },
  {
    url: "/splash/apple-splash-1170-2532.png",
    media:
      "(device-width: 390px) and (device-height: 844px) and " +
      "(-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    url: "/splash/apple-splash-2532-1170.png",
    media:
      "(device-width: 844px) and (device-height: 390px) and " +
      "(-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
  },
  {
    url: "/splash/apple-splash-1125-2436.png",
    media:
      "(device-width: 375px) and (device-height: 812px) and " +
      "(-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    url: "/splash/apple-splash-2436-1125.png",
    media:
      "(device-width: 812px) and (device-height: 375px) and " +
      "(-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
  },
  {
    url: "/splash/apple-splash-1242-2688.png",
    media:
      "(device-width: 414px) and (device-height: 896px) and " +
      "(-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    url: "/splash/apple-splash-2688-1242.png",
    media:
      "(device-width: 896px) and (device-height: 414px) and " +
      "(-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
  },
  {
    url: "/splash/apple-splash-828-1792.png",
    media:
      "(device-width: 414px) and (device-height: 896px) and " +
      "(-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
  {
    url: "/splash/apple-splash-1792-828.png",
    media:
      "(device-width: 896px) and (device-height: 414px) and " +
      "(-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
  },
  {
    url: "/splash/apple-splash-1242-2208.png",
    media:
      "(device-width: 414px) and (device-height: 736px) and " +
      "(-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    url: "/splash/apple-splash-2208-1242.png",
    media:
      "(device-width: 736px) and (device-height: 414px) and " +
      "(-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
  },
  {
    url: "/splash/apple-splash-750-1334.png",
    media:
      "(device-width: 375px) and (device-height: 667px) and " +
      "(-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
  {
    url: "/splash/apple-splash-1334-750.png",
    media:
      "(device-width: 667px) and (device-height: 375px) and " +
      "(-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
  },
  {
    url: "/splash/apple-splash-640-1136.png",
    media:
      "(device-width: 320px) and (device-height: 568px) and " +
      "(-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
  {
    url: "/splash/apple-splash-1136-640.png",
    media:
      "(device-width: 568px) and (device-height: 320px) and " +
      "(-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
  },
  {
    url: "/splash/apple-splash-2048-2732.png",
    media:
      "(device-width: 1024px) and (device-height: 1366px) and " +
      "(-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
  {
    url: "/splash/apple-splash-2732-2048.png",
    media:
      "(device-width: 1366px) and (device-height: 1024px) and " +
      "(-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
  },
  {
    url: "/splash/apple-splash-1668-2388.png",
    media:
      "(device-width: 834px) and (device-height: 1194px) and " +
      "(-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
  {
    url: "/splash/apple-splash-2388-1668.png",
    media:
      "(device-width: 1194px) and (device-height: 834px) and " +
      "(-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
  },
  {
    url: "/splash/apple-splash-1640-2360.png",
    media:
      "(device-width: 820px) and (device-height: 1180px) and " +
      "(-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
  {
    url: "/splash/apple-splash-2360-1640.png",
    media:
      "(device-width: 1180px) and (device-height: 820px) and " +
      "(-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
  },
  {
    url: "/splash/apple-splash-1488-2266.png",
    media:
      "(device-width: 744px) and (device-height: 1133px) and " +
      "(-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
  {
    url: "/splash/apple-splash-2266-1488.png",
    media:
      "(device-width: 1133px) and (device-height: 744px) and " +
      "(-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
  },
  {
    url: "/splash/apple-splash-1536-2048.png",
    media:
      "(device-width: 768px) and (device-height: 1024px) and " +
      "(-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
  {
    url: "/splash/apple-splash-2048-1536.png",
    media:
      "(device-width: 1024px) and (device-height: 768px) and " +
      "(-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
  },
];
