/**
 * RULE 1 — the VOTE action's return contract.
 *
 * `test/transactions/vote-matrix.test.ts` already proves the full voting matrix
 * (fresh upvote, fresh downvote, toggle off either way, flip either way) across
 * every module, with `totalVotes` and the author's `reputation` moving in
 * lockstep. That is the DATABASE layer and it is thoroughly covered.
 *
 * What was untested is the ACTION layer around it — and that is the layer the
 * optimistic `VoteButton` actually calls. `useOptimistic` paints the new state
 * immediately, then replaces it with this return value; if `data` is missing
 * or missing `userVote`, the button reverts to the stale value it already
 * painted over, which reads to the user as "the vote didn't register".
 *
 * These tests therefore assert the wire shape only, and deliberately do NOT
 * re-test the matrix — that is the transaction suite's job.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VoteType } from "@prisma/client";

import { fakeDb, resetFakeDb } from "../fake-prisma";
import { voteOnContent } from "@/app/actions/votes";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const AUTHOR = "u-author";
const VOTER = "u-voter";
const ENTITY = "entity-1";

let mockCurrentUser: { id: string } | null = null;
let frozen = false;
let rateLimitAllowed = true;
const queueNotification = vi.fn(async () => {});

vi.mock("@/lib/auth", () => ({
  getActiveUser: vi.fn(async () => {
    if (!mockCurrentUser) throw new Error("Not logged in");
    return { user: mockCurrentUser, frozen, message: "" };
  }),
  getCurrentUser: vi.fn(async () => mockCurrentUser),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: rateLimitAllowed })),
  enforceRateLimit: vi.fn(async () => {}),
  RATE_LIMIT_ERROR: "Rate limit exceeded",
}));
vi.mock("@/lib/qstash", () => ({
  queueNotification: (...args: unknown[]) => queueNotification(...(args as [])),
}));
vi.mock("@/lib/notifications", () => ({
  notifyFollowersOfActivity: vi.fn(async () => {}),
  notifyMentionedUsers: vi.fn(async () => {}),
  notifyUserById: vi.fn(async () => {}),
  resolveMentionedUsers: vi.fn(async () => []),
}));

beforeEach(() => {
  resetFakeDb();
  frozen = false;
  rateLimitAllowed = true;
  queueNotification.mockClear();
  mockCurrentUser = { id: VOTER };
  fakeDb.seed("user", [
    { id: AUTHOR, reputation: 0, isDeleted: false, name: "Author", handle: "author" },
    { id: VOTER, reputation: 0, isDeleted: false, name: "Voter", handle: "voter" },
  ]);
  fakeDb.seed("socialPost", {
    id: ENTITY,
    authorId: AUTHOR,
    content: "Post body",
    isDeleted: false,
    isFrozen: false,
    totalVotes: 0,
  });
});

describe("voteOnContent return contract", () => {
  it("returns data.totalVotes and data.userVote for a fresh upvote", async () => {
    const result = await voteOnContent(ENTITY, VoteType.UPVOTE, "SOCIAL_POST");

    expect(result.success).toBe(true);
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.totalVotes).toBe(1);
    expect(data.userVote).toBe(VoteType.UPVOTE);
  });

  it("returns userVote UPVOTE then null when the same vote is toggled off", async () => {
    await voteOnContent(ENTITY, VoteType.UPVOTE, "SOCIAL_POST");
    const off = await voteOnContent(ENTITY, VoteType.UPVOTE, "SOCIAL_POST");

    // `userVote: null` is what makes the button clear its filled state. An
    // `undefined` here leaves the vote looking applied.
    expect(off.success).toBe(true);
    expect((off as { data: Record<string, unknown> }).data.totalVotes).toBe(0);
    expect((off as { data: Record<string, unknown> }).data.userVote).toBeNull();
  });

  it("returns the new vote type when flipping a vote, not the old one", async () => {
    await voteOnContent(ENTITY, VoteType.UPVOTE, "SOCIAL_POST");
    const flipped = await voteOnContent(ENTITY, VoteType.DOWNVOTE, "SOCIAL_POST");

    expect((flipped as { data: Record<string, unknown> }).data.userVote).toBe(
      VoteType.DOWNVOTE,
    );
  });

  it("refuses a frozen account WITHOUT writing", async () => {
    frozen = true;
    const result = await voteOnContent(ENTITY, VoteType.UPVOTE, "SOCIAL_POST");

    expect(result.success).toBe(false);
    expect(fakeDb.rows("socialVote")).toHaveLength(0);
    const post = fakeDb.rows("socialPost")[0];
    expect(post.totalVotes).toBe(0);
  });

  it("passes a self-vote rejection through as a readable error", async () => {
    mockCurrentUser = { id: AUTHOR };
    const result = await voteOnContent(ENTITY, VoteType.UPVOTE, "SOCIAL_POST");

    // RULE 3: authors cannot vote on their own content. The message must reach
    // the toast verbatim, not be swallowed behind "An unexpected error".
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/own content/i);
    expect(fakeDb.rows("socialVote")).toHaveLength(0);
  });

  it("honours the rate limit without writing", async () => {
    rateLimitAllowed = false;
    const result = await voteOnContent(ENTITY, VoteType.UPVOTE, "SOCIAL_POST");

    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("Rate limit exceeded");
    expect(fakeDb.rows("socialVote")).toHaveLength(0);
  });

  it("throws on missing parameters rather than writing a half vote", async () => {
    await expect(
      voteOnContent("", VoteType.UPVOTE, "SOCIAL_POST"),
    ).rejects.toThrow(/Missing required parameters/i);
    expect(fakeDb.rows("socialVote")).toHaveLength(0);
  });

  it("queues a notification only for a new upvote, never a toggle-off", async () => {
    await voteOnContent(ENTITY, VoteType.UPVOTE, "SOCIAL_POST");
    expect(queueNotification).toHaveBeenCalledTimes(1);

    await voteOnContent(ENTITY, VoteType.UPVOTE, "SOCIAL_POST");
    // Toggling off must not spam the author with an "unvote" notification.
    expect(queueNotification).toHaveBeenCalledTimes(1);
  });

  it("never queues a notification for a downvote", async () => {
    await voteOnContent(ENTITY, VoteType.DOWNVOTE, "SOCIAL_POST");
    expect(queueNotification).not.toHaveBeenCalled();
  });
});
