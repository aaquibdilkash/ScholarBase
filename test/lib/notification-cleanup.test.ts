import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

/**
 * Notification cleanup on delete / anonymity toggle.
 *
 * Covers `deleteNotificationsForContent`, `deleteAuthorNotificationsForContent`,
 * `resolveNestedNotificationTargetId`, and `deleteAllNotificationsForContent`.
 *
 * Uses a purpose-built Prisma stub so each helper's transactional behaviour is
 * pinned without a live database — the same approach as
 * `notification-fanout.test.ts`.
 */

type NotificationRow = {
  id: string;
  recipientId: string;
  actorId: string;
  type: string;
  targetType: string | null;
  targetId: string | null;
  title: string;
  body: string;
  count: number;
  readAt: Date | null;
};

let rows: NotificationRow[] = [];

// One shared stub; `beforeEach` only resets `rows`, not the mock functions.
const dbStub = {
  notification: {
    deleteMany: vi.fn(async (args: { where: Record<string, unknown> }) => {
      const w = args.where as {
        targetId?: { in: string[] } | string;
        actorId?: string;
      };
      const before = rows.length;
      if (w.targetId && typeof w.targetId !== "string") {
        const ids = w.targetId.in as string[];
        rows = rows.filter((r) => !ids.includes(r.targetId!));
      } else if (w.targetId && w.actorId) {
        const id = w.targetId as string;
        rows = rows.filter(
          (r) => !(r.targetId === id && r.actorId === w.actorId),
        );
      }
      return { count: before - rows.length };
    }),
    findUnique: vi.fn(async (args: { where: { id: string } }) => {
      const rec =
        args.where.id === "supervisor-1"
          ? { id: "supervisor-1", supervisorId: "sup-1" }
          : args.where.id === "rec-1"
            ? { id: "rec-1", supervisorId: "sup-1" }
            : args.where.id === "journal-1"
              ? { id: "journal-1", journalId: "jn-1" }
              : args.where.id === "review-1"
                ? { id: "review-1", journalId: "jn-1" }
                : null;
      return rec;
    }),
  },
  recommendation: {
    findUnique: vi.fn(async (args: { where: { id: string } }) => ({
      id: args.where.id,
      supervisorId: "sup-1",
    })),
  },
  journalReview: {
    findUnique: vi.fn(async (args: { where: { id: string } }) => ({
      id: args.where.id,
      journalId: "jn-1",
    })),
  },
  socialComment: {
    findMany: vi.fn(async () => [{ id: "c-1" }, { id: "c-2" }]),
  },
  recommendationComment: {
    findMany: vi.fn(async () => [{ id: "rc-1" }]),
  },
  journalReviewComment: {
    findMany: vi.fn(async () => [{ id: "jr-1" }]),
  },
};

const tx = dbStub as unknown as Prisma.TransactionClient;

vi.mock("@/lib/db", () => ({
  default: dbStub,
}));

describe("notification cleanup", () => {
  beforeEach(() => {
    rows = [
      { id: "n1", recipientId: "u1", actorId: "u2", type: "NEW_VOTE", targetType: "post", targetId: "post-1", title: "Upvote", body: "x", count: 1, readAt: null },
      { id: "n2", recipientId: "u1", actorId: "u2", type: "content-published", targetType: "post", targetId: "post-1", title: "Post", body: "x", count: 1, readAt: null },
      { id: "n3", recipientId: "u1", actorId: "u3", type: "NEW_COMMENT", targetType: "post", targetId: "post-1::comment::c-1", title: "Comment", body: "x", count: 1, readAt: null },
      { id: "n4", recipientId: "u1", actorId: "u4", type: "NEW_VOTE", targetType: "post", targetId: "post-10", title: "Upvote", body: "x", count: 1, readAt: null },
      { id: "n5", recipientId: "u1", actorId: "u2", type: "NEW_VOTE", targetType: "recommendation", targetId: "sup-1/rec-1", title: "Upvote", body: "x", count: 1, readAt: null },
      { id: "n6", recipientId: "u1", actorId: "u2", type: "content-published", targetType: "recommendation", targetId: "rec-1", title: "Rec", body: "x", count: 1, readAt: null },
      { id: "n7", recipientId: "u1", actorId: "u2", type: "NEW_COMMENT", targetType: "recommendation", targetId: "sup-1/rec-1::comment::rc-1", title: "Comment", body: "x", count: 1, readAt: null },
    ];
    vi.clearAllMocks();
  });

  describe("deleteNotificationsForContent", () => {
    it("deletes all notifications for exact target ids, read or unread", async () => {
      const { deleteNotificationsForContent } = await import("@/lib/transactions");
      await deleteNotificationsForContent(tx, ["post-1"]);
      expect(rows.map((r) => r.id)).not.toContain("n1");
      expect(rows.map((r) => r.id)).not.toContain("n2");
      // post-10 must NOT match post-1 (no prefix collision).
      expect(rows.map((r) => r.id)).toContain("n4");
      // Comment notifications point at ::comment:: ids, not bare post-1.
      expect(rows.map((r) => r.id)).toContain("n3");
    });

    it("is a no-op for an empty id list", async () => {
      const { deleteNotificationsForContent } = await import("@/lib/transactions");
      await deleteNotificationsForContent(tx, []);
      expect(rows).toHaveLength(7);
    });
  });

  describe("deleteAuthorNotificationsForContent", () => {
    it("deletes only the actor's notifications for the target ids", async () => {
      const { deleteAuthorNotificationsForContent } = await import("@/lib/notifications");
      await deleteAuthorNotificationsForContent(tx, "u2", ["post-1"]);
      expect(rows.map((r) => r.id)).not.toContain("n1");
      expect(rows.map((r) => r.id)).not.toContain("n2");
      // u3's comment notification on the same target stays.
      expect(rows.map((r) => r.id)).toContain("n3");
      // u4's vote on post-10 stays.
      expect(rows.map((r) => r.id)).toContain("n4");
    });
  });

  describe("resolveNestedNotificationTargetId", () => {
    it("returns the bare id for non-nested modules", async () => {
      const { resolveNestedNotificationTargetId } = await import("@/lib/transactions");
      const result = await resolveNestedNotificationTargetId(tx, "SOCIAL_POST", "post-1");
      expect(result).toBe("post-1");
    });

    it("returns the nested composite for recommendations", async () => {
      const { resolveNestedNotificationTargetId } = await import("@/lib/transactions");
      const result = await resolveNestedNotificationTargetId(tx, "RECOMMENDATION", "rec-1");
      expect(result).toBe("sup-1/rec-1");
    });

    it("returns the nested composite for journal reviews", async () => {
      const { resolveNestedNotificationTargetId } = await import("@/lib/transactions");
      const result = await resolveNestedNotificationTargetId(tx, "JOURNAL_REVIEW", "review-1");
      expect(result).toBe("jn-1/review-1");
    });

    it("passes through ids that already contain a slash", async () => {
      const { resolveNestedNotificationTargetId } = await import("@/lib/transactions");
      const result = await resolveNestedNotificationTargetId(tx, "RECOMMENDATION", "sup-1/rec-1");
      expect(result).toBe("sup-1/rec-1");
    });
  });

  describe("deleteAllNotificationsForContent", () => {
    it("deletes bare content, nested composite, and all comment notifications", async () => {
      const { deleteAllNotificationsForContent } = await import("@/lib/notifications");
      await deleteAllNotificationsForContent(tx, "RECOMMENDATION", "rec-1");
      // Bare id and nested composite both gone.
      expect(rows.map((r) => r.id)).not.toContain("n5");
      expect(rows.map((r) => r.id)).not.toContain("n6");
      // Comment notification on the nested composite gone.
      expect(rows.map((r) => r.id)).not.toContain("n7");
      // Unrelated post notifications stay.
      expect(rows.map((r) => r.id)).toContain("n1");
      expect(rows.map((r) => r.id)).toContain("n4");
    });

    it("deletes comment notifications for non-nested content", async () => {
      const { deleteAllNotificationsForContent } = await import("@/lib/notifications");
      await deleteAllNotificationsForContent(tx, "SOCIAL_POST", "post-1");
      expect(rows.map((r) => r.id)).not.toContain("n1");
      expect(rows.map((r) => r.id)).not.toContain("n2");
      // Comment notification on post-1 gone (stub returns c-1, c-2 for socialComment).
      expect(rows.map((r) => r.id)).not.toContain("n3");
    });
  });
});
