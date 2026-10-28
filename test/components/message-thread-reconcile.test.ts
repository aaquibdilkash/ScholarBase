/**
 * Thread reconciliation.
 *
 * Reported bugs:
 *
 *  1. One send rendered TWO bubbles. The composer appends an optimistic bubble
 *     and then the Server Action's persisted row; the two were reconciled by
 *     body text, so any difference in the stored text (CRLF normalisation,
 *     trailing whitespace) left the optimistic copy behind next to the real
 *     one until a refresh replaced the whole thread.
 *  2. Scrolling up duplicated older messages. Two intersection callbacks could
 *     fetch and prepend the same cursor page.
 *  3. A message queued in the offline outbox was re-sent after a reload even
 *     though it had already been stored, creating a real duplicate row.
 */
import { describe, expect, it } from "vitest";

import {
  appendMessage,
  isPendingMessageDelivered,
  prependOlderMessages,
  sameMessageBody,
} from "@/components/messages/thread-reconcile";
import type { SentMessage } from "@/components/messages/MessageInputForm";

const sender = {
  id: "u-1",
  name: "Samida",
  handle: "begum",
  avatarUrl: null,
};

const message = (
  id: string,
  body: string,
  overrides: Partial<SentMessage> = {},
): SentMessage => ({
  id,
  body,
  conversationId: "c-1",
  senderId: sender.id,
  createdAt: new Date("2026-10-29T10:00:00.000Z"),
  sender,
  ...overrides,
});

describe("appendMessage", () => {
  it("replaces the optimistic bubble by temp id even when the stored body differs", () => {
    const optimistic = message("optimistic-1", "line one\r\nline two", {
      status: "sending",
    });
    const confirmed = message("m-1", "line one\nline two", {
      status: "sent",
    });

    // THE REGRESSION: matching by body alone left both bubbles on screen.
    const next = appendMessage([optimistic], confirmed, "optimistic-1");

    expect(next).toHaveLength(1);
    expect(next[0].id).toBe("m-1");
    expect(next[0].status).toBe("sent");
  });

  it("only removes the bubble that the confirmation replaces", () => {
    // Same author, same text, sent twice deliberately. Confirming the first
    // must not delete the second optimistic bubble.
    const first = message("optimistic-1", "ok", { status: "sending" });
    const second = message("optimistic-2", "ok", { status: "sending" });

    const next = appendMessage(
      [first, second],
      message("m-1", "ok", { status: "sent" }),
      "optimistic-1",
    );

    expect(next.map((m) => m.id)).toEqual(["optimistic-2", "m-1"]);
  });

  it("folds a broadcast that arrives without a temp id into the optimistic bubble", () => {
    const optimistic = message("optimistic-1", "line one\r\nline two", {
      status: "sending",
    });

    const next = appendMessage(
      [optimistic],
      message("m-1", "line one\nline two", { status: "sent" }),
    );

    // Bodies differ only in line endings; it is still the same message.
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe("m-1");
  });

  it("never appends the same database row twice", () => {
    const confirmed = message("m-1", "hello", { status: "sent" });
    const once = appendMessage([], confirmed);
    const twice = appendMessage(once, confirmed);

    expect(twice).toHaveLength(1);
    expect(twice[0].id).toBe("m-1");
  });

  it("keeps two in-flight optimistic bubbles with the same text", () => {
    const first = message("optimistic-1", "ok", { status: "sending" });

    const next = appendMessage(
      [first],
      message("optimistic-2", "ok", { status: "sending" }),
    );

    expect(next.map((m) => m.id)).toEqual(["optimistic-1", "optimistic-2"]);
  });

  it("keeps unrelated optimistic messages", () => {
    const pending = message("optimistic-9", "different text", {
      status: "sending",
      senderId: "u-2",
      sender: { id: "u-2", name: "Peer", handle: "peer", avatarUrl: null },
    });

    const next = appendMessage(
      [pending],
      message("m-1", "hello", { status: "sent" }),
      "optimistic-1",
    );

    expect(next.map((m) => m.id)).toEqual(["optimistic-9", "m-1"]);
  });
});

describe("sameMessageBody", () => {
  it("ignores CRLF differences and outer whitespace", () => {
    expect(sameMessageBody("a\r\nb", "a\nb")).toBe(true);
    expect(sameMessageBody(" hello ", "hello")).toBe(true);
  });

  it("keeps meaningful differences", () => {
    expect(sameMessageBody("hello", "hello!")).toBe(false);
    expect(sameMessageBody("a\nb", "a b")).toBe(false);
  });
});

describe("prependOlderMessages", () => {
  it("drops rows that are already rendered", () => {
    const current = [message("m-3", "newest"), message("m-4", "newer")];
    const page = [message("m-1", "oldest"), message("m-3", "newest")];

    const next = prependOlderMessages(current, page);

    expect(next.map((m) => m.id)).toEqual(["m-1", "m-3", "m-4"]);
  });

  it("returns the same array when a duplicate page adds nothing", () => {
    const current = [message("m-1", "oldest")];

    expect(prependOlderMessages(current, [message("m-1", "oldest")])).toBe(
      current,
    );
  });
});

describe("isPendingMessageDelivered", () => {
  const pending = {
    body: "mere me kyu kaam karaha...",
    senderId: "u-1",
    createdAt: "2026-10-29T10:00:00.000Z",
  };

  it("detects a stored row whose confirmation was lost", () => {
    const delivered = [
      message("m-1", "mere me kyu kaam karaha...", {
        createdAt: new Date("2026-10-29T10:00:02.000Z"),
      }),
    ];

    expect(isPendingMessageDelivered(pending, delivered)).toBe(true);
  });

  it("matches a body the server normalised", () => {
    const delivered = [
      message("m-1", "line one\nline two", {
        createdAt: new Date("2026-10-29T10:00:01.000Z"),
      }),
    ];

    expect(
      isPendingMessageDelivered(
        { ...pending, body: "line one\r\nline two" },
        delivered,
      ),
    ).toBe(true);
  });

  it("does not treat another author's identical text as delivery", () => {
    const delivered = [
      message("m-1", pending.body, {
        senderId: "u-2",
        sender: { id: "u-2", name: "Peer", handle: "peer", avatarUrl: null },
        createdAt: new Date("2026-10-29T10:00:01.000Z"),
      }),
    ];

    expect(isPendingMessageDelivered(pending, delivered)).toBe(false);
  });

  it("does not treat a much older copy as delivery", () => {
    const delivered = [
      message("m-0", pending.body, {
        createdAt: new Date("2026-10-28T10:00:00.000Z"),
      }),
    ];

    expect(isPendingMessageDelivered(pending, delivered)).toBe(false);
  });

  it("is false for an empty thread", () => {
    expect(isPendingMessageDelivered(pending, [])).toBe(false);
  });
});
