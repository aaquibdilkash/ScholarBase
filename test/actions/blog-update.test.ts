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
  enforceRateLimit: vi.fn(async () => {}),
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
const deleteBlogImagePaths = vi.fn(async (_paths: string[]) => {
  callOrder.push("delete");
});
const publishBlogImage = vi.fn(
  async ({ userId, draftPath, kind }: { userId: string; draftPath: string; kind: string }) =>
    `${SUPABASE_URL}/storage/v1/object/public/blog-images/users/${userId}/published/${kind}/${draftPath.split("/").pop()}`,
);

vi.mock("@/lib/supabase-storage", () => ({
  BLOG_IMAGE_BUCKET: "blog-images",
  deleteBlogImagePaths: (paths: string[]) => deleteBlogImagePaths(paths),
  publishBlogImage: (args: Parameters<typeof publishBlogImage>[0]) =>
    publishBlogImage(args),
  extractCoverImagePath: (url: string | null | undefined) => {
    if (!url) return null;
    const match = url.match(/\/public\/blog-images\/(.+)$/);
    return match ? match[1] : null;
  },
  extractBlogImagePathsFromHtml: (html: string) => {
    const paths: string[] = [];
    const regex = /<img[^>]+src="([^"]*storage\/v1\/object\/public\/blog-images\/[^"]+)"/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) !== null) {
      const path = match[1].match(/\/public\/blog-images\/(.+)$/);
      if (path) paths.push(path[1]);
    }
    return paths;
  },
  extractBlogImageUrlsFromHtml: (html: string) => {
    const refs: { url: string; path: string }[] = [];
    const regex = /<img[^>]+src="([^"]*storage\/v1\/object\/public\/blog-images\/[^"]+)"/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) !== null) {
      const path = match[1].match(/\/public\/blog-images\/(.+)$/);
      if (path) refs.push({ url: match[1], path: path[1] });
    }
    return refs;
  },
}));

const pub = (path: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/blog-images/${path}`;

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
    const inline = pub(`users/${AUTHOR}/published/inline/fig.png`);
    seedArticle({ content: `<p>body</p><img src="${inline}" alt="fig" />` });

    await updateArticle(form({ title: "Post", excerpt: "Excerpt", content: "<p>body</p>" }), "art-1");

    expect(deleteBlogImagePaths).toHaveBeenCalledTimes(1);
    expect(deleteBlogImagePaths.mock.calls[0][0]).toEqual([
      `users/${AUTHOR}/published/inline/fig.png`,
    ]);
  });

  it("keeps an inline image that is still in the body", async () => {
    const inline = pub(`users/${AUTHOR}/published/inline/fig.png`);
    seedArticle({ content: `<p>body</p><img src="${inline}" alt="fig" />` });

    await updateArticle(
      form({
        title: "Post",
        excerpt: "Excerpt",
        content: `<p>edited</p><img src="${inline}" alt="fig" />`,
      }),
      "art-1",
    );

    expect(deleteBlogImagePaths).not.toHaveBeenCalled();
  });

  it("collects the old cover when it is replaced", async () => {
    const cover = pub(`users/${AUTHOR}/published/cover/old.png`);
    seedArticle({ imageUrl: cover, content: "<p>body</p>" });

    const next = pub(`users/${AUTHOR}/published/cover/new.png`);
    await updateArticle(
      form({
        title: "Post",
        excerpt: "Excerpt",
        content: "<p>body</p>",
        coverImageUrl: next,
      }),
      "art-1",
    );

    expect(deleteBlogImagePaths).toHaveBeenCalledWith([
      `users/${AUTHOR}/published/cover/old.png`,
    ]);
  });

  it("collects the old cover when it is removed entirely", async () => {
    const cover = pub(`users/${AUTHOR}/published/cover/old.png`);
    seedArticle({ imageUrl: cover, content: "<p>body</p>" });

    await updateArticle(
      form({ title: "Post", excerpt: "Excerpt", content: "<p>body</p>" }),
      "art-1",
    );

    expect(deleteBlogImagePaths).toHaveBeenCalledWith([
      `users/${AUTHOR}/published/cover/old.png`,
    ]);
  });

  it("does not collect a cover that was left alone", async () => {
    const cover = pub(`users/${AUTHOR}/published/cover/same.png`);
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

    expect(deleteBlogImagePaths).not.toHaveBeenCalled();
  });

  it("collects the images only AFTER the database write", async () => {
    const inline = pub(`users/${AUTHOR}/published/inline/fig.png`);
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
