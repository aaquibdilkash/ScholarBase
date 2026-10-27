/**
 * Frozen-content wiring contract.
 *
 * A card that does not forward `isFrozen` to its shell renders a frozen post as
 * if nothing happened: the feed (and every other list) looked normal while the
 * detail page said "frozen by moderators". That exact gap shipped in five cards
 * — the social feed, events, grants, courses and publications — because each
 * card repeats the same prop list by hand.
 *
 * There are 17 content cards and 17 detail pages, so this asserts the invariant
 * across all of them instead of trusting 34 hand-edited copies. `ScholarCard` is
 * the only legitimate exception: it lists users, and a user is not freezeable
 * content. Every other shell call site must pass the full moderation shape, and
 * the exception list is checked in both directions so it can never go stale.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

/** Props a shell needs to render the frozen banner and the appeal affordance. */
const REQUIRED_PROPS = [
  "isFrozen=",
  "frozenEntityId=",
  "frozenModule=",
  "frozenEntityType=",
  "frozenOwnerId=",
  "frozenHasActiveAppeal=",
] as const;

/**
 * The user directory. A `User` row has no `isFrozen`, and freezing a scholar is
 * the account-freeze flow (`FrozenAccountBanner`), not content moderation.
 */
const NOT_CONTENT = new Set(["src/components/scholars/ScholarCard.tsx"]);

const SHELLS = ["ListPageCardShell", "DetailPageCardShell"] as const;

function walk(dir: string, match: (path: string) => boolean): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...walk(full, match));
    else if (match(full)) found.push(full);
  }
  return found;
}

const sourceFiles = walk(join(ROOT, "src"), (path) => path.endsWith(".tsx"));

/**
 * Returns the props written at depth 0 of `<Tag …>`, with comments and string
 * contents removed.
 *
 * Strings must be dropped before looking for `>` or `=` — several cards put
 * comment prose and `=>` handlers inside the opening tag, and a naive slice
 * either stopped at a `>` inside a comment or mistook an apostrophe for a quote
 * delimiter. Removing both makes the scan depend on JSX structure, not on the
 * wording of a comment.
 */
function openingTagProps(source: string, tag: string): string | null {
  const start = source.indexOf(`<${tag}`);
  if (start === -1) return null;

  let index = start;
  let depth = 0;
  let quote: string | null = null;
  const kept: string[] = [];

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1] ?? "";

    if (quote) {
      if (char === "\\") {
        index += 2;
        continue;
      }
      if (char === quote) quote = null;
      index += 1;
      continue;
    }

    if (char === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      index += 2;
      while (
        index < source.length &&
        !(source[index] === "*" && source[index + 1] === "/")
      ) {
        index += 1;
      }
      index += 2;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      index += 1;
      continue;
    }

    if (char === "{") depth += 1;
    else if (char === "}") depth -= 1;
    else if (char === ">" && depth === 0 && source[index - 1] !== "=") {
      return kept.join("");
    }

    if (depth === 0) kept.push(char);
    index += 1;
  }

  throw new Error(`unterminated <${tag}> in source`);
}

type CallSite = { file: string; missing: string[] };

const callSites: CallSite[] = [];
for (const file of sourceFiles) {
  const source = readFileSync(file, "utf8");
  for (const shell of SHELLS) {
    const props = openingTagProps(source, shell);
    if (props === null) continue;
    callSites.push({
      file: relative(ROOT, file).replaceAll("\\", "/"),
      missing: REQUIRED_PROPS.filter((prop) => !props.includes(prop)),
    });
  }
}

describe("frozen-content wiring", () => {
  it("finds the shells' call sites at all", () => {
    // Guards against the scan silently matching nothing after a rename.
    expect(callSites.length).toBeGreaterThan(20);
  });

  it("every content card and detail page forwards the frozen shape", () => {
    const unwired = callSites
      .filter((site) => !NOT_CONTENT.has(site.file) && site.missing.length > 0)
      .map((site) => `${site.file}: missing ${site.missing.join(", ")}`);

    expect(unwired).toEqual([]);
  });

  it("keeps the non-content exception list honest", () => {
    const listed = [...NOT_CONTENT].sort();
    const stillUnwired = callSites
      .filter((site) => site.missing.length === REQUIRED_PROPS.length)
      .map((site) => site.file)
      .sort();

    // A stale entry here would silently exempt a real card from the check.
    expect(stillUnwired).toEqual(listed);
  });
});
