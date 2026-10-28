/**
 * @vitest-environment jsdom
 *
 * Regression: deleted list cards dropped `bodyBottomContent`, so the outbound
 * CTA (View Website / View Journal / Apply / Visit Tool) vanished from the
 * list page while the detail page kept it. Those are navigation links, not
 * interactions — the tombstone itself says preserved content stays available.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import ListPageCardShell from "@/components/cards/ListPageCardShell";

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

vi.mock("@/components/interactions/FollowButton", () => ({
  FollowButton: () => null,
}));
vi.mock("@/components/interactions/ShareButton", () => ({
  ShareButton: () => null,
}));
vi.mock("@/components/moderation/FrozenContentBanner", () => ({
  FrozenContentBanner: () => null,
}));

describe("ListPageCardShell deleted cards", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  const draw = async (isDeleted: boolean) => {
    await act(async () => {
      root.render(
        <ListPageCardShell
          authorName="Scholar"
          detailPageHref="/journals/j-1"
          createdDate={new Date("2026-10-01T10:00:00.000Z")}
          isDeleted={isDeleted}
          deletedByType="AUTHOR"
          deletedNoun="journal"
          bodyBottomContent={
            <a data-testid="cta" href="https://example.com/journal">
              View Website
            </a>
          }
        >
          <p>Preserved body</p>
        </ListPageCardShell>,
      );
    });
  };

  it("keeps the outbound CTA on a deleted card", async () => {
    await draw(true);

    expect(container.querySelector('[data-testid="cta"]')).not.toBeNull();
    expect(container.textContent).toContain("deleted by its author");
    expect(container.textContent).toContain("Preserved body");
  });

  it("still renders the CTA on a live card", async () => {
    await draw(false);

    expect(container.querySelector('[data-testid="cta"]')).not.toBeNull();
  });
});
