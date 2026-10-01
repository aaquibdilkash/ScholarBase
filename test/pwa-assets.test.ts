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
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "public");
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
