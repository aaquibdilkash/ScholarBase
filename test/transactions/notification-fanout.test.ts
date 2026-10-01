import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * P2-1 — resumable, idempotent notification fan-out.
 *
 * This uses a purpose-built Prisma stub rather than the shared fake-prisma
 * because the behaviour under test is precisely what that fake cannot model:
 *
 *   * `cursor`/`skip` paging (the fan-out walks `Follows` by primary key);
 *   * `createMany`, which the fake does not implement at all;
 *   * the partial unique index `Notification_unread_dedupe_key`.
 *
 * The stub reimplements that index faithfully. The real thing is verified
 * separately against a live Postgres 17 (see the migration and the checklist);
 * duplicating a database here would prove nothing, whereas what these tests
 * prove is the application logic that sits on top of the guarantee.
 */

type Follower = { followerId: string; followingId: string };
type NotificationRow = {
  recipientId: string;
  type: string;
  targetId: string | null;
  readAt: Date | null;
};

const FAN_OUT_PAYLOAD = {
  mode: "FAN_OUT" as const,
  actorId: "u-author",
  type: "NEW_POST",
  targetType: "post",
  targetId: "post-1",
  title: "New post",
  body: "Ada posted something",
};

let follows: Follower[] = [];
let notifications: NotificationRow[] = [];
let enqueued: Array<Record<string, unknown>> = [];
let createManyArgs: Array<{ skipDuplicates?: boolean }> = [];

vi.mock("@/lib/db", () => ({
  default: {
    follows: {
      findMany: vi.fn(async (args: Record<string, unknown>) => {
        const where = args.where as { followingId: string };
        let rows = follows
          .filter((row) => row.followingId === where.followingId)
          .sort((a, b) => a.followerId.localeCompare(b.followerId));

        // Prisma cursor semantics: `cursor` POSITIONS AT that row, and `skip: 1`
        // moves one past it. Applying the cursor slice and then slicing again for
        // `skip` would double-skip and silently drop one follower per chunk.
        let start = 0;
        const raw = args.cursor as
          | {
              followerId_followingId?: {
                followerId: string;
                followingId: string;
              };
            }
          | undefined;
        const cursor = raw?.followerId_followingId;
        if (cursor) {
          const idx = rows.findIndex((r) => r.followerId === cursor.followerId);
          start = idx >= 0 ? idx : 0;
        }
        if (args.skip !== undefined) start += args.skip as number;
        rows = rows.slice(start);
        if (args.take !== undefined) rows = rows.slice(0, args.take as number);
        return rows;
      }),
    },
    notification: {
      createMany: vi.fn(async (args: { data: NotificationRow[]; skipDuplicates?: boolean }) => {
        createManyArgs.push({ skipDuplicates: args.skipDuplicates });
        for (const row of args.data) {
          // The partial unique index, reimplemented: one UNREAD row per
          // (recipientId, targetId, type) where targetId is not null. A read row
          // must NOT block a new unread one.
          if (
            args.skipDuplicates &&
            row.targetId !== null &&
            notifications.some(
              (n) =>
                n.recipientId === row.recipientId &&
                n.targetId === row.targetId &&
                n.type === row.type &&
                n.readAt === null,
            )
          ) {
            continue;
          }
          notifications.push({ ...row, readAt: null });
        }
        return { count: args.data.length };
      }),
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({})),
    },
    user: { findUnique: vi.fn(async () => ({ name: "Ada", handle: "ada" })) },
  },
}));

vi.mock("@/lib/qstash", () => ({
  queueNotification: vi.fn(async (payload: Record<string, unknown>) => {
    enqueued.push(payload);
  }),
}));

vi.mock("@/lib/notification-links", () => ({
  getModuleNoun: () => "post",
}));

/** Seed `count` followers of the author, ids ordered lexicographically. */
function seedFollowers(count: number): void {
  follows = Array.from({ length: count }, (_, i) => ({
    followerId: `f${String(i + 1).padStart(5, "0")}`,
    followingId: "u-author",
  }));
}

function notificationCount(): number {
  return notifications.length;
}

/** Distinct recipients that actually received the notification. */
function recipients(): number {
  return new Set(notifications.map((n) => n.recipientId)).size;
}

async function process(payload: Record<string, unknown>) {
  const { processNotificationPayload } = await import("@/lib/notification-processor");
  return processNotificationPayload(payload as never);
}

beforeEach(() => {
  follows = [];
  notifications = [];
  enqueued = [];
  createManyArgs = [];
});

describe("fan-out: happy path", () => {
  it("notifies every follower exactly once", async () => {
    seedFollowers(7);
    const result = await process(FAN_OUT_PAYLOAD);
    expect(notificationCount()).toBe(7);
    expect(recipients()).toBe(7);
    expect(result).toMatchObject({ success: true, processed: 7 });
  });

  it("does not enqueue a continuation when the whole audience fits in one chunk", async () => {
    seedFollowers(7);
    await process(FAN_OUT_PAYLOAD);
    expect(enqueued).toHaveLength(0);
  });

  it("never notifies the author about their own post", async () => {
    seedFollowers(3);
    follows.push({ followerId: "u-author", followingId: "u-author" });
    await process(FAN_OUT_PAYLOAD);
    expect(notificationCount()).toBe(3);
    expect(notifications.some((n) => n.recipientId === "u-author")).toBe(false);
  });

  it("always passes skipDuplicates so the index can absorb a replay", async () => {
    seedFollowers(3);
    await process(FAN_OUT_PAYLOAD);
    expect(createManyArgs.length).toBeGreaterThan(0);
    expect(createManyArgs.every((a) => a.skipDuplicates === true)).toBe(true);
  });
});

describe("fan-out: bounded work", () => {
  it("processes at most 4 chunks (2000 recipients) per invocation", async () => {
    seedFollowers(2500);
    const result = await process(FAN_OUT_PAYLOAD);
    expect(notificationCount()).toBe(2000);
    expect(result).toMatchObject({ processed: 2000 });
  });

  it("re-enqueues the remainder carrying the cursor in the payload", async () => {
    seedFollowers(2500);
    await process(FAN_OUT_PAYLOAD);
    expect(enqueued).toHaveLength(1);
    // Cursor must be inside the message: a local variable is what made a retry
    // restart from follower #1.
    expect(enqueued[0]).toMatchObject({
      mode: "FAN_OUT",
      targetId: "post-1",
      cursor: { followerId: "f02000", followingId: "u-author" },
    });
  });

  it("a continuation resumes at the boundary and reaches the tail", async () => {
    seedFollowers(2500);
    await process(FAN_OUT_PAYLOAD);
    const continuation = enqueued[0];
    await process(continuation);
    // 2500 total, nobody missed, nobody notified twice.
    expect(recipients()).toBe(2500);
    expect(notificationCount()).toBe(2500);
  });

  it("a continuation that runs dry stops re-enqueueing", async () => {
    // Exactly 4 full chunks: the last read returns a full page, so the walk
    // cannot know it is finished and hands on a continuation — which then finds
    // nothing and must stop, rather than starting an endless chain.
    seedFollowers(2000);
    await process(FAN_OUT_PAYLOAD);
    expect(notificationCount()).toBe(2000);
    expect(enqueued).toHaveLength(1);

    await process(enqueued[0]);
    expect(notificationCount()).toBe(2000);
    // The tail was the end, so nothing further was queued.
    expect(enqueued).toHaveLength(1);
  });
});

describe("fan-out: idempotency under replay (the P2-1 bug)", () => {
  it("a retried message does not duplicate any notification", async () => {
    seedFollowers(1200);
    await process(FAN_OUT_PAYLOAD); // original
    await process(FAN_OUT_PAYLOAD); // QStash retry of the SAME payload
    expect(recipients()).toBe(1200);
    expect(notificationCount()).toBe(1200);
  });

  it("replaying the continuation after a crash is also a no-op", async () => {
    seedFollowers(2500);
    await process(FAN_OUT_PAYLOAD);
    const continuation = { ...enqueued[0] };
    await process(continuation);
    await process(continuation); // duplicate delivery
    expect(recipients()).toBe(2500);
    expect(notificationCount()).toBe(2500);
  });

  it("a full replay from scratch still notifies nobody twice", async () => {
    seedFollowers(600);
    await process(FAN_OUT_PAYLOAD);
    await process(FAN_OUT_PAYLOAD);
    await process(FAN_OUT_PAYLOAD);
    expect(notificationCount()).toBe(600);
  });

  it("still notifies about a NEW post for the same followers", async () => {
    seedFollowers(10);
    await process(FAN_OUT_PAYLOAD);
    await process({ ...FAN_OUT_PAYLOAD, targetId: "post-2" });
    // Different target = a different triple, so it must not be swallowed.
    expect(notificationCount()).toBe(20);
  });
});

