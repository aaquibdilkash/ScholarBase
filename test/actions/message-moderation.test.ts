/**
 * Message moderation: who may edit or delete an existing message.
 *
 * Two divergences were reported from the UI and are pinned here:
 *
 *  1. A frozen account could edit but not delete. The freeze banner restricts
 *     posting, commenting, voting and reporting — retracting your own content
 *     stays available, as it does for every other content module.
 *  2. A blocked participant could keep editing (and deleting) old messages,
 *     and the edit reached the blocker over Realtime. `sendMessage` already
 *     closes a DIRECT thread in both directions; edits and deletes must obey
 *     the same rule or a block is advisory only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";

import { deleteMessage, editMessage } from "@/app/actions/messages";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const ids = vi.hoisted(() => ({
  author: "u-author",
  peer: "u-peer",
  conversation: "c-1",
  message: "m-1",
}));

let mockUser: { id: string } | null = { id: ids.author };
let mockFrozen = false;

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => mockUser),
  requireCurrentUser: vi.fn(async () => {
    if (!mockUser) throw new Error("Not logged in");
    return mockUser;
  }),
  getActiveUser: vi.fn(async () => {
    if (!mockUser) throw new Error("Not logged in");
    if (mockFrozen) {
      return {
        user: mockUser,
        frozen: true,
        message: "Your account is frozen.",
      };
    }
    return { user: mockUser, frozen: false, message: "" };
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  RATE_LIMIT_ERROR: "Rate limit exceeded",
  RATE_LIMIT_DEGRADED_ERROR: "Rate limit unavailable",
}));

vi.mock("@/lib/qstash", () => ({ queueMessagePush: vi.fn(async () => {}) }));

const messageRow = () => ({
  id: ids.message,
  conversationId: ids.conversation,
  senderId: ids.author,
  body: "Original body",
  isDeleted: false,
  createdAt: new Date("2026-01-02T03:04:05.000Z"),
  editedAt: null,
  // The fake does not resolve relations by foreign key: embed the conversation
  // exactly as the action's `select` reads it.
  conversation: {
    id: ids.conversation,
    type: "DIRECT",
    participants: [
      { userId: ids.author },
      { userId: ids.peer },
    ],
  },
});

const seedMessage = () => {
  fakeDb.seed("message", messageRow());
  return fakeDb.rows("message")[0];
};

const block = (blockerId: string, blockedId: string) => {
  fakeDb.seed("block", {
    id: `b-${blockerId}-${blockedId}`,
    blockerId,
    blockedId,
    createdAt: new Date("2026-01-02T03:04:05.000Z"),
  });
};

const errorOf = (result: unknown) => {
  expect(result).toBeTruthy();
  return (result as { error?: string }).error;
};

describe("message moderation", () => {
  beforeEach(() => {
    resetFakeDb();
    mockUser = { id: ids.author };
    mockFrozen = false;
    seedMessage();
  });

  it("lets a frozen author delete their own message", async () => {
    mockFrozen = true;

    const result = await deleteMessage(ids.message);

    expect(result.success).toBe(true);
    expect(fakeDb.rows("message")[0].isDeleted).toBe(true);
    expect(fakeDb.rows("message")[0].body).toBe("");
  });

  it("lets a frozen author edit their own message", async () => {
    mockFrozen = true;

    const result = await editMessage(ids.message, "Corrected body");

    expect(result).not.toHaveProperty("error");
    expect(fakeDb.rows("message")[0].body).toBe("Corrected body");
  });

  it("rejects an edit when the peer blocked the author", async () => {
    block(ids.peer, ids.author);

    const result = await editMessage(ids.message, "Sneaky edit");

    expect(errorOf(result)).toMatch(/blocked/i);
    expect(fakeDb.rows("message")[0].body).toBe("Original body");
  });

  it("rejects an edit when the author blocked the peer", async () => {
    block(ids.author, ids.peer);

    const result = await editMessage(ids.message, "Sneaky edit");

    expect(errorOf(result)).toMatch(/blocked/i);
    expect(fakeDb.rows("message")[0].body).toBe("Original body");
  });

  it("rejects a delete when the peer blocked the author", async () => {
    block(ids.peer, ids.author);

    const result = await deleteMessage(ids.message);

    expect(errorOf(result)).toMatch(/blocked/i);
    expect(fakeDb.rows("message")[0].isDeleted).toBe(false);
  });

  it("rejects a delete when the author blocked the peer", async () => {
    block(ids.author, ids.peer);

    const result = await deleteMessage(ids.message);

    expect(errorOf(result)).toMatch(/blocked/i);
    expect(fakeDb.rows("message")[0].isDeleted).toBe(false);
  });

  it("still edits and deletes when neither side is blocked", async () => {
    const edit = await editMessage(ids.message, "Allowed edit");
    expect(edit).not.toHaveProperty("error");

    const deletion = await deleteMessage(ids.message);
    expect(deletion.success).toBe(true);
    expect(fakeDb.rows("message")[0].isDeleted).toBe(true);
  });

  it("keeps the author-only rule ahead of block checks", async () => {
    mockUser = { id: ids.peer };

    const result = await editMessage(ids.message, "Not mine");

    expect(errorOf(result)).toMatch(/own messages/i);
    expect(fakeDb.rows("message")[0].body).toBe("Original body");
  });
});
