/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ShareButton } from "@/components/interactions/ShareButton";

// The button only needs the current pathname to build a URL when no `href` is
// passed. Toast is context-bound; stub the hook so we can assert the copy
// fallback message without standing up the provider's timers.
vi.mock("next/navigation", () => ({ usePathname: () => "/feed/abc" }));

const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ toast }),
}));

type SharePayload = { title?: string; text?: string; url?: string };

describe("ShareButton", () => {
  let container: HTMLDivElement;
  let root: Root;
  let share: ReturnType<typeof vi.fn>;
  let writeText: ReturnType<typeof vi.fn>;

  const setMeta = (property: string, content: string) => {
    const el = document.createElement("meta");
    el.setAttribute("property", property);
    el.setAttribute("content", content);
    document.head.appendChild(el);
  };

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    toast.mockClear();

    // jsdom has neither navigator.share nor clipboard; define them per-test via
    // the two spies below. Default to NO Web Share so the clipboard path runs.
    share = vi.fn(async () => {});
    writeText = vi.fn(async () => {});
    Object.defineProperty(window.navigator, "share", {
      configurable: true,
      value: share,
    });
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    document.head.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const draw = (element: React.ReactElement) =>
    act(() => {
      root.render(element);
    });

  const click = async () => {
    const button = container.querySelector("button")!;
    await act(async () => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  };

  it("shares title, text, and url from the page's Open Graph tags when no props are passed", async () => {
    setMeta("og:title", "A great post | ScholarBase");
    setMeta("og:description", "The body of the post.");
    draw(<ShareButton href="/feed/abc" />);
    await click();

    expect(share).toHaveBeenCalledTimes(1);
    const payload = share.mock.calls[0][0] as SharePayload;
    // Brand suffix is stripped so the shared title reads naturally.
    expect(payload.title).toBe("A great post");
    expect(payload.text).toBe("The body of the post.");
    expect(payload.url).toContain("/feed/abc");
  });

  it("prefers explicit title/text props over the Open Graph tags", async () => {
    setMeta("og:title", "Ignored | ScholarBase");
    setMeta("og:description", "Ignored description.");
    draw(
      <ShareButton
        href="/scholars/xyz"
        title="Invite a scholar to ScholarBase"
        text="Connect on ScholarBase."
      />,
    );
    await click();

    const payload = share.mock.calls[0][0] as SharePayload;
    expect(payload.title).toBe("Invite a scholar to ScholarBase");
    expect(payload.text).toBe("Connect on ScholarBase.");
  });

  it("falls back to copying a composed message when Web Share is unavailable", async () => {
    // `"share" in navigator` is what the component checks, so the property must
    // be removed (not set to undefined) to exercise the clipboard fallback.
    delete (window.navigator as unknown as { share?: unknown }).share;
    setMeta("og:title", "Post title | ScholarBase");
    setMeta("og:description", "Post body.");
    draw(<ShareButton href="/feed/abc" copySuccessMessage="Link copied!" />);
    await click();

    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain("Post body.");
    expect(copied).toContain("/feed/abc");
    expect(toast).toHaveBeenCalledWith("Link copied!");
  });

  it("still includes the url even when no meta or props supply title/text", async () => {
    draw(<ShareButton href="/feed/abc" />);
    await click();

    const payload = share.mock.calls[0][0] as SharePayload;
    expect(payload.title).toBeUndefined();
    expect(payload.text).toBeUndefined();
    expect(payload.url).toContain("/feed/abc");
  });
});
