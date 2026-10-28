/**
 * @vitest-environment jsdom
 *
 * Regression: selecting "Reply" renders the quote banner above the composer.
 * The effect that focused the textarea also called `scrollIntoView`, which
 * scrolled the page's `overflow-hidden` container and pushed the composer (and
 * its send button) below the clipped edge until the reply was sent.
 *
 * The banner itself also lacked `min-w-0 flex-1`, so a long unbroken message
 * body widened it and pushed the cancel button off-screen.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { User } from "@supabase/supabase-js";

import { MessageInputForm } from "@/components/messages/MessageInputForm";
import type { SentMessage } from "@/components/messages/MessageInputForm";

vi.mock("@/app/actions/messages", () => ({
  sendMessage: vi.fn(),
}));

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/utils/message-outbox", () => ({
  upsertPendingMessage: vi.fn(),
  removePendingMessage: vi.fn(),
  updatePendingMessageStatus: vi.fn(),
}));

const USER = {
  id: "u-1",
  user_metadata: { name: "Samida", handle: "begum" },
} as unknown as User;

const REPLY: SentMessage = {
  id: "m-1",
  body: "x".repeat(300),
  createdAt: new Date("2026-01-02T03:04:05.000Z"),
  senderId: "u-2",
  conversationId: "c-1",
  sender: { id: "u-2", name: "Samida", handle: "begum", avatarUrl: null },
};

describe("MessageInputForm reply preview", () => {
  let container: HTMLDivElement;
  let root: Root;
  let scrollIntoView: ReturnType<typeof vi.fn>;
  let focus: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    scrollIntoView = vi.fn();
    HTMLTextAreaElement.prototype.scrollIntoView =
      scrollIntoView as unknown as typeof HTMLTextAreaElement.prototype.scrollIntoView;
    focus = vi.spyOn(HTMLTextAreaElement.prototype, "focus");

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    focus.mockRestore();
    vi.unstubAllGlobals();
  });

  const draw = async (replyingTo: SentMessage | null) => {
    await act(async () => {
      root.render(
        <MessageInputForm
          conversationId="c-1"
          currentUser={USER}
          replyingTo={replyingTo}
          onCancelReply={vi.fn()}
        />,
      );
    });
  };

  it("focuses the composer without scrolling the clipped page container", async () => {
    await draw(REPLY);

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("renders the quote banner with a reachable cancel button", async () => {
    await draw(REPLY);

    const banner = container.querySelector(
      '[data-testid="reply-preview-banner"]',
    );
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain("Replying to Samida");
    expect(
      banner?.querySelector('[aria-label="Cancel reply"]'),
    ).not.toBeNull();

    // The content wrapper must be allowed to shrink, otherwise a long body
    // pushes the cancel button out of the composer.
    const wrapper = banner?.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("min-w-0");
    expect(wrapper.className).toContain("flex-1");
  });

  it("does not force focus when there is no reply target", async () => {
    await draw(null);

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
    expect(
      container.querySelector('[data-testid="reply-preview-banner"]'),
    ).toBeNull();
  });
});
