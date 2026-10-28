/**
 * @vitest-environment jsdom
 *
 * Regressions in the rendered thread:
 *
 *  1. Navigating from /messages/A to /messages/B reuses the page component, so
 *     MessageList kept its `messages` state and the previous conversation stayed
 *     on screen until a hard refresh. The stateful body is now keyed by
 *     conversation id.
 *  2. A message could be folded in twice (action result + Realtime broadcast, or
 *     a broadcast retry). The thread must hold exactly one bubble per id.
 *  3. The composer's optimistic bubble is replaced by the confirmed row using
 *     its temp id, so a text difference (CRLF, whitespace) cannot leave both.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { User } from "@supabase/supabase-js";

import { MessageList } from "@/components/messages/MessageList";
import type { SentMessage } from "@/components/messages/MessageInputForm";

vi.mock("@/app/actions/messages", () => ({
  getMoreMessages: vi.fn(async () => []),
  sendMessage: vi.fn(),
  editMessage: vi.fn(),
  deleteMessage: vi.fn(),
}));

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

class NoopIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const USER = { id: "u-1" } as User;

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

describe("MessageList thread state", () => {
  let container: HTMLDivElement;
  let root: Root;
  let append: (message: SentMessage, replacesId?: string) => void;
  let syncLatest: (rows: SentMessage[]) => boolean;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    // @ts-expect-error — test stub for an API jsdom does not provide.
    globalThis.IntersectionObserver = NoopIntersectionObserver;
    window.localStorage.clear();

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  const render = async (
    conversationId: string,
    initialMessages: SentMessage[],
  ) => {
    await act(async () => {
      root.render(
        <MessageList
          conversationId={conversationId}
          initialMessages={initialMessages}
          user={USER}
          otherParticipantLastReadAt={new Date(0)}
          registerAppend={(fn) => {
            append = fn;
          }}
          registerSyncLatest={(fn) => {
            syncLatest = fn;
          }}
        />,
      );
    });
  };

  const bubbleIds = () =>
    Array.from(container.querySelectorAll('[id^="message-"]')).map((node) =>
      node.getAttribute("id"),
    );

  it("resets the thread when the route moves to another conversation", async () => {
    await render("c-1", [message("m-1", "from conversation one")]);
    expect(container.textContent).toContain("from conversation one");

    await render("c-2", [
      message("m-2", "from conversation two", { conversationId: "c-2" }),
    ]);

    expect(container.textContent).toContain("from conversation two");
    expect(container.textContent).not.toContain("from conversation one");
    expect(bubbleIds()).toEqual(["message-m-2"]);
  });

  it("shows one bubble when the same confirmed row is folded in twice", async () => {
    await render("c-1", []);
    const confirmed = message("m-1", "hello", { status: "sent" });

    await act(async () => {
      append(confirmed);
      append(confirmed);
    });

    expect(bubbleIds()).toEqual(["message-m-1"]);
  });

  it("replaces the optimistic bubble even when the stored body differs", async () => {
    const optimistic = message("optimistic-1", "line one\r\nline two", {
      status: "sending",
    });
    await render("c-1", [optimistic]);

    await act(async () => {
      append(
        message("m-1", "line one\nline two", { status: "sent" }),
        "optimistic-1",
      );
    });

    expect(bubbleIds()).toEqual(["message-m-1"]);
    expect(
      container.querySelectorAll('[id^="message-"]'),
    ).toHaveLength(1);
  });

  it("merges only the rows a reconnect catch-up snapshot is missing", async () => {
    await render("c-1", [message("m-1", "already here")]);

    let added = false;
    await act(async () => {
      added = syncLatest([
        message("m-1", "already here", { status: "sent" }),
        message("m-2", "missed while offline", {
          status: "sent",
          createdAt: new Date("2026-10-29T10:05:00.000Z"),
        }),
      ]);
    });

    expect(added).toBe(true);
    expect(bubbleIds()).toEqual(["message-m-1", "message-m-2"]);

    // A second snapshot that adds nothing must report it (no extra mark-read).
    await act(async () => {
      added = syncLatest([message("m-2", "missed while offline", { status: "sent" })]);
    });
    expect(added).toBe(false);
    expect(bubbleIds()).toEqual(["message-m-1", "message-m-2"]);
  });

  it("applies an edit that landed while the channel was down", async () => {
    await render("c-1", [message("m-1", "typo", { status: "sent" })]);

    let updated = false;
    await act(async () => {
      updated = syncLatest([
        message("m-1", "fixed", {
          status: "sent",
          editedAt: new Date("2026-10-29T10:10:00.000Z"),
        }),
      ]);
    });

    expect(updated).toBe(true);
    expect(container.textContent).toContain("fixed");
    expect(bubbleIds()).toEqual(["message-m-1"]);
  });
});
