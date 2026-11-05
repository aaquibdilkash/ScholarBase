/**
 * Long-title wrapping contract.
 *
 * A single long token (usually a pasted URL used as a title) used to overflow
 * the card's horizontal padding and get clipped by `overflow-x-clip`, because
 * titles had no wrapping utility. `break-words` / `overflow-wrap: anywhere`
 * keeps normal prose wrapping at spaces while still breaking an unbreakable
 * URL, and `truncate` is the acceptable alternative where a line is meant to
 * stay one line.
 *
 * This scans every dynamic detail page heading and every content-card heading
 * so a future card cannot regress to an unwrapped `<h2>`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

const WRAP_UTILITIES = ["break-words", "overflow-wrap", "truncate"];

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...walk(full));
    else if (full.endsWith(".tsx")) found.push(full);
  }
  return found;
}

const headingBlocks = (source: string, tag: "h1" | "h2") =>
  [...source.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "g"))];

const classOf = (block: string) => {
  const match = block.match(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{([^}]*)\})/);
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : "";
};

const isDynamic = (body: string) => body.includes("{");

const wraps = (className: string) =>
  WRAP_UTILITIES.some((utility) => className.includes(utility));

describe("long dynamic titles", () => {
  it("wraps (or truncates) every dynamic detail-page h1", () => {
    const pages = walk(join(ROOT, "src", "app")).filter((file) =>
      /(^|\/)page\.tsx$/.test(file),
    );

    const offenders: string[] = [];
    for (const file of pages) {
      const source = readFileSync(file, "utf8");
      for (const match of headingBlocks(source, "h1")) {
        if (!isDynamic(match[1])) continue;
        if (!wraps(classOf(match[0]))) {
          offenders.push(relative(ROOT, file).replaceAll("\\", "/"));
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("wraps (or truncates) every dynamic card h2", () => {
    const cards = walk(join(ROOT, "src", "components")).filter((file) =>
      /Card\.tsx$/.test(file),
    );

    const offenders: string[] = [];
    for (const file of cards) {
      const source = readFileSync(file, "utf8");
      for (const match of headingBlocks(source, "h2")) {
        if (!isDynamic(match[1])) continue;
        if (!wraps(classOf(match[0]))) {
          offenders.push(relative(ROOT, file).replaceAll("\\", "/"));
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
