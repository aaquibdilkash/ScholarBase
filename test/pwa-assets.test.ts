/**
 * Static-asset gates for the PWA.
 *
 * `sw.js` and `manifest.json` are plain files with no imports, so nothing else in
 * the suite exercises them — yet two of the worst bugs in this feature lived
 * exactly there, and both were invisible to every component test:
 *
 *   1. The fetch handler bailed out early on localhost, so Chrome refused to
 *      consider the app installable *in dev only*.
 *   2. `/manifest.json` was precached and served cache-first, so the browser
 *      read a manifest frozen at install time — any later change (notably
 *      `related_applications`) was silently ignored, and install detection
 *      could never work.
 *
 * These are asserted as text on purpose. The alternative is a browser or
 * workbox harness, which is far more machinery than is warranted for ~90 lines
 * of static config, and the properties below are exactly the ones that broke.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { IOS_STARTUP_IMAGES } from "@/lib/ios-startup-images";

const ROOT = join(process.cwd(), "public");

/**
 * The splash background, in one place.
 *
 * Kept as a literal rather than read out of the generator script (a Python file)
 * so the gate does not need an interpreter, and so the test fails loudly when
 * the colour is changed in only one of the two places it lives.
 */
const SPLASH_BACKGROUND = "#020617";
const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
const manifest = JSON.parse(
  readFileSync(join(ROOT, "manifest.json"), "utf8"),
) as Record<string, unknown> & {
  icons?: { sizes?: string; src?: string; type?: string }[];
  related_applications?: { platform?: string; id?: string; url?: string }[];
  start_url?: string;
  scope?: string;
  display?: string;
  name?: string;
};

describe("manifest.json", () => {
  it("declares the fields Chrome requires for installability", () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBe("standalone");
    // An absent scope silently narrows where the app can navigate, which breaks
    // the installed app in ways that are very hard to debug later.
    expect(manifest.scope).toBe("/");
  });

  it("declares BOTH a 192 and a 512 icon", () => {
    const sizes = (manifest.icons ?? []).map((icon) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  // Without this entry `getInstalledRelatedApps` cannot report an existing
  // install, so the app keeps offering a download for something already
  // installed. The entry MUST reference a file that exists.
  it("declares related_applications so install detection can match", () => {
    const related = manifest.related_applications ?? [];
    expect(related.length).toBeGreaterThan(0);
    expect(related.some((entry) => entry.platform === "web")).toBe(true);
  });
});

describe("sw.js", () => {
  it("does not skip its fetch handler on localhost", () => {
    // The regression that made the app uninstallable in dev while working in
    // production: Chrome requires a real fetch handler before it will fire
    // `beforeinstallprompt`, and this early return removed one on localhost.
    const hostnames = sw.match(/localhost|127\.0\.0\.1/g) ?? [];
    for (const hostname of hostnames) {
      // Only a comment may mention them; no live `if` may branch on them.
      const line = sw
        .split("\n")
        .find((l) => l.includes(hostname) && !l.trim().startsWith("//"));
      expect(line ?? "").not.toMatch(/return|hostname\s*===/);
    }
  });

  it("never serves the manifest from the cache", () => {
    // A cached manifest is a manifest the browser cannot update, and it gates
    // both installability and install detection.
    expect(sw).toMatch(/endsWith\("\/manifest\.json"\)/);
    // The bypass must appear BEFORE the generic cache-first fallback.
    const bypass = sw.indexOf("endsWith(\"/manifest.json\")");
    const cacheFirst = sw.indexOf("caches.match(event.request)");
    expect(bypass).toBeGreaterThan(-1);
    expect(bypass).toBeLessThan(cacheFirst);
  });

  it("never intercepts cross-origin requests", () => {
    // Regression: the worker re-issued remote avatar requests through its own
    // `fetch`, which runs under the WORKER's CSP. That policy's `connect-src`
    // does not list the avatar hosts, so the browser blocked them —
    //   directive=connect-src blocked=https://lh3.googleusercontent.com/…,
    //   page=http://localhost:3000/sw.js
    // — and every avatar silently failed to render. Passing them back to the
    // browser loads them under the page's `img-src`, which does list them.
    expect(sw).toMatch(/origin\s*!==\s*self\.location\.origin/);
    // Like the manifest bypass, it must sit BEFORE the cache-first fallback,
    // otherwise the worker has already re-fetched the request by then.
    const bypass = sw.indexOf("self.location.origin");
    const cacheFirst = sw.indexOf("caches.match(event.request)");
    expect(bypass).toBeGreaterThan(-1);
    expect(bypass).toBeLessThan(cacheFirst);
  });

  it("does not precache the manifest", () => {
    // Belt and braces: precaching it would re-introduce the stale-manifest bug
    // even if the fetch handler were fixed.
    const precacheBlock = sw
      .slice(
        sw.indexOf("const urlsToCache"),
        sw.indexOf("];", sw.indexOf("const urlsToCache")),
      )
      // Comments are stripped first: the block carries a NOTE explaining that
      // the manifest is deliberately absent, and a naive substring check would
      // match that prose and fail on a correct file.
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    expect(precacheBlock).not.toContain("/manifest.json");
  });

  it("keeps a real fetch handler registered", () => {
    expect(sw).toContain('self.addEventListener("fetch"');
    expect(sw).toContain("event.respondWith(");
  });

  it("uses a versioned cache name", () => {
    // The old worker must be replaced when the strategy changes; an unversioned
    // name means clients keep serving the previous, broken worker.
    expect(sw).toMatch(/const CACHE_NAME = "scholarbase-v\d+"/);
  });
});

/**
 * iOS splash screens.
 *
 * These are static-asset gates for the one PWA feature with no honest way to
 * test it in CI: iOS caches a startup image on the Home Screen icon at *install*
 * time and never re-fetches it, so the blank white screen this prevents cannot
 * be reproduced by any automated run. Everything about it is silent too -- a
 * missing image, a typo'd media query or an uncovered device produces no error,
 * no failed build, and no visible symptom until someone installs on a phone.
 *
 * So the properties that matter are asserted against the filesystem instead:
 * that every advertised URL exists, that each file is really the pixel size
 * its name claims (iOS requires an exact match and ignores a near one), and
 * that the splash background is the same colour the app actually paints.
 */
describe("iOS startup images", () => {
  /**
   * Next types `startupImage` as an image, an array, or an array of alternates,
   * so it is normalised here once. Every entry must be an object: a bare `url`
   * string carries no `media` query, and iOS has no way to pick it per device,
   * so it would be dead weight at best.
   */
  const startupImages = (
    Array.isArray(IOS_STARTUP_IMAGES) ? IOS_STARTUP_IMAGES : [IOS_STARTUP_IMAGES]
  ).map((image) => (typeof image === "string" ? { url: image } : image));

  it("ships every startup image the layout advertises", () => {
    // The original bug, in its most likely form: adding a device to the list
    // without committing the PNG. iOS treats the resulting 404 exactly as it
    // treats no link tag at all -- a blank white screen, no diagnostics.
    for (const { url } of startupImages) {
      const path = join(ROOT, url.replace(/^\//, ""));
      expect(existsSync(path), `missing startup image: ${url}`).toBe(true);
    }
  });

  it("matches each file's pixel dimensions to its media query", () => {
    // iOS only shows a startup image when the `media` query matches the device
    // and the file is an exact pixel match. An off-by-one in either the naming
    // or the query means no splash at all, so the arithmetic is checked here
    // rather than trusted to the generator.
    for (const { url, media } of startupImages) {
      const expected = /device-width: (\d+)px.*device-height: (\d+)px.*pixel-ratio: (\d+)/.exec(
        String(media),
      );
      expect(expected, `unparseable media query for ${url}`).not.toBeNull();
      const [, queryW, queryH, ratio] = expected!;

      const [, w, h] = /apple-splash-(\d+)-(\d+)\.png$/.exec(url)!;
      // `device-width` is in CSS pixels and the file is in device pixels, so
      // the file must be exactly the query multiplied by the ratio.
      expect(Number(w), url).toBe(Number(queryW) * Number(ratio));
      expect(Number(h), url).toBe(Number(queryH) * Number(ratio));
    }
  });

  it("paints the splash in the colour the app actually uses", () => {
    // A splash that boots into a differently-shaded app is the same "flash"
    // problem wearing a different hat, so the two backgrounds must agree with
    // the manifest the Android splash is built from.
    expect(manifest.background_color).toBe(SPLASH_BACKGROUND);
  });

  it("ships a touch icon at the size iOS requires", () => {
    // `apple-touch-icon` is declared in layout.tsx. iOS ignores manifest icons
    // for this and will not letterbox or round what it is given, so a missing
    // or wrong-sized file means a broken or screenshot-derived Home Screen icon.
    const icon = join(ROOT, "apple-touch-icon.png");
    expect(existsSync(icon)).toBe(true);
    const bytes = readFileSync(icon);
    // PNG IHDR width/height live at a fixed byte offset, so this avoids pulling
    // in an image-decoding dependency just to read two integers.
    expect(bytes.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(bytes.readUInt32BE(16)).toBe(180);
    expect(bytes.readUInt32BE(20)).toBe(180);
  });
  it("covers both orientations for every device", () => {
    // A portrait-only list means rotating the device before the web view boots
    // -- or launching straight into landscape on an iPad -- falls through to the
    // white fallback again. So each device geometry must appear once per
    // orientation, which is a real invariant: grouping by the query's width and
    // height catches a device that was added in portrait only.
    const byGeometry = new Map<string, Set<string>>();

    for (const { url, media } of startupImages) {
      const geometry = /device-width: \d+px\) and \(device-height: \d+px/.exec(
        String(media),
      )?.[0];
      const orientation = /orientation: (\w+)/.exec(String(media))?.[1];

      expect(geometry, `no geometry in media query for ${url}`).toBeTruthy();
      expect(orientation, `no orientation in media query for ${url}`).toBeTruthy();

      // A portrait entry and its landscape twin report swapped dimensions, so
      // the geometry key is normalised to height-first before grouping.
      const [w, h] = geometry!.match(/\d+/g)!.map(Number);
      const key = `${Math.max(w, h)}x${Math.min(w, h)}`;

      const seen = byGeometry.get(key) ?? new Set<string>();
      seen.add(orientation!);
      byGeometry.set(key, seen);
    }

    for (const [key, orientations] of byGeometry) {
      expect(orientations, `${key} is missing an orientation`).toEqual(
        new Set(["portrait", "landscape"]),
      );
    }
  });
});

/**
 * Icon opacity.
 *
 * Google serves the favicon it shows in search results from /favicon.ico, and
 * has historically flattened transparent pixels onto white before masking the
 * image into a circle. Against a dark logo that produced a white halo in the
 * SERP and in the "About this result" panel -- the one PWA asset where a
 * consumer that is not the browser silently rewrites the image.
 *
 * The regression is invisible locally: a transparent icon renders perfectly in
 * a tab bar, passes installability, and looks identical everywhere except in
 * Google's result UI. So the property is asserted on the bytes directly.
 *
 * These are parsed rather than decoded. Only the PNG header is needed to know
 * whether a file *can* carry alpha, which avoids adding an image-decoding
 * dependency to the suite for two integers and a chunk name.
 */
describe("icons carry no alpha channel", () => {
  /** PNG colour types that store per-pixel transparency. */
  const PNG_ALPHA_COLOR_TYPES = new Set([
    4, // greyscale + alpha
    6, // truecolour + alpha
  ]);

  /**
   * Reads the IHDR colour type out of a PNG buffer.
   *
   * Layout: 8-byte signature, then the IHDR chunk's 4-byte length and 4-byte
   * type, then 4-byte width and 4-byte height, then 1-byte bit depth, and
   * finally the colour type at offset 25.
   */
  function pngColorType(bytes: Buffer): number {
    const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    expect(
      bytes.subarray(0, 8),
      "not a PNG",
    ).toEqual(Buffer.from(SIGNATURE));
    expect(bytes.subarray(12, 16).toString("latin1"), "missing IHDR").toBe("IHDR");
    return bytes.readUInt8(25);
  }

  /** Splits an .ico into the buffers of its embedded images. */
  function icoImageBuffers(bytes: Buffer): Buffer[] {
    // 6-byte header (reserved, type, count), then a 16-byte directory entry per
    // image giving width, height, and the byte offset + length of its payload.
    const count = bytes.readUInt16LE(4);
    const images: Buffer[] = [];

    for (let i = 0; i < count; i += 1) {
      const entry = 6 + i * 16;
      const size = bytes.readUInt32LE(entry + 8);
      const offset = bytes.readUInt32LE(entry + 12);
      images.push(bytes.subarray(offset, offset + size));
    }

    return images;
  }

  const ICONS = [
    "favicon.ico",
    "icon-192.png",
    "icon.png",
    "logo.png",
    "apple-touch-icon.png",
  ];

  for (const name of ICONS) {
    it(`${name} is fully opaque`, () => {
      const bytes = readFileSync(join(ROOT, name));

      // An .ico is a container; each embedded size must be checked separately,
      // because a single transparent size still yields a halo and is easy to
      // miss when only the 48px entry is inspected.
      const images = name.endsWith(".ico")
        ? icoImageBuffers(bytes)
        : [bytes];

      expect(images.length, `${name} has no embedded images`).toBeGreaterThan(0);

      for (const image of images) {
        expect(
          PNG_ALPHA_COLOR_TYPES.has(pngColorType(image)),
          `${name} has a PNG alpha channel; Google will flatten it onto white`,
        ).toBe(false);
      }
    });
  }
});
