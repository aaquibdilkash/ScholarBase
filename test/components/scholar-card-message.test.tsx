/**
 * @vitest-environment jsdom
 *
 * Regression: the /scholars directory gated its Message button behind
 * `currentUserId`, so signed-out visitors never saw it — while the same
 * ScholarCard showed Follow (which opens the auth modal). Signed-out users now
 * get the button too; MessageButton opens the auth modal instead of routing to
 * a login-walled /messages/new.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ScholarCard } from "@/components/scholars/ScholarCard";

const auth = vi.hoisted(() => ({
  openAuthModal: vi.fn(),
  user: null as { id: string } | null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/scholars",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch: _prefetch,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    prefetch?: boolean;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({ default: () => null }));

vi.mock("@/hooks/useUser", () => ({
  useUser: () => ({ user: auth.user, loading: false }),
}));

vi.mock("@/components/interactions/AuthModal", () => ({
  useAuthModal: () => ({ openAuthModal: auth.openAuthModal }),
}));

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/components/interactions/FollowButton", () => ({
  FollowButton: () => null,
}));
vi.mock("@/components/interactions/ShareButton", () => ({
  ShareButton: () => null,
}));
vi.mock("@/components/cards/ReportMenu", () => ({
  ReportMenu: () => null,
}));
vi.mock("@/components/content/RichContent", () => ({
  RichContent: ({ content }: { content: string }) => <p>{content}</p>,
}));

const SCHOLAR = {
  id: "scholar-1",
  name: "Shhh",
  handle: "shhh",
  avatarUrl: null,
  bio: null,
  reputation: 1,
  createdAt: new Date("2026-10-01T10:00:00.000Z"),
  followersCount: 1,
  followingCount: 0,
};

describe("ScholarCard message button", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    auth.openAuthModal.mockReset();
    auth.user = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  const draw = async (currentUserId?: string) => {
    await act(async () => {
      root.render(
        <ScholarCard scholar={SCHOLAR} currentUserId={currentUserId} />,
      );
    });
  };

  const messageButton = () =>
    Array.from(container.querySelectorAll("button, a")).find(
      (el) => el.textContent?.trim() === "Message",
    );

  it("shows the Message button to signed-out visitors and opens the auth modal", async () => {
    await draw(undefined);

    const button = messageButton();
    expect(button).toBeDefined();
    expect(button?.tagName).toBe("BUTTON");
    // No dead link to a login-walled route for anonymous visitors.
    expect(button?.getAttribute("href")).toBeNull();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(auth.openAuthModal).toHaveBeenCalledTimes(1);
  });

  it("links a signed-in viewer to the compose route", async () => {
    auth.user = { id: "viewer-1" };
    await draw("viewer-1");

    const link = messageButton();
    expect(link?.tagName).toBe("A");
    expect(link?.getAttribute("href")).toBe(`/messages/new?to=${SCHOLAR.id}`);
  });

  it("hides the Message button on the viewer's own card", async () => {
    auth.user = { id: SCHOLAR.id };
    await draw(SCHOLAR.id);

    expect(messageButton()).toBeUndefined();
  });
});
