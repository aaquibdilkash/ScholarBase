/**
 * Regression: a frozen scholar saw the account banner twice on their own
 * profile — the global banner under the navbar (root layout) plus a second
 * `FrozenAccountBanner` rendered by the profile page. The global one is the
 * only entry point; pages must not duplicate it.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const PROFILE_PAGE = join(ROOT, "src", "app", "scholars", "[id]", "page.tsx");

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...walk(full));
    else if (full.endsWith(".tsx")) found.push(full);
  }
  return found;
}

describe("frozen account banner", () => {
  it("renders exactly once, from the root layout", () => {
    const renderedIn = walk(join(ROOT, "src"))
      .filter((file) => /<FrozenAccountBanner\b/.test(readFileSync(file, "utf8")))
      .map((file) => relative(ROOT, file).replaceAll("\\", "/"));

    expect(renderedIn).toEqual(["src/app/layout.tsx"]);
  });

  it("is not duplicated on the scholar profile page", () => {
    const profilePage = readFileSync(PROFILE_PAGE, "utf8");

    expect(profilePage).not.toContain("FrozenAccountBanner");
    expect(profilePage).not.toContain("FrozenProfileAppealCard");
  });
});
