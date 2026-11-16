/**
 * Regression: soft-deleting a blog article removes every notification that
 * points at it — the content-published fan-out and any vote notifications —
 * so a deleted blog never surfaces in an inbox.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";

import { deleteArticle } from "@/app/actions/blog";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const AUTHOR = "u-author";
const ARTICLE = "art-1";

vi.mock("@/lib/auth", () => ({
  getActiveUser: vi.fn(async () => ({ frozen: false, user: { id: AUTHOR } })),
  requireCurrentUser: vi.fn(async () => ({ id: AUTHOR })),
  isAuthorizedOrAdmin: vi.fn(async () => true),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  enforceRateLimit: vi.fn(async () => ({ allowed: true })),
  RATE_LIMIT_ERROR: "Rate limit exceeded",
}));

vi.mock("@/lib/tri-split/modules/registry", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    revalidateContent: vi.fn(),
  };
});

vi.mock("@/lib/tri-split/modules/profile-tab", () => ({
  revalidateBookmarkersForDeletedContent: vi.fn(async () => {}),
}));

vi.mock("@/lib/activity", () => ({
  hideContentActivity: vi.fn(async () => {}),
}));

beforeEach(() => {
  resetFakeDb();
  vi.clearAllMocks();
  fakeDb.seed("user", {
    id: AUTHOR,
    name: "Ada",
    reputation: 10,
    articleCount: 1,
  });
  fakeDb.seed("article", {
    id: ARTICLE,
    title: "Research blog",
    slug: "res-blog",
    authorId: AUTHOR,
    totalVotes: 3,
    totalComments: 0,
    isDeleted: false,
    isFrozen: false,
  });
  // A vote notification and a content-published fan-out both point at the
  // article id and must be removed on delete.
  fakeDb.seed("notification", {
    id: "n-vote",
    recipientId: AUTHOR,
    actorId: "u-voter",
    type: "NEW_VOTE",
    targetType: "post",
    targetId: ARTICLE,
    title: "New Upvote",
    body: "Research blog",
    count: 1,
    readAt: null,
  });
  fakeDb.seed("notification", {
    id: "n-publish",
    recipientId: "u-follower",
    actorId: AUTHOR,
    type: "content-published",
    targetType: "Article",
    targetId: ARTICLE,
    title: "Ada published a new blog",
    body: "Research blog",
    count: 1,
    readAt: null,
  });
  // A notification for a different article must survive.
  fakeDb.seed("notification", {
    id: "n-other",
    recipientId: AUTHOR,
    actorId: "u-voter",
    type: "NEW_VOTE",
    targetType: "post",
    targetId: "art-2",
    title: "New Upvote",
    body: "Other blog",
    count: 1,
    readAt: null,
  });
});

describe("deleteArticle removes notifications", () => {
  it("deletes every notification pointing at the deleted article", async () => {
    const result = await deleteArticle(ARTICLE);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected the delete to succeed");

    const remaining = fakeDb.rows("notification");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("n-other");
    expect(remaining[0].targetId).toBe("art-2");
  });

  it("marks the article as soft-deleted", async () => {
    const result = await deleteArticle(ARTICLE);

    expect(result.success).toBe(true);
    expect(fakeDb.rows("article")[0].isDeleted).toBe(true);
  });
});
