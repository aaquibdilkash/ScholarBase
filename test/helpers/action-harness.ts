/**
 * Shared fixtures for server-action, route-handler and page tests.
 *
 * SCOPE — read before reaching for this. Only the parts that CAN be shared live
 * here. The `vi.mock(...)` stack is deliberately NOT: vitest hoists mock
 * factories above the imports, so each test file must own its own hoisted
 * factories, and every file needs exactly ONE harness instance shared by all of
 * its mocks. A cross-file runtime harness is not expressible; the mock block is
 * a few lines per file and has to stay there.
 *
 * What IS genuinely duplicated across files is the row SHAPE: the exact set of
 * fields a fixture `User` needs (name, handle, the institution-verification
 * columns, the materialized counters...). Miss one and `undefined` shows up as a
 * confusing assertion failure three tests later. That is what this module owns.
 */
import { fakeDb, resetFakeDb } from "../fake-prisma";

/**
 * A complete `User` row for a fixture. Every field the fixtures lean on is
 * explicit, so a test never trips over an absent field defaulting to
 * `undefined`. Spread overrides last.
 */
export const userRow = (
  id: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  id,
  name: `User ${id}`,
  handle: id.replace(/[^a-z0-9]/gi, "").toLowerCase() || "user",
  email: `${id}@uni.edu`,
  bio: null,
  avatarUrl: null,
  githubUrl: null,
  orcidUrl: null,
  linkedinUrl: null,
  googleScholarUrl: null,
  institutionEmail: null,
  institutionDomain: null,
  institutionVerifiedAt: null,
  pendingInstitutionEmail: null,
  pendingInstitutionDomain: null,
  institutionVerificationTokenHash: null,
  institutionVerificationExpiresAt: null,
  reputation: 0,
  followersCount: 0,
  followingCount: 0,
  isDeleted: false,
  isFrozen: false,
  isAdmin: false,
  ...overrides,
});

/**
 * Seeds a row, REPLACING any existing row with the same id.
 *
 * `fakeDb.seed` INSERTS rather than upserts, so re-seeding the same id silently
 * leaves the first row in place. That bit three separate suites in a row while
 * building these: a per-test override appeared to do nothing, and the test then
 * passed or failed for the wrong reason. Always use this over bare `seed`.
 */
export const seedReplacing = (
  model: string,
  row: Record<string, unknown>,
): Record<string, unknown> => {
  const id = row.id;
  if (id !== undefined) {
    const rows = fakeDb.rows(model);
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      if (rows[i].id === id) rows.splice(i, 1);
    }
  }
  fakeDb.seed(model, row);
  return row;
};

/** Resets the store — call from `beforeEach`. */
export const resetStore = (): void => {
  resetFakeDb();
};

/** Reads one seeded row back by id. */
export const rowById = <T = Record<string, unknown>>(
  model: string,
  id: string,
): T => fakeDb.rows(model).find((row) => row.id === id) as T;

/** Thrown by the mocked `next/navigation` redirect, carrying its target. */
export class Redirect extends Error {
  constructor(public to: string) {
    super(`redirect:${to}`);
    this.name = "Redirect";
  }
}

/**
 * Runs a server component and reports where it redirected, or `null` if it
 * rendered. Used to assert page-level access guards.
 */
export const runPage = async <T>(
  Page: (props: never) => Promise<T>,
  props: unknown,
): Promise<string | null> => {
  try {
    await (Page as (p: unknown) => Promise<T>)(props);
    return null;
  } catch (error) {
    if (error instanceof Redirect) return error.to;
    throw error;
  }
};
