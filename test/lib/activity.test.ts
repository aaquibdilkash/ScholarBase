import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  hideCommentActivity,
  hideContentActivity,
  restoreCommentActivity,
  restoreContentActivity,
  COMMENT_CONTENT_TYPE_TO_ACTIVITY,
  CONTENT_TYPE_TO_ACTIVITY_MODULE,
} from "@/lib/activity";

type FakeTx = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userActivity: any;
};

function makeTx(): FakeTx {
  return {
    userActivity: {
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("activity visibility (hide / restore)", () => {
  it("hides a top-level content row's activity by bare id", async () => {
    const tx = makeTx();
    await hideContentActivity(tx, "ARTICLE", "article-1");
    const call = tx.userActivity.updateMany.mock.calls[0][0];
    expect(call.where.OR?.[0].moduleType).toBe("ARTICLE");
    expect(call.where.OR?.[0].entityId.in).toContain("article-1");
    expect(call.data.hiddenByContent).toBe(true);
  });

  it("hides nested content activity against both bare and route ids", async () => {
    const tx = makeTx();
    await hideContentActivity(tx, "RECOMMENDATION", "rec-1", "sup-1/rec-1");
    const call = tx.userActivity.updateMany.mock.calls[0][0];
    expect(call.where.OR?.[0].moduleType).toBe("RECOMMENDATION");
    expect(call.where.OR?.[0].entityId.in).toEqual(expect.arrayContaining(["rec-1", "sup-1/rec-1"]));
    expect(call.data.hiddenByContent).toBe(true);
  });

  it("restores content activity", async () => {
    const tx = makeTx();
    await restoreContentActivity(tx, "JOURNAL_REVIEW", "j-1/r-1");
    const call = tx.userActivity.updateMany.mock.calls[0][0];
    expect(call.where.hiddenByContent).toBe(true);
    expect(call.data.hiddenByContent).toBe(false);
  });

  it("hides a comment's activity by entityChildId", async () => {
    const tx = makeTx();
    await hideCommentActivity(tx, "ARTICLE", "c-1", {
      userId: "author-1",
      content: "hello world",
    });
    const call = tx.userActivity.updateMany.mock.calls[0][0];
    expect(call.where.hiddenByComment).toBe(false);
    expect(call.where.OR?.[0].entityChildId).toBe("c-1");
    expect(call.where.OR?.[1].moduleType).toBe("ARTICLE_COMMENT");
    expect(call.data.hiddenByComment).toBe(true);
  });

  it("restores a comment's activity", async () => {
    const tx = makeTx();
    await restoreCommentActivity(tx, "SOCIAL_POST", "c-2", {
      userId: "author-2",
      content: "recovered reply",
    });
    const call = tx.userActivity.updateMany.mock.calls[0][0];
    expect(call.data.hiddenByComment).toBe(false);
  });

  it("maps moderation content types to activity modules", () => {
    expect(COMMENT_CONTENT_TYPE_TO_ACTIVITY["articleComment"]).toBe("ARTICLE");
    expect(COMMENT_CONTENT_TYPE_TO_ACTIVITY["recommendationComment"]).toBe("RECOMMENDATION");
    expect(CONTENT_TYPE_TO_ACTIVITY_MODULE["blog"]).toBe("ARTICLE");
    expect(CONTENT_TYPE_TO_ACTIVITY_MODULE["feed"]).toBe("SOCIAL_POST");
    expect(CONTENT_TYPE_TO_ACTIVITY_MODULE["journalReview"]).toBe("JOURNAL_REVIEW");
  });
});
