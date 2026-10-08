import { describe, expect, it } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, basename, extname } from "node:path"
import { COMMENT_TYPE_TO_MODULE, ENTITY_CONFIG, type ModuleKey } from "@/lib/transactions"

/**
 * Completeness gate.
 *
 * "Every module has a test" is the kind of promise that silently rots once a
 * feature lands. This file turns it into a CI check: any *new* production module
 * that arrives without a test fails the run, and any module that gains one must
 * be removed from the pending list below. The list can only ever shrink.
 */

const ROOT = process.cwd()
const SRC = join(ROOT, "src")
const TEST = join(ROOT, "test")

function walk(dir: string, match: (path: string) => boolean): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) found.push(...walk(full, match))
    else if (match(full)) found.push(full)
  }
  return found
}

const testFiles = walk(TEST, (p) => p.endsWith(".test.ts") || p.endsWith(".test.tsx"))

/**
 * This file is the gate, not evidence for the gate: it necessarily names every
 * module it polices, so counting its own text would mark everything covered.
 */
const GATE_FILE = "manifest.test.ts"
const evidenceFiles = testFiles.filter((path) => basename(path) !== GATE_FILE)
const testCorpus = evidenceFiles.map((path) => readFileSync(path, "utf8")).join("\n")

/**
 * A module counts as covered when a test file is named exactly after it, or a
 * test actually imports it: `from "@/app/actions/comments"`.
 *
 * Both rules are strict on purpose. Substring matching was tried first and
 * self-defeated: this file's own prose mentions `app/actions/feed.ts`, which
 * made Vitest report `feed` as covered while coverage showed it at 0%.
 */
function isCovered(moduleName: string, importPath: string): boolean {
  const stem = norm(moduleName)
  if (evidenceFiles.some((path) => testStem(path) === stem)) return true
  return importSpecifier(importPath).test(testCorpus)
}

/**
 * Matches a real module specifier — `from "@/app/actions/comments"` or
 * `await import("@/app/actions/comments")` — not a path mentioned in prose.
 * Without the `from` / `import(` anchor, a doc comment that merely *shows* an
 * import would mark that module covered, which is exactly the self-defeating
 * false positive this gate had at first.
 *
 * The dynamic form matters: several suites deliberately `await import(...)` an
 * action inside each test so the module is re-evaluated with the current
 * harness state. Those are real dependencies, and matching only `from` made the
 * gate report them as untested — which it did, on four modules.
 */
function importSpecifier(importPath: string): RegExp {
  const escaped = importPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`(?:from\\s*|import\\s*\\(\\s*)["'\`]@/${escaped}["'\`]`)
}

function testStem(path: string): string {
  return norm(basename(path).replace(/\.test\.tsx?$/, ""))
}

function norm(value: string): string {
  return value.replace(/[-_.]/g, "")
}

/**
 * Production modules not yet under test. Ratchet: delete an entry as soon as the
 * module has a test. Adding to this list is a deliberate, reviewable act.
 *
 * Pruned in Phase 1a: the delete path of all 17 content modules — permission
 * attribution (AUTHOR / POST_AUTHOR / ADMIN), soft-delete, counter decrement and
 * RULE 3 reputation reversal — is now covered by
 * `test/transactions/deletion-reversal.test.ts`, so those entries were removed
 * as the gate requires.
 *
 * Pruned 2026-09-30: `reports` — the admin `moderateContent` DELETE/RECOVER
 * matrix (reputation reversal + materialized counters per content type,
 * anonymous-content counter skipping, and no double-charge / no rep-farming) is
 * now covered by `test/transactions/admin-moderation.test.ts`, with the map
 * key-sets guarded by `test/security/admin-moderation-maps.test.ts`.
 *
 * Pruned 2026-09-30: `messages` and `scholars` — both are now imported by
 * `test/security/search-surfaces.test.ts`, which asserts the P0-3 search
 * throttle reaches the inbox search and the scholar picker.
 *
 * Pruned with the launch-audit H3 fix: `contact` — the public contact form
 * now has `test/actions/contact-turnstile.test.ts` (Turnstile gate, the
 * unconditional rate limits, and the no-send guarantees).
 */
const PENDING_ACTION_TESTS = [
  // Still untested: the login/signup/oauth surface itself, the outreach and
  // push-admin paths, and the client-side comment wrappers.
  // Everything else that used to sit here now has a test; the gate below fails
  // if one of these gains a test and is not removed from this list.
  "adminInvite",
  "cloudinary",
  "comments.clientWrappers",
  "notifications",
]

/**
 * `article.ts` and `feed.ts` used to sit here. Both were deleted when every
 * listing moved into the single `registry.ts` — see the ARCH consolidation in
 * `docs/security-scale-checklist.md` — so the baseline is empty rather than
 * pointing at files that no longer exist.
 */
const PENDING_TRISPLIT_TESTS: string[] = []

describe("test manifest: nothing new ships untested", () => {
  const actionFiles = walk(
    join(SRC, "app", "actions"),
    (p) => extname(p) === ".ts" && !p.endsWith(".d.ts"),
  ).map((p) => basename(p, ".ts"))

  it.each(actionFiles)("action module '%s' is covered or explicitly pending", (module_) => {
    const covered = isCovered(module_, `app/actions/${module_}`)
    const pending = PENDING_ACTION_TESTS.includes(module_)

    if (covered) {
      expect(
        pending,
        `'${module_}' now has a test — remove it from PENDING_ACTION_TESTS.`,
      ).toBe(false)
    } else {
      expect(
        pending,
        `'${module_}' has no test. Write one, or add it to PENDING_ACTION_TESTS ` +
          `in test/manifest.test.ts and open a follow-up.`,
      ).toBe(true)
    }
  })

  const triSplitModules = walk(join(SRC, "lib", "tri-split", "modules"), (p) => extname(p) === ".ts").map(
    (p) => basename(p, ".ts"),
  )

  it.each(triSplitModules)("tri-split module '%s' is covered or explicitly pending", (module_) => {
    const covered = isCovered(module_, `tri-split/modules/${module_}`)
    const pending = PENDING_TRISPLIT_TESTS.includes(module_)
    if (covered) expect(pending, `'${module_}' now has a test — prune the baseline.`).toBe(false)
    else expect(pending, `'${module_}' has no test and is not in the baseline.`).toBe(true)
  })

  it("the pending baseline holds no stale entries", () => {
    const stale = PENDING_ACTION_TESTS.filter((name) => isCovered(name, `app/actions/${name}`))
    expect(stale, "these are now tested; remove them from the baseline").toEqual([])
  })

  it("the tri-split pending baseline holds no stale entries", () => {
    // Added after `article.ts` / `feed.ts` were deleted: the action baseline had
    // a staleness check but this one did not, so it kept naming files that no
    // longer existed and nobody noticed.
    const stale = PENDING_TRISPLIT_TESTS.filter((name) =>
      isCovered(name, `tri-split/modules/${name}`),
    )
    expect(stale, "these are now tested; remove them from the baseline").toEqual([])
  })

  it("the tri-split pending baseline has no typos", () => {
    const known = new Set(triSplitModules)
    const unknown = PENDING_TRISPLIT_TESTS.filter((name) => !known.has(name))
    expect(
      unknown,
      "these tri-split modules do not exist — delete them from the baseline",
    ).toEqual([])
  })

  it("the pending baseline has no typos", () => {
    const known = new Set(actionFiles)
    const unknown = PENDING_ACTION_TESTS.filter((name) => !known.has(name))
    expect(unknown, "these action files do not exist").toEqual([])
  })
})

describe("entity registry contracts", () => {
  const MODULES = Object.keys(ENTITY_CONFIG) as ModuleKey[]

  it("registers all 17 comment-capable modules", () => {
    expect(MODULES).toHaveLength(17)
  })

  it("every voting module is also comment-capable, in both directions", () => {
    // COMMENT_TYPE_TO_MODULE is keyed by the client-facing comment type string and
    // must stay in lockstep with ENTITY_CONFIG, or a module can be voted on but
    // never commented (or vice versa).
    const commentModules = new Set(Object.values(COMMENT_TYPE_TO_MODULE))
    expect([...commentModules].sort()).toEqual([...MODULES].sort())
  })

  it("every module declares the five delegates the transaction helpers expect", () => {
    for (const key of MODULES) {
      const config = ENTITY_CONFIG[key]
      expect(config, key).toMatchObject({
        model: expect.any(String),
        voteModel: expect.any(String),
        bookmarkModel: expect.any(String),
        commentModel: expect.any(String),
        commentVoteModel: expect.any(String),
        titleField: expect.any(String),
        parentFk: expect.any(String),
        commentFk: expect.any(String),
      })
    }
  })
})
