/**
 * @vitest-environment jsdom
 *
 * Regression: message bubbles and their reply previews used `break-all`, which
 * split ordinary words mid-word ("checking ta | g") even with a space available
 * to wrap at. `overflow-wrap: anywhere` alone still breaks long unbroken URLs
 * while letting normal words move to the next line intact.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { User } from "@supabase/supabase-js";

import { MessageItem } from "@/components/messages/MessageItem";
import { MessageInputForm } from "@/components/messages/MessageInputForm";
import type { SentMessage } from "@/components/messages/MessageInputForm";

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock("@/app/actions/messages", () => ({
  sendMessage: vi.fn(),
}));

const USER = { id: "u-1" } as User;

const sender = {
  id: "u-1",
  name: "Samida",
  handle: "begum",
  avatarUrl: null,
};

const LONG_URL =
  "https://docs.google.com/document/d/13x0vAFzTfptLMQNu7gK64ADl6c1XvN1Zx-yaKCIU/edit?tab=t.0";

const message = (body: string): SentMessage => ({
  id: "m-1",
  body,
  conversationId: "c-1",
  senderId: sender.id,
  createdAt: new Date("2026-10-29T10:00:00.000Z"),
  sender,
  replyTo: {
    id: "m-0",
    body: LONG_URL,
    isDeleted: false,
    sender,
  },
});

describe("message text wrapping", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const draw = async (element: React.ReactElement) => {
    await act(async () => {
      root.render(element);
    });
  };

  it("keeps normal words in a bubble and still wraps a long URL", async () => {
    await draw(
      <MessageItem
        message={message(
          "I am great you say? editttttt, checking tag",
        )}
        currentUserId="u-1"
        otherParticipantLastReadAt={new Date("2026-10-29T11:00:00.000Z")}
        canManage={false}
      />,
    );

    const body = container.querySelector("p.whitespace-pre-wrap")!;
    expect(body.textContent).toBe(
      "I am great you say? editttttt, checking tag",
    );
    expect(body.className).toContain("[overflow-wrap:anywhere]");
    expect(body.className).not.toContain("break-all");

    const quote = container.querySelector(
      'button[aria-label="Jump to quoted message"] span.line-clamp-1',
    )!;
    expect(quote.textContent).toBe(LONG_URL);
    expect(quote.className).toContain("[overflow-wrap:anywhere]");
    expect(quote.className).not.toContain("break-all");
  });

  it("keeps the composer reply preview word-safe", async () => {
    await draw(
      <MessageInputForm
        conversationId="c-1"
        currentUser={USER}
        replyingTo={message("The preview text")}
        onCancelReply={() => {}}
      />,
    );

    const preview = container.querySelector("p.line-clamp-1")!;
    expect(preview.className).toContain("[overflow-wrap:anywhere]");
    expect(preview.className).not.toContain("break-all");
  });
});
