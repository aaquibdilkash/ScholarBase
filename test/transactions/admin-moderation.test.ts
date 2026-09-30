import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, resetFakeDb } from "../fake-prisma";
import { moderateContent } from "@/app/actions/reports";
import {
  MODEL_MAP,
  AUTHOR_COUNT_FIELD,
  ANONYMOUS_CONTENT_TYPES,
} from "@/lib/moderation-config";

/**
 * RULE 3 (reputation reversal) for the ADMIN moderation path.
 *
 * User-facing deletes reverse reputation, but an admin deleting content is a
 * separate code path (`moderateContent`) with its own copy of the arithmetic —
 * and it had a bug: the reversal was gated on the content type being present in
 * `AUTHOR_COUNT_FIELD`, so courses and research grants kept the author's
 * reputation after an admin delete, and recovering them never re-granted it.
 *
 * These tests are driven from the registry itself: a content type added to
 * `MODEL_MAP` is automatically covered, and one added without a counter fails
 * here instead of silently skipping the reversal in production.
 */

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

// Inlined literals: `vi.mock` factories are hoisted above the const block, so
// referencing `ADMIN` here would read it in its temporal dead zone.
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => ({ id: "u-admin" })),
  requireCurrentUser: vi.fn(async () => ({ id: "u-admin" })),
  requireActiveUser: vi.fn(async () => ({ id: "u-admin" })),
  getActiveUser: vi.fn(async () => ({
    user: { id: "u-admin" },
    frozen: false,
  })),
  isUserAdmin: vi.fn(async () => true),
}));

vi.mock("@/lib/tri-split/modules/feed", () => ({
  revalidatePublicFeed: vi.fn(),
}));
vi.mock("@/lib/qstash", () => ({
  queueNotification: vi.fn(async () => {}),
}));

const AUTHOR = "u-author";
const ADMIN = "u-admin";
const CONTENT_ID = "c-1";
const INITIAL_REP = 100;
const VOTES = 7;

/** Seed the author with reputation 100 and every content counter at 1. */
function seedAuthor(): void {
  const counters: Record<string, number> = {};
  for (const field of Object.values(AUTHOR_COUNT_FIELD)) {
    if (field) counters[field] = 1;
  }
  fakeDb.seed("user", [
    { id: AUTHOR, reputation: INITIAL_REP, isDeleted: false, ...counters },
    { id: ADMIN, reputation: 0, isDeleted: false },
  ]);
}

function seedContent(model: string, extra: Record<string, unknown> = {}): void {
  fakeDb.seed(model, {
    id: CONTENT_ID,
    authorId: AUTHOR,
    totalVotes: VOTES,
    isDeleted: false,
    isFrozen: false,
    ...extra,
  });
}

function author(): Record<string, unknown> {
  return fakeDb.rows("user").find((row) => row.id === AUTHOR) as Record<
    string,
    unknown
  >;
}

function content(model: string): Record<string, unknown> {
  return fakeDb.rows(model).find((row) => row.id === CONTENT_ID) as Record<
    string,
    unknown
  >;
}

/** The real content types — `SCHOLAR_PROFILE` is the user row itself. */
const CONTENT_TYPES = Object.keys(MODEL_MAP).filter(
  (type) => type !== "SCHOLAR_PROFILE",
);

beforeEach(() => {
  resetFakeDb();
});


describe("admin DELETE reverses vote-derived reputation for every content type", () => {
  it.each(CONTENT_TYPES)(
    "moderating %s deducts totalVotes once",
    async (type) => {
      seedAuthor();
      seedContent(MODEL_MAP[type].model);

      await moderateContent("DELETE", type, CONTENT_ID);

      expect(author().reputation).toBe(INITIAL_REP - VOTES);
      expect(content(MODEL_MAP[type].model).isDeleted).toBe(true);
      expect(content(MODEL_MAP[type].model).isFrozen).toBe(true);
    },
  );

  it.each(CONTENT_TYPES)(
    "moderating %s moves the materialized counter",
    async (type) => {
      seedAuthor();
      // Seeded without `isAnonymous`, which Postgres stores as a non-null
      // boolean: every row here reads as named content, so the counter moves.
      seedContent(MODEL_MAP[type].model);
      const counter = AUTHOR_COUNT_FIELD[type] as string;

      await moderateContent("DELETE", type, CONTENT_ID);

      expect(
        author()[counter],
        "an unmoved counter means this type is missing from AUTHOR_COUNT_FIELD",
      ).toBe(0);
    },
  );
});

describe("admin RECOVER restores exactly what DELETE took", () => {
  it.each(CONTENT_TYPES)(
    "recovering %s re-grants reputation and the counter",
    async (type) => {
      seedAuthor();
      seedContent(MODEL_MAP[type].model);
      const counter = AUTHOR_COUNT_FIELD[type] as string;

      await moderateContent("DELETE", type, CONTENT_ID);
      await moderateContent("RECOVER", type, CONTENT_ID);

      expect(author().reputation).toBe(INITIAL_REP);
      expect(author()[counter]).toBe(1);
      expect(content(MODEL_MAP[type].model).isDeleted).toBe(false);
      expect(content(MODEL_MAP[type].model).isFrozen).toBe(false);
    },
  );
});

describe("admin moderation cannot farm or double-charge reputation", () => {
  it("does not deduct twice when a deleted row is deleted again", async () => {
    seedAuthor();
    seedContent("course");

    await moderateContent("DELETE", "course", CONTENT_ID);
    await moderateContent("DELETE", "course", CONTENT_ID);

    expect(author().reputation).toBe(INITIAL_REP - VOTES);
    expect(author().courseCount).toBe(0);
  });

  it("does not grant reputation when recovering live content", async () => {
    seedAuthor();
    seedContent("course");

    await moderateContent("RECOVER", "course", CONTENT_ID);

    expect(author().reputation).toBe(INITIAL_REP);
    expect(author().courseCount).toBe(1);
  });

  it("does not grant twice when a recovered row is recovered again", async () => {
    seedAuthor();
    seedContent("researchGrant");

    await moderateContent("DELETE", "researchGrant", CONTENT_ID);
    await moderateContent("RECOVER", "researchGrant", CONTENT_ID);
    await moderateContent("RECOVER", "researchGrant", CONTENT_ID);

    expect(author().reputation).toBe(INITIAL_REP);
    expect(author().researchGrantCount).toBe(1);
  });

  it("leaves reputation untouched for content with no net votes", async () => {
    seedAuthor();
    seedContent("course", { totalVotes: 0 });

    await moderateContent("DELETE", "course", CONTENT_ID);

    expect(author().reputation).toBe(INITIAL_REP);
    expect(author().courseCount).toBe(0);
  });

  it("reverses a negative score back out of the author's reputation", async () => {
    seedAuthor();
    seedContent("course", { totalVotes: -3 });

    await moderateContent("DELETE", "course", CONTENT_ID);
    expect(author().reputation).toBe(INITIAL_REP + 3);

    await moderateContent("RECOVER", "course", CONTENT_ID);
    expect(author().reputation).toBe(INITIAL_REP);
  });
});

describe("anonymous content moves reputation but never the counter", () => {
  it.each([...ANONYMOUS_CONTENT_TYPES])(
    "%s keeps its author counter intact through delete and recover",
    async (type) => {
      const model = MODEL_MAP[type].model;
      const counter = AUTHOR_COUNT_FIELD[type] as string;
      seedAuthor();
      seedContent(model, { isAnonymous: true });

      await moderateContent("DELETE", type, CONTENT_ID);
      expect(author().reputation).toBe(INITIAL_REP - VOTES);
      expect(author()[counter]).toBe(1);

      await moderateContent("RECOVER", type, CONTENT_ID);
      expect(author().reputation).toBe(INITIAL_REP);
      expect(author()[counter]).toBe(1);
    },
  );

  it.each([...ANONYMOUS_CONTENT_TYPES])(
    "a named %s still moves its counter",
    async (type) => {
      const model = MODEL_MAP[type].model;
      const counter = AUTHOR_COUNT_FIELD[type] as string;
      seedAuthor();
      seedContent(model, { isAnonymous: false });

      await moderateContent("DELETE", type, CONTENT_ID);
      expect(author()[counter]).toBe(0);

      await moderateContent("RECOVER", type, CONTENT_ID);
      expect(author()[counter]).toBe(1);
    },
  );
});

describe("SCHOLAR_PROFILE moderation has no counters to move", () => {
  it("does not touch reputation or any content counter", async () => {
    seedAuthor();

    await expect(
      moderateContent("DELETE", "SCHOLAR_PROFILE", AUTHOR),
    ).resolves.toMatchObject({ success: true });

    expect(author().reputation).toBe(INITIAL_REP);
    expect(author().courseCount).toBe(1);
    expect(author().isDeleted).toBe(true);
  });
});

