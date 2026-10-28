/**
 * @vitest-environment jsdom
 *
 * Regression: one send rendered two bubbles.
 *
 * `handleSubmit` is async and guarded by `isSubmitting` state, which is only
 * visible after a re-render. Two submit events in the same frame — a double
 * click on Send, or Enter pressed twice — both passed the guard, posted the
 * same text twice and created two real rows. A ref is now the send lock, and
 * the persisted row is returned with the optimistic temp id so the thread can
 * replace that exact bubble instead of matching on body text.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { User } from "@supabase/supabase-js";

import { MessageInputForm } from "@/components/messages/MessageInputForm";

const sendMessage = vi.hoisted(() => vi.fn());

vi.mock("@/app/actions/messages", () => ({ sendMessage }));

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const USER = {
  id: "u-1",
  user_metadata: { name: "Samida", handle: "begum" },
} as unknown as User;

const CREATED = {
  id: "m-1",
  body: "mere me kyu kaam karaha...",
  createdAt: new Date("2026-10-29T10:00:00.000Z"),
  senderId: "u-1",
  conversationId: "c-1",
  replyToId: null,
  sender: { id: "u-1", name: "Samida", handle: "begum", avatarUrl: null },
  replyTo: null,
};

describe("MessageInputForm send lock", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    window.localStorage.clear();
    sendMessage.mockReset();
    sendMessage.mockResolvedValue(CREATED);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  const typeInto = (value: string) => {
    const textarea = container.querySelector("textarea");
    if (!textarea) throw new Error("composer textarea not rendered");
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    return textarea;
  };

  it("posts once when submit fires twice in the same frame", async () => {
    const onMessageSent = vi.fn();

    await act(async () => {
      root.render(
        <MessageInputForm
          conversationId="c-1"
          currentUser={USER}
          onMessageSent={onMessageSent}
        />,
      );
    });

    const textarea = typeInto("mere me kyu kaam karaha...");
    const form = textarea.closest("form");
    if (!form) throw new Error("composer form not rendered");

    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);

    // Optimistic bubble first, confirmed row second — the caller is told which
    // temp id the confirmation replaces.
    const confirmedCall = onMessageSent.mock.calls.at(-1);
    expect(confirmedCall?.[0]).toMatchObject({ id: "m-1", status: "sent" });
    expect(confirmedCall?.[1]).toMatch(/^optimistic-/);
  });

  it("clears the composer after the message is queued", async () => {
    await act(async () => {
      root.render(
        <MessageInputForm conversationId="c-1" currentUser={USER} />,
      );
    });

    const textarea = typeInto("hello");
    const form = textarea.closest("form")!;

    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
    });

    expect((container.querySelector("textarea") as HTMLTextAreaElement).value).toBe(
      "",
    );
  });

  it("does not carry the previous conversation's draft into a new thread", async () => {
    await act(async () => {
      root.render(
        <MessageInputForm conversationId="c-1" currentUser={USER} />,
      );
    });

    const textarea = typeInto("draft for c-1");
    expect(textarea.value).toBe("draft for c-1");

    await act(async () => {
      root.render(
        <MessageInputForm conversationId="c-2" currentUser={USER} />,
      );
    });

    expect((container.querySelector("textarea") as HTMLTextAreaElement).value).toBe(
      "",
    );
  });
});
