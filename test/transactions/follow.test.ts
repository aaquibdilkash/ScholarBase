/**
 * RULE 1 — follow / unfollow.
 *
 * `toggleFollow` had **no test at all** and sat in `PENDING_ACTION_TESTS`
 * since the manifest gate was introduced. Follow is the one interaction where
 * a wrong result is invisible until it is embarrassing: both counters drift by
 * one, the button still reads "Following", and nothing errors.
 *
 * This covers the action's return contract (`{ success, isFollowing }` is what
 * the optimistic FollowButton splices), the materialized counter pair, the
 * self-follow guard, the anonymous guard, and the notification that must fire
 * on follow but NOT on unfollow.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";
import { toggleFollow } from "@/app/actions/follow";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const ALICE = "u-alice";
const BOB = "u-bob";

let mockCurrentUser: { id: string; name?: string } | null = null;
let rateLimitAllowed = true;
const notifyUserById = vi.fn(async (_args: Record<string, unknown>) => {});

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => mockCurrentUser),
}));
vi.mock("@/lib/notifications", () => ({
  notifyUserById: (args: Record<string, unknown>) => notifyUserById(args),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: rateLimitAllowed })),
  enforceRateLimit: vi.fn(async () => {}),
  RATE_LIMIT_ERROR: "Rate limit exceeded",
}));
vi.mock("@/lib/qstash", () => ({ queueNotification: vi.fn(async () => {}) }));

/** Counter pair for one seeded user. */
const user = (id: string) => {
  const u = fakeDb.rows("user").find((row) => row.id === id);
  return u as { followingCount: number; followersCount: number };
};

const followRows = () => fakeDb.rows("follows");

beforeEach(() => {
  resetFakeDb();
  rateLimitAllowed = true;
  notifyUserById.mockClear();
  mockCurrentUser = { id: ALICE, name: "Alice" };
  fakeDb.seed("user", [
    { id: ALICE, name: "Alice", handle: "alice", isDeleted: false, followingCount: 0, followersCount: 0 },
    { id: BOB, name: "Bob", handle: "bob", isDeleted: false, followingCount: 0, followersCount: 0 },
  ]);
});

describe("toggleFollow", () => {
  it("follows: returns isFollowing true and bumps BOTH counters", async () => {
    const result = await toggleFollow(BOB);

    // RULE 1: the client sets its button state from this, so it must reflect
    // the POST-toggle state, not the pre-toggle one.
    expect(result.success).toBe(true);
    expect(result.isFollowing).toBe(true);

    expect(followRows()).toHaveLength(1);
    expect(user(ALICE).followingCount).toBe(1);
    expect(user(BOB).followersCount).toBe(1);
  });

  it("unfollows: returns isFollowing false and decrements BOTH counters", async () => {
    fakeDb.seed("follows", { id: "follow-1", followerId: ALICE, followingId: BOB });
    user(ALICE).followingCount = 1;
    user(BOB).followersCount = 1;

    const result = await toggleFollow(BOB);

    expect(result.success).toBe(true);
    expect(result.isFollowing).toBe(false);

    expect(followRows()).toHaveLength(0);
    expect(user(ALICE).followingCount).toBe(0);
    expect(user(BOB).followersCount).toBe(0);
  });

  it("toggles back and forth without drifting the counters", async () => {
    await toggleFollow(BOB);
    await toggleFollow(BOB);
    await toggleFollow(BOB);

    // Two follows and one unfollow must land exactly on 1/1, not 2/2 or 0/0.
    expect(followRows()).toHaveLength(1);
    expect(user(ALICE).followingCount).toBe(1);
    expect(user(BOB).followersCount).toBe(1);
  });

  it("notifies the target on follow, using a shared rollup key", async () => {
    await toggleFollow(BOB);

    expect(notifyUserById).toHaveBeenCalledTimes(1);
    const arg = notifyUserById.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.recipientId).toBe(BOB);
    expect(arg.type).toBe("follow");
    // All new followers of one recipient roll up onto ONE unread row — this is
    // the assumption the `Notification_unread_dedupe_key` index now enforces.
    expect(arg.targetId).toBe(BOB);
  });

  it("does NOT notify on unfollow", async () => {
    fakeDb.seed("follows", { id: "follow-1", followerId: ALICE, followingId: BOB });
    await toggleFollow(BOB);

    // "X unfollowed you" is not a notification anyone asked for.
    expect(notifyUserById).not.toHaveBeenCalled();
  });

  it("refuses a self-follow and writes nothing", async () => {
    const result = await toggleFollow(ALICE);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid user to follow");
    expect(followRows()).toHaveLength(0);
    expect(user(ALICE).followingCount).toBe(0);
  });

  it("refuses an empty followingId and writes nothing", async () => {
    const result = await toggleFollow("");

    expect(result.success).toBe(false);
    expect(followRows()).toHaveLength(0);
  });

  it("rejects an anonymous caller and writes nothing", async () => {
    mockCurrentUser = null;
    const result = await toggleFollow(BOB);

    expect(result.success).toBe(false);
    expect(result.error).toBe("UNAUTHORIZED");
    expect(followRows()).toHaveLength(0);
    expect(user(BOB).followersCount).toBe(0);
  });

  it("honours the rate limit without touching state", async () => {
    rateLimitAllowed = false;
    const result = await toggleFollow(BOB);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Rate limit exceeded");
    expect(followRows()).toHaveLength(0);
    expect(user(BOB).followersCount).toBe(0);
  });

  it("never changes the followed user's own followingCount", async () => {
    await toggleFollow(BOB);

    // The two counters are independent: following Bob raises Alice's
    // followingCount and Bob's followersCount, never Bob's followingCount.
    expect(user(BOB).followingCount).toBe(0);
    expect(user(ALICE).followersCount).toBe(0);
  });

  it("keeps the two directions independent", async () => {
    mockCurrentUser = { id: BOB, name: "Bob" };
    await toggleFollow(ALICE);

    expect(user(BOB).followingCount).toBe(1);
    expect(user(ALICE).followersCount).toBe(1);
    expect(user(ALICE).followingCount).toBe(0);
    expect(user(BOB).followersCount).toBe(0);
  });
});
