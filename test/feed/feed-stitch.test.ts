import { describe, expect, it } from "vitest";

import {
  rehydratePublicSocialPost,
  stitchSocialPostLiveState,
} from "@/lib/feed-stitch";
import type {
  CachedPublicSocialPost,
  SocialPostLiveOverlay,
} from "@/types/feed";

function cachedPost(
  id: string,
  authorId: string,
  overrides: Partial<CachedPublicSocialPost> = {},
): CachedPublicSocialPost {
  return {
    id,
    content: `content-${id}`,
    imageUrl: null,
    createdAt: "2026-01-02T03:04:05.000Z",
    updatedAt: "2026-01-02T03:04:05.000Z",
    editedAt: null,
    authorId,
    mentions: null,
    isFrozen: false,
    hasActiveAppeal: false,
    totalVotes: 0,
    totalBookmarks: 0,
    totalComments: 0,
    author: {
      id: authorId,
      name: "Scholar",
      handle: "scholar",
      avatarUrl: null,
      institutionVerifiedAt: null,
    },
    ...overrides,
  };
}

function overlay(
  overrides: Partial<SocialPostLiveOverlay> = {},
): SocialPostLiveOverlay {
  return {
    viewerId: "viewer-1",
    votes: [],
    bookmarks: [],
    following: [],
    counters: [],
    ...overrides,
  };
}

describe("rehydratePublicSocialPost", () => {
  it("turns the cache's ISO strings back into Date objects", () => {
    const post = rehydratePublicSocialPost(
      cachedPost("p1", "author-1", {
        editedAt: "2026-02-03T04:05:06.000Z",
      }),
    );

    expect(post.createdAt).toBeInstanceOf(Date);
    expect(post.updatedAt).toBeInstanceOf(Date);
    expect(post.editedAt).toBeInstanceOf(Date);
    expect(post.createdAt.toISOString()).toBe("2026-01-02T03:04:05.000Z");
    expect(post.editedAt?.toISOString()).toBe("2026-02-03T04:05:06.000Z");
  });

  it("keeps a never-edited post's editedAt as null", () => {
    const post = rehydratePublicSocialPost(cachedPost("p1", "author-1"));
    expect(post.editedAt).toBeNull();
  });
});

describe("stitchSocialPostLiveState", () => {
  it("preserves every viewer-independent field a card reads", () => {
    // Regression guard: the public select must carry authorId, mentions,
    // isFrozen and hasActiveAppeal, otherwise owner actions, the moderation
    // banner and mention links silently break.
    const [item] = stitchSocialPostLiveState(
      [
        cachedPost("p1", "author-1", {
          imageUrl: "https://res.cloudinary.com/demo/image/upload/post.jpg",
          isFrozen: true,
          hasActiveAppeal: true,
          totalVotes: 7,
          totalComments: 3,
        }),
      ],
      null,
    );

    expect(item.id).toBe("p1");
    expect(item.authorId).toBe("author-1");
    expect(item.content).toBe("content-p1");
    expect(item.imageUrl).toBe(
      "https://res.cloudinary.com/demo/image/upload/post.jpg",
    );
    expect(item.isFrozen).toBe(true);
    expect(item.hasActiveAppeal).toBe(true);
    expect(item.totalVotes).toBe(7);
    expect(item.totalComments).toBe(3);
    expect(item.createdAt).toBeInstanceOf(Date);
    expect(item.author.id).toBe("author-1");
  });

  it("renders the signed-out state with empty arrays, never false/undefined", () => {
    const [item] = stitchSocialPostLiveState(
      [cachedPost("p1", "author-1")],
      null,
    );

    expect(item.votes).toEqual([]);
    expect(item.bookmarks).toEqual([]);
    expect(item.author.followers).toEqual([]);
    expect(item.mentions).toBeNull();
  });

  it("overlays the viewer's vote, bookmark and follow state", () => {
    const [item] = stitchSocialPostLiveState(
      [cachedPost("p1", "author-1")],
      overlay({
        votes: [{ socialPostId: "p1", voteType: "UPVOTE" }],
        bookmarks: [{ id: "bookmark-1", socialPostId: "p1" }],
        following: ["author-1"],
      }),
    );

    expect(item.votes).toEqual([{ voteType: "UPVOTE" }]);
    expect(item.bookmarks).toEqual([{ id: "bookmark-1" }]);
    expect(item.author.followers).toEqual([{ followerId: "viewer-1" }]);
  });

  it("never leaks one post's state onto another post or author", () => {
    const items = stitchSocialPostLiveState(
      [cachedPost("p1", "author-1"), cachedPost("p2", "author-2")],
      overlay({
        votes: [{ socialPostId: "p1", voteType: "DOWNVOTE" }],
        bookmarks: [{ id: "bookmark-1", socialPostId: "p1" }],
        following: ["author-2"],
      }),
    );

    expect(items[0].votes).toEqual([{ voteType: "DOWNVOTE" }]);
    expect(items[0].bookmarks).toEqual([{ id: "bookmark-1" }]);
    expect(items[0].author.followers).toEqual([]);

    expect(items[1].votes).toEqual([]);
    expect(items[1].bookmarks).toEqual([]);
    expect(items[1].author.followers).toEqual([{ followerId: "viewer-1" }]);
  });

  it("normalises the Json mentions column", () => {
    const [withMentions] = stitchSocialPostLiveState(
      [
        cachedPost("p1", "author-1", {
          mentions: [{ id: "u9", handle: "ada", name: "Ada" }],
        }),
      ],
      null,
    );
    const [withObject] = stitchSocialPostLiveState(
      [cachedPost("p2", "author-1", { mentions: { not: "an-array" } })],
      null,
    );

    expect(withMentions.mentions).toEqual([
      { id: "u9", handle: "ada", name: "Ada" },
    ]);
    expect(withObject.mentions).toBeNull();
  });

  it("does not mutate the cached rows it is given", () => {
    const post = cachedPost("p1", "author-1");
    stitchSocialPostLiveState(
      [post],
      overlay({
        votes: [{ socialPostId: "p1", voteType: "UPVOTE" }],
        following: ["author-1"],
      }),
    );

    expect(post.createdAt).toBe("2026-01-02T03:04:05.000Z");
    expect(Object.prototype.hasOwnProperty.call(post, "votes")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(post.author, "followers")).toBe(
      false,
    );
  });

  it("prefers live counters over the cached batch values", () => {
    // The cached batch is allowed to lag (signed-out viewers read it); a
    // signed-in viewer must see the true numbers.
    const [item] = stitchSocialPostLiveState(
      [
        cachedPost("p1", "author-1", {
          totalVotes: 40,
          totalBookmarks: 2,
          totalComments: 9,
        }),
      ],
      overlay({
        counters: [
          {
            socialPostId: "p1",
            totalVotes: 43,
            totalBookmarks: 5,
            totalComments: 12,
          },
        ],
      }),
    );

    expect(item.totalVotes).toBe(43);
    expect(item.totalBookmarks).toBe(5);
    expect(item.totalComments).toBe(12);
  });

  it("only overlays the counters that belong to their own post", () => {
    const items = stitchSocialPostLiveState(
      [
        cachedPost("p1", "author-1", { totalVotes: 40 }),
        cachedPost("p2", "author-2", { totalVotes: 1 }),
      ],
      overlay({
        counters: [
          { socialPostId: "p1", totalVotes: 43, totalBookmarks: 5, totalComments: 12 },
        ],
      }),
    );

    expect(items[0].totalVotes).toBe(43);
    // p2 has no overlay entry -> falls back to the cached value.
    expect(items[1].totalVotes).toBe(1);
  });

  it("keeps the cached counters when the overlay has no entry at all", () => {
    const [item] = stitchSocialPostLiveState(
      [
        cachedPost("p1", "author-1", {
          totalVotes: 40,
          totalBookmarks: 2,
          totalComments: 9,
        }),
      ],
      overlay({ counters: [] }),
    );

    expect(item.totalVotes).toBe(40);
    expect(item.totalBookmarks).toBe(2);
    expect(item.totalComments).toBe(9);
  });

  it("keeps cached counters for anonymous visitors", () => {
    const [item] = stitchSocialPostLiveState(
      [cachedPost("p1", "author-1", { totalVotes: 7, totalComments: 3 })],
      null,
    );

    expect(item.totalVotes).toBe(7);
    expect(item.totalComments).toBe(3);
    expect(item.votes).toEqual([]);
  });
});
