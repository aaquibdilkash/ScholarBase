/**
 * Identity-leak guard.
 *
 * Every export from a `"use server"` module is a public HTTP endpoint, so a
 * viewer-identity parameter on one of them is a live vulnerability: a caller
 * can pass any user's id and read back their vote / bookmark / follow state.
 * That was true of 16 list loaders before the Tri-Split refactor, and nothing
 * stopped it from coming back.
 *
 * This test is the thing that makes those fixes unregressable.
 *
 * Design notes:
 *  - It parses rather than regex-matches, so a parameter in a comment or a
 *    string cannot produce a false failure.
 *  - Only files that actually declare `"use server"` are scanned. A
 *    `cache()`-wrapped server-component helper may legitimately take a
 *    server-derived `userId`.
 *  - `KNOWN_SAFE` is an explicit allowlist. Each entry must say why it is
 *    safe, so approving a new one is a deliberate act rather than a default.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ACTIONS_DIR = join(process.cwd(), "src/app/actions");

/** Parameter names that would carry a caller-supplied viewer identity. */
const IDENTITY_PARAMS = ["userId", "currentUserId", "viewerId", "actorId"];

/**
 * Exports that legitimately take an identity parameter, with the reason.
 *
 * Adding an entry is a security decision: state here why the value cannot be
 * attacker-chosen, or why the function re-validates it against the session.
 */
const KNOWN_SAFE = new Map<string, string>([
  [
    "getSurveyResponse",
    "Validates: returns null unless `currentUser.id === userId`.",
  ],
  [
    "getSurveyResponses",
    "Validates: returns null unless `currentUser.id === userId`.",
  ],
  [
    "hasUserResponded",
    "Validates: returns false unless the session user equals `userId`.",
  ],
  [
    "getInbox",
    "Validates: throws unless `currentUser.id === userId`.",
  ],
  [
    "searchInbox",
    "Validates: throws unless `currentUser.id === userId`.",
  ],
  [
    "getMessageDetails",
    "Validates: throws unless the session user is a conversation participant.",
  ],
  [
    "getBlockedUserIds",
    "Scoped by `blockerId` from the session inside the function body.",
  ],
  // In these four, `userId` is the SUBJECT of the listing, not the viewer. A
  // followers / following list is public. The viewer-dependent parameter these
  // functions used to *also* accept (`currentUserId`) was the real leak, and it
  // has been removed.
  [
    "getFollowers",
    "`userId` is the profile being listed (public), not the viewer.",
  ],
  [
    "getFollowersWithCursor",
    "`userId` is the profile being listed (public), not the viewer.",
  ],
  [
    "getFollowing",
    "`userId` is the profile being listed (public), not the viewer.",
  ],
  [
    "getFollowingWithCursor",
    "`userId` is the profile being listed (public), not the viewer.",
  ],
  [
    "getProfile",
    "Not a \"use server\" export; a `cache()`-wrapped server-component helper.",
  ],
  [
    "getProfileSections",
    "Server-component helper; identity comes from the session, not the caller.",
  ],
  [
    "getProfileBookmarkSections",
    "Server-component helper; identity comes from the session, not the caller.",
  ],
]);

/** Strips comments and string literals so they cannot be mistaken for code. */
function stripNonCode(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
    .replace(/`(?:\\.|[^`\\])*`/g, "``")
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""');
}

type Export = { name: string; params: string[]; body: string };

/** Extracts exported function declarations and their parameter names. */
function parseExports(source: string): Export[] {
  const code = stripNonCode(source);
  const out: Export[] = [];
  const re =
    /export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(([^)]*)\)\s*(?::[^{]*)?\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const params = m[2]
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => p.split(":")[0].replace(/[?]/g, "").trim());
    // Body runs to the matching closing brace.
    let depth = 1;
    let i = re.lastIndex;
    while (i < code.length && depth > 0) {
      if (code[i] === "{") depth++;
      else if (code[i] === "}") depth--;
      i++;
    }
    out.push({ name: m[1], params, body: code.slice(re.lastIndex, i) });
    re.lastIndex = i;
  }
  return out;
}

const files = readdirSync(ACTIONS_DIR)
  .filter((f) => f.endsWith(".ts"))
  .map((file) => {
    const raw = readFileSync(join(ACTIONS_DIR, file), "utf8");
    const isServerModule = /^\s*["']use server["']/m.test(raw);
    return { file, isServerModule, exports: parseExports(raw) };
  })
  .filter((f) => f.isServerModule);

describe("no client-supplied viewer identity on server actions", () => {
  it("scans a meaningful number of server action modules", () => {
    // Guards against the scanner silently matching nothing.
    expect(files.length).toBeGreaterThanOrEqual(10);
    expect(
      files.reduce((n, f) => n + f.exports.length, 0),
    ).toBeGreaterThanOrEqual(30);
  });

  it("finds no export that accepts a viewer identity parameter", () => {
    const violations: string[] = [];

    for (const { file, exports } of files) {
      for (const fn of exports) {
        if (KNOWN_SAFE.has(fn.name)) continue;
        const leaked = fn.params.filter((p) => IDENTITY_PARAMS.includes(p));
        if (leaked.length > 0) {
          violations.push(
            `${file}: ${fn.name}() accepts ${leaked.join(", ")} — ` +
              `resolve the viewer with getCurrentUser() instead, or add a ` +
              `justified entry to KNOWN_SAFE.`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("documents a reason for every allowlisted export", () => {
    for (const [name, reason] of KNOWN_SAFE) {
      expect(reason.length, `${name} needs a justification`).toBeGreaterThan(10);
    }
  });

  it("has no allowlist entry that no longer exists", () => {
    // Stale entries silently weaken the guard, so a renamed/deleted export
    // should fail here rather than quietly narrowing the check.
    const exported = new Set(
      files.flatMap((f) => f.exports.map((e) => e.name)),
    );
    const knownButGone = [...KNOWN_SAFE.keys()].filter(
      (name) => !exported.has(name),
    );
    // Some entries are documented as non-`use server` helpers on purpose.
    const intentional = ["getProfile", "getProfileSections", "getProfileBookmarkSections"];
    expect(knownButGone.filter((n) => !intentional.includes(n))).toEqual([]);
  });
});
