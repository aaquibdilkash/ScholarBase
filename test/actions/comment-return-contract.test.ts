/**
 * RULE 1 — the comment / reply return contract.
 *
 * Comments are the one surface where a wrong return shape corrupts state that
 * is already on screen. RULE 1 splices the returned object into the CACHED
 * comment tree with `setQueryData`, so `data` has to carry everything the
 * nested reply rendering reads. A reply that returns without `parentId` gets
 * appended to the root list; one that returns without `totalReplies` renders
 * as "0 replies" the instant it appears, then corrects itself on refetch —
 * which is exactly the kind of flicker that gets reported as a bug and never
 * reproduced.
 *
 * `test/transactions/comment.test.ts` already covers the DATABASE effects
 * (counters, tombstones, frozen blocks, attribution). This file asserts only
 * what comes back over the wire.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";

import { createComment } from "@/app/actions/comments";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const AUTHOR = "u-author";
const OTHER = "u-other";
const ENTITY = "entity-1";

let mockCurrentUser: { id: string } | null = null;

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => mockCurrentUser),
  requireCurrentUser: vi.fn(async () => {
    if (!mockCurrentUser) throw new Error("Not logged in");
    return mockCurrentUser;
  }),
  requireActiveUser: vi.fn(async () => {
    if (!mockCurrentUser) throw new Error("Not logged in");
    return mockCurrentUser;
  }),
  getActiveUser: vi.fn(async () => {
    if (!mockCurrentUser) throw new Error("Not logged in");
    return { user: mockCurrentUser, frozen: false, message: "" };
  }),
  isUserAdmin: vi.fn(async () => false),
}));

vi.mock("@/lib/tri-split/modules/registry", () => ({
  revalidateContent: vi.fn(),
  loadContentPage: vi.fn(async () => []),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  enforceRateLimit: vi.fn(async () => {}),
  RATE_LIMIT_ERROR: "Rate limit exceeded",
}));
vi.mock("@/lib/qstash", () => ({ queueNotification: vi.fn(async () => {}) }));
vi.mock("@/lib/notifications", () => ({
  notifyMentionedUsers: vi.fn(async () => {}),
  notifyUserById: vi.fn(async () => {}),
  resolveMentionedUsers: vi.fn(async () => []),
}));

/** Narrows an action result to the created comment. */
const created = (result: { success: boolean; data?: unknown }) => {
  expect(result.success).toBe(true);
  expect(result.data).toBeDefined();
  return result.data as Record<string, unknown>;
};

const formOf = (content: string) => {
  const fd = new FormData();
  fd.append("content", content);
  return fd;
};

const seedUser = (id: string) =>
  fakeDb.seed("user", {
    id,
    reputation: 0,
    isDeleted: false,
    name: `User ${id}`,
    handle: id,
    avatarUrl: null,
    institutionVerifiedAt: null,
  });

/** One content type is enough to prove the shape; the wiring is shared. */
const TYPE = "article" as const;

describe("RULE 1: createComment returns a splice-ready comment", () => {
  beforeEach(() => {
    resetFakeDb();
    mockCurrentUser = { id: AUTHOR };
    seedUser(AUTHOR);
    seedUser(OTHER);
    fakeDb.seed("article", {
      id: ENTITY,
      authorId: OTHER,
      title: "Host article",
      isDeleted: false,
      isFrozen: false,
      totalComments: 0,
    });
  });

  it("returns success:true with the comment as `data`", async () => {
    const result = await createComment(formOf("Nice work"), ENTITY, TYPE);

    const data = created(result);
    expect(data.id).toBeTruthy();
  });

  it("carries every field the nested comment card renders", async () => {
    const data = created(await createComment(formOf("Nice work"), ENTITY, TYPE));

    // A missing key here is what makes a freshly-posted comment paint wrong
    // before the next fetch corrects it.
    for (const key of [
      "id",
      "content",
      "authorId",
      "parentId",
      "createdAt",
      "totalVotes",
      "totalReplies",
      "mentions",
      "author",
    ]) {
      expect(data).toHaveProperty(key);
    }
    expect(data.content).toBe("Nice work");
    expect(data.authorId).toBe(AUTHOR);
  });

  it("embeds the author block the card renders by name", async () => {
    const data = created(await createComment(formOf("Nice work"), ENTITY, TYPE));
    const author = data.author as Record<string, unknown>;

    expect(author).toBeDefined();
    expect(author.id).toBe(AUTHOR);
    expect(author).toHaveProperty("handle");
    expect(author).toHaveProperty("avatarUrl");
  });

  it("reports counters as zero rather than undefined on a new comment", async () => {
    const data = created(await createComment(formOf("Nice work"), ENTITY, TYPE));

    // `undefined` renders as a blank count; the transaction returns 0.
    expect(data.totalVotes).toBe(0);
    expect(data.totalReplies).toBe(0);
  });

  it("returns parentId: null for a top-level comment", async () => {
    const data = created(await createComment(formOf("Root"), ENTITY, TYPE));
    expect(data.parentId).toBeNull();
  });

  it("returns the real parentId on a reply, so the client can nest it", async () => {
    const rootId = String(created(await createComment(formOf("Root"), ENTITY, TYPE)).id);

    const reply = created(
      await createComment(formOf("A reply"), ENTITY, TYPE, rootId),
    );
    // THIS is the field that decides nesting. Without it the reply would be
    // spliced into the root comment list and render flat.
    expect(reply.parentId).toBe(rootId);
  });

  it("gives a reply its own id and its own author block", async () => {
    const rootId = String(created(await createComment(formOf("Root"), ENTITY, TYPE)).id);
    mockCurrentUser = { id: OTHER };
    const reply = created(
      await createComment(formOf("A reply"), ENTITY, TYPE, rootId),
    );

    expect(reply.id).not.toBe(rootId);
    expect(reply.authorId).toBe(OTHER);
  });

  it("returns an id that matches the row actually written", async () => {
    const data = created(await createComment(formOf("Nice work"), ENTITY, TYPE));
    const rows = fakeDb.rows("articleComment");
    expect(data.id).toBe(rows[0].id);
  });

  it("normalises mentions to an array-or-null, never undefined", async () => {
    const data = created(await createComment(formOf("hi @ada"), ENTITY, TYPE));
    const mentions = data.mentions;
    // Cards do `comment.mentions?.map(...)`; a missing key is fine but an
    // undefined-vs-null split across modules is not.
    expect(mentions === null || Array.isArray(mentions)).toBe(true);
  });

  it("rejects an anonymous caller and writes nothing", async () => {
    mockCurrentUser = null;
    await expect(
      createComment(formOf("Nice work"), ENTITY, TYPE),
    ).rejects.toThrow();
    expect(fakeDb.rows("articleComment")).toHaveLength(0);
  });

  it("rejects empty content without writing a row", async () => {
    const result = await createComment(formOf(""), ENTITY, TYPE);
    expect(result.success).toBe(false);
    expect(fakeDb.rows("articleComment")).toHaveLength(0);
  });
});
