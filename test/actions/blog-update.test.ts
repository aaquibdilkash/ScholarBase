/**
 * Blog image garbage collection on edit.
 *
 * The feed deletes a replaced post image as soon as it is replaced. The blog
 * does the same for its cover image and extends it to INLINE body images,
 * which the feed never had.
 *
 * Two properties matter and are asserted here:
 *
 *   1. WHAT is collected  — only images the edit actually removed. An image
 *      still in the body is never touched, and an image belonging to another
 *      article can never be collected (the paths come from the article's own
 *      stored content, never from the submitted form).
 *   2. WHEN it is collected — AFTER the database write. Deleting first would
 *      leave the article pointing at objects that are already gone whenever
 *      the write fails.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";
import { updateArticle } from "@/app/actions/blog";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const AUTHOR = "u-author";
const SUPABASE_URL = "https://storage.test";

let mockCurrentUser: { id: string } | null = null;

vi.mock("@/lib/auth", () => ({
  requireCurrentUser: vi.fn(async () => {
    if (!mockCurrentUser) throw new Error("Not logged in");
    return mockCurrentUser;
  }),
  getActiveUser: vi.fn(async () => {
    if (!mockCurrentUser) throw new Error("Not logged in");
    return { frozen: false, user: mockCurrentUser };
  }),
  getCurrentUser: vi.fn(async () => mockCurrentUser),
  isAuthorizedOrAdmin: vi.fn(async (ownerId: string, userId: string) => ownerId === userId),
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(async () => ({ allowed: true })),
  checkRateLimit: vi.fn(async () => ({ allowed: true, limited: false, degraded: false })),
}));

vi.mock("@/lib/tri-split/modules/registry", () => ({
  revalidateContent: vi.fn(),
  loadContentPage: vi.fn(async () => []),
}));

vi.mock("@/lib/notifications", () => ({
  notifyFollowersOfActivity: vi.fn(async () => {}),
  notifyMentionedUsers: vi.fn(async () => {}),
}));

vi.mock("@/lib/qstash", () => ({ queueNotification: vi.fn(async () => {}) }));

/** Records the order of storage deletes vs the database write. */
const callOrder: string[] = [];
const deleteContentImagePaths = vi.fn(async (_paths: string[]) => {
  callOrder.push("delete");
});
const publishContentImage = vi.fn(
  async ({ userId, draftPath, kind }: { userId: string; draftPath: string; kind: string }) =>
    `${SUPABASE_URL}/storage/v1/object/public/content-images/users/${userId}/published/${kind}/${draftPath.split("/").pop()}`,
);

vi.mock("@/lib/supabase-storage", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/supabase-storage")>();

  // Keep the real URL -> storage-key parsers: the assertions below depend on
  // the same percent-decoding the production code relies on. Only the two
  // functions that talk to Storage are replaced.
  return {
    ...actual,
    deleteContentImagePaths: (paths: string[]) =>
      deleteContentImagePaths(paths),
    publishContentImage: (args: Parameters<typeof publishContentImage>[0]) =>
      publishContentImage(args),
  };
});

const pub = (path: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/content-images/${path}`;

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
};

function seedArticle(overrides: Record<string, unknown> = {}) {
  fakeDb.seed("article", {
    id: "art-1",
    slug: "post",
    title: "Post",
    excerpt: "Excerpt",
    content: "<p>body</p>",
    imageUrl: null,
    authorId: AUTHOR,
    isDeleted: false,
    isFrozen: false,
    totalVotes: 0,
    totalComments: 0,
    totalBookmarks: 0,
    ...overrides,
  });
}

beforeEach(() => {
  resetFakeDb();
  vi.clearAllMocks();
  callOrder.length = 0;
  mockCurrentUser = { id: AUTHOR };
  fakeDb.seed("user", {
    id: AUTHOR,
    name: "Ada",
    handle: "ada",
    email: "ada@test.dev",
    reputation: 0,
    articleCount: 0,
  });
});

describe("updateArticle garbage-collects the images the edit removed", () => {
  it("collects an inline image that was deleted from the body", async () => {
    const inline = pub(`users/${AUTHOR}/published/article-inline/fig.png`);
    seedArticle({ content: `<p>body</p><img src="${inline}" alt="fig" />` });

    await updateArticle(form({ title: "Post", excerpt: "Excerpt", content: "<p>body</p>" }), "art-1");

    expect(deleteContentImagePaths).toHaveBeenCalledTimes(1);
    expect(deleteContentImagePaths.mock.calls[0][0]).toEqual([
      `users/${AUTHOR}/published/article-inline/fig.png`,
    ]);
  });

  it("keeps an inline image that is still in the body", async () => {
    const inline = pub(`users/${AUTHOR}/published/article-inline/fig.png`);
    seedArticle({ content: `<p>body</p><img src="${inline}" alt="fig" />` });

    await updateArticle(
      form({
        title: "Post",
        excerpt: "Excerpt",
        content: `<p>edited</p><img src="${inline}" alt="fig" />`,
      }),
      "art-1",
    );

    expect(deleteContentImagePaths).not.toHaveBeenCalled();
  });

  it("collects the old cover when it is replaced", async () => {
    const cover = pub(`users/${AUTHOR}/published/article-cover/old.png`);
    seedArticle({ imageUrl: cover, content: "<p>body</p>" });

    const next = pub(`users/${AUTHOR}/published/article-cover/new.png`);
    await updateArticle(
      form({
        title: "Post",
        excerpt: "Excerpt",
        content: "<p>body</p>",
        coverImageUrl: next,
      }),
      "art-1",
    );

    expect(deleteContentImagePaths).toHaveBeenCalledWith([
      `users/${AUTHOR}/published/article-cover/old.png`,
    ]);
  });

  it("collects the old cover when it is removed entirely", async () => {
    const cover = pub(`users/${AUTHOR}/published/article-cover/old.png`);
    seedArticle({ imageUrl: cover, content: "<p>body</p>" });

    await updateArticle(
      form({ title: "Post", excerpt: "Excerpt", content: "<p>body</p>" }),
      "art-1",
    );

    expect(deleteContentImagePaths).toHaveBeenCalledWith([
      `users/${AUTHOR}/published/article-cover/old.png`,
    ]);
  });

  it("does not collect a cover that was left alone", async () => {
    const cover = pub(`users/${AUTHOR}/published/article-cover/same.png`);
    seedArticle({ imageUrl: cover, content: "<p>body</p>" });

    await updateArticle(
      form({
        title: "Post",
        excerpt: "Excerpt",
        content: "<p>edited</p>",
        coverImageUrl: cover,
      }),
      "art-1",
    );

    expect(deleteContentImagePaths).not.toHaveBeenCalled();
  });

  it("collects the images only AFTER the database write", async () => {
    const inline = pub(`users/${AUTHOR}/published/article-inline/fig.png`);
    seedArticle({ content: `<p>body</p><img src="${inline}" alt="fig" />` });

    const originalUpdate = fakeDb.client.article.update.bind(
      fakeDb.client.article,
    );
    fakeDb.client.article.update = (async (...args: unknown[]) => {
      callOrder.push("update");
      return (originalUpdate as (...a: unknown[]) => unknown)(...args);
    }) as typeof fakeDb.client.article.update;

    await updateArticle(
      form({ title: "Post", excerpt: "Excerpt", content: "<p>body</p>" }),
      "art-1",
    );

    expect(callOrder).toEqual(["update", "delete"]);
  });
});

describe("updateArticle reports a failed image publish instead of throwing", () => {
  it("returns a failure result and writes nothing when the promote fails", async () => {
    // A stale bucket policy made every promote throw, which reached the browser
    // as an opaque 500. The action must answer with its normal failure shape,
    // and must not touch the row: the body would otherwise keep drafts/ URLs
    // that only its owner can read.
    seedArticle({ title: "Original" });
    publishContentImage.mockRejectedValueOnce(
      new Error(
        "Failed to publish image: new row violates row-level security policy",
      ),
    );
    const updateSpy = vi.spyOn(fakeDb.client.article, "update");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await updateArticle(
      form({
        title: "Renamed",
        excerpt: "Excerpt",
        content: "<p>body</p>",
        coverImageUrl: pub(`users/${AUTHOR}/drafts/article-cover/uuid/photo.png`),
      }),
      "art-1",
    );

    expect(result.success).toBe(false);
    expect(updateSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    updateSpy.mockRestore();
  });
});
