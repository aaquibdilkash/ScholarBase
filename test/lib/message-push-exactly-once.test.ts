import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("web-push", () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() },
}));

vi.mock("@/lib/db", () => ({
  default: {
    pushSubscription: {
      findMany: vi.fn(),
      updateMany: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({})),
    },
  },
}));

import webPush from "web-push";
import prisma from "@/lib/db";
import {
  sendMessagePush,
  truncatePushBody,
} from "@/lib/push-server";
import { messagePushPayloadSchema } from "@/lib/qstash";

const sendNotification = vi.mocked(webPush.sendNotification);
const findMany = vi.mocked(prisma.pushSubscription.findMany);

const baseInput = {
  messageId: "msg-1",
  recipientId: "user-1",
  conversationId: "conv-1",
  senderName: "Ada",
  body: "hello",
};

function mockSubs(count: number) {
  findMany.mockResolvedValue(
    Array.from({ length: count }, (_, i) => ({
      id: `sub-${i}`,
      endpoint: `https://push.example/${i}`,
      p256dh: "p256dh",
      auth: "auth",
    })) as never,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "public";
  process.env.VAPID_PRIVATE_KEY = "private";
});

describe("message push exactly-once contract", () => {
  it("payload schema requires messageId so retries can dedupe", () => {
    expect(
      messagePushPayloadSchema.safeParse({
        recipientId: "u",
        conversationId: "c",
        senderName: "Ada",
        body: "hi",
      }).success,
    ).toBe(false);
    expect(
      messagePushPayloadSchema.safeParse({ ...baseInput, messageId: "m1" })
        .success,
    ).toBe(true);
  });

  it("embeds messageId + per-conversation tag in the push payload", async () => {
    mockSubs(1);
    sendNotification.mockResolvedValueOnce(undefined as never);
    await sendMessagePush(baseInput);
    const payload = JSON.parse(String(sendNotification.mock.calls[0][1]));
    expect(payload.messageId).toBe("msg-1");
    expect(payload.tag).toBe("message-conv-1");
  });

  it("flags transientFailure only when nothing delivered and nothing pruned", async () => {
    mockSubs(2);
    const transient = Object.assign(new Error("throttled"), {
      statusCode: 503,
    });
    sendNotification.mockRejectedValue(transient);
    const result = await sendMessagePush(baseInput);
    expect(result).toMatchObject({
      delivered: 0,
      removed: 0,
      transientFailure: true,
    });
  });

  it("does NOT flag transientFailure on partial delivery (no retry -> no double buzz)", async () => {
    mockSubs(2);
    sendNotification.mockResolvedValueOnce(undefined as never);
    sendNotification.mockRejectedValueOnce(
      Object.assign(new Error("throttled"), { statusCode: 503 }),
    );
    const result = await sendMessagePush(baseInput);
    expect(result.delivered).toBe(1);
    expect(result.transientFailure).toBeUndefined();
  });

  it("prunes 410 endpoints without flagging transientFailure", async () => {
    mockSubs(1);
    sendNotification.mockRejectedValueOnce(
      Object.assign(new Error("gone"), { statusCode: 410 }),
    );
    const result = await sendMessagePush(baseInput);
    expect(result.removed).toBe(1);
    expect(result.transientFailure).toBeUndefined();
  });

  it("truncatePushBody keeps payload small without breaking words mid-way", () => {
    expect(truncatePushBody("  hello   world  ")).toBe("hello world");
    const long = "a".repeat(500);
    expect(truncatePushBody(long).length).toBeLessThanOrEqual(120);
  });
});
