/**
 * The 256-character message cap must agree with the composer's counter.
 *
 * A message typed with a line break is sent through multipart, which normalises
 * every `\n` to `\r\n`. A draft of exactly 256 characters with one line break
 * therefore reached the action as 257 characters and was rejected even though
 * the UI showed `256/256`. The action now normalises line endings before
 * measuring (and before storing), so the cap is the count the author saw.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";

import { sendMessage, startConversation } from "@/app/actions/messages";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const ids = vi.hoisted(() => ({
  author: "u-author",
  peer: "u-peer",
  conversation: "c-1",
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => ({ id: ids.author })),
  requireCurrentUser: vi.fn(async () => ({ id: ids.author })),
  getActiveUser: vi.fn(async () => ({
    user: { id: ids.author },
    frozen: false,
    message: "",
  })),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  RATE_LIMIT_ERROR: "Rate limit exceeded",
  RATE_LIMIT_DEGRADED_ERROR: "Rate limit unavailable",
}));

vi.mock("@/lib/qstash", () => ({ queueMessagePush: vi.fn(async () => {}) }));

// `after()` needs a request scope; the push enqueue is not under test.
vi.mock("next/server", () => ({ after: vi.fn() }));

const FIRST =
  "Pictures: the Preamble, the Supreme Court building, the court hierarchy pyramid and the tribunals diagram.";
const SECOND =
  "High Courts: the chapter has a 25-row table. I kept only the High Courts that cover more than one state or Union Territory, and noted that every othe";

/** What the author typed: exactly the composer's cap. */
const typedBody = `${FIRST}\n${SECOND}`;

/** What multipart puts on the wire: every `\n` becomes `\r\n`. */
const wireBody = typedBody.replace(/\n/g, "\r\n");

const formOf = (body: string, extra: Record<string, string> = {}) => {
  const formData = new FormData();
  formData.append("body", body);
  for (const [key, value] of Object.entries(extra)) {
    formData.append(key, value);
  }
  return formData;
};

const participant = (id: string, conversationId: string, userId: string) => ({
  id,
  conversationId,
  userId,
  lastReadAt: new Date("2026-01-02T03:04:05.000Z"),
});

const seedConversation = () => {
  fakeDb.seed("user", {
    id: ids.author,
    name: "Author",
    isFrozen: false,
    isDeleted: false,
  });
  fakeDb.seed("user", {
    id: ids.peer,
    name: "Peer",
    isFrozen: false,
    isDeleted: false,
  });
  fakeDb.seed("conversation", {
    id: ids.conversation,
    type: "DIRECT",
    createdById: ids.author,
    lastMessageAt: new Date("2026-01-02T03:04:05.000Z"),
    createdAt: new Date("2026-01-02T03:04:05.000Z"),
    updatedAt: new Date("2026-01-02T03:04:05.000Z"),
    participants: [
      {
        ...participant("p-author", ids.conversation, ids.author),
        user: { id: ids.author, isFrozen: false, isDeleted: false },
      },
      {
        ...participant("p-peer", ids.conversation, ids.peer),
        user: { id: ids.peer, isFrozen: false, isDeleted: false },
      },
    ],
  });
  fakeDb.seed("conversationParticipant", [
    participant("p-author", ids.conversation, ids.author),
    participant("p-peer", ids.conversation, ids.peer),
  ]);
};

describe("message body length limit", () => {
  beforeEach(() => {
    resetFakeDb();
    seedConversation();
  });

  it("counts the typed body, not the CRLF the wire adds", () => {
    expect(typedBody).toHaveLength(256);
    expect(wireBody).toHaveLength(257);
  });

  it("accepts a 256-character message containing a line break", async () => {
    const result = await sendMessage(ids.conversation, formOf(wireBody));

    expect(result).not.toHaveProperty("error");
    // Stored with plain LF, so the saved length still matches the composer.
    expect(fakeDb.rows("message")[0].body).toBe(typedBody);
    expect((fakeDb.rows("message")[0].body as string).length).toBe(256);
  });

  it("accepts a 256-character opening message containing a line break", async () => {
    const result = await startConversation(
      formOf(wireBody, { recipientId: ids.peer }),
    );

    expect(result.success).toBe(true);
    expect((fakeDb.rows("message")[0].body as string).length).toBe(256);
  });

  it("still rejects a body that is longer than the cap after normalising", async () => {
    const result = await sendMessage(ids.conversation, formOf(`${typedBody}x`));

    expect(result).toMatchObject({
      success: false,
      error: expect.stringMatching(/256-character limit/),
    });
    expect(fakeDb.rows("message")).toHaveLength(0);
  });
});
