import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { collectYouTube } from "@/lib/netnokit/providers/youtube";
import { collectScrapeCreators } from "@/lib/netnokit/providers/scrapecreators";

describe("collectYouTube", () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            id: "t1",
            snippet: {
              topLevelComment: {
                id: "c1",
                snippet: {
                  authorDisplayName: "Alice",
                  authorChannelId: { value: "UC1" },
                  textDisplay: "hello https://x.com",
                  likeCount: 3,
                  publishedAt: "2026-01-01T00:00:00Z",
                  updatedAt: "2026-01-01T00:00:00Z",
                },
              },
              totalReplyCount: 1,
            },
            replies: {
              comments: [
                {
                  id: "r1",
                  snippet: {
                    authorDisplayName: "Bob",
                    authorChannelId: { value: "UC2" },
                    textDisplay: "reply",
                    likeCount: 1,
                    publishedAt: "2026-01-02T00:00:00Z",
                    updatedAt: "2026-01-02T00:00:00Z",
                  },
                },
              ],
            },
          },
        ],
        nextPageToken: undefined,
      }),
    })) as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("collects top-level + replies when includeReplies", async () => {
    const out = await collectYouTube({
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      apiKey: "key",
      maxComments: 10,
      includeReplies: true,
      anonymize: false,
      studySalt: "salt",
    });
    expect(out).toHaveLength(2);
    expect(out[0].commentId).toBe("c1");
    expect(out[1].parentId).toBe("c1");
    expect(out[0].cleanedText).toBe("hello [URL]");
  });

  it("respects maxComments", async () => {
    const out = await collectYouTube({
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      apiKey: "key",
      maxComments: 1,
      includeReplies: true,
      anonymize: true,
      studySalt: "salt",
    });
    expect(out).toHaveLength(1);
    expect(out[0].authorId).toMatch(/^Participant_/);
  });
});

describe("collectScrapeCreators", () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        comments: [
          { id: "ic1", text: "nice post", created_at: "2026-01-01T00:00:00Z", comment_like_count: 2, user: { username: "alice", full_name: "Alice", id: "u1" } },
        ],
        cursor: null,
      }),
    })) as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("collects instagram comments", async () => {
    const out = await collectScrapeCreators({
      url: "https://www.instagram.com/p/ABC123/",
      apiKey: "key",
      maxComments: 10,
      includeReplies: false,
      anonymize: false,
      studySalt: "salt",
    });
    expect(out).toHaveLength(1);
    expect(out[0].authorUsername).toBe("alice");
    expect(out[0].text).toBe("nice post");
  });
});
