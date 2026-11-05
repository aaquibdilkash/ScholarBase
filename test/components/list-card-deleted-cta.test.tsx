/**
 * @vitest-environment jsdom
 *
 * A tombstoned list card hides everything the author wrote — the body and the
 * outbound CTA that sits in `bodyBottomContent` — while keeping the community
 * surface (`preservedContent`) and the discussion link. Votes, bookmarks and
 * the report menu disappear because there is no live content left to act on.
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
          footerVoteButton={<button data-testid="vote">Vote</button>}
          footerBookmarkButton={<button data-testid="bookmark">Save</button>}
          footerReportMenu={<button data-testid="report">Report</button>}
          footerCommentsHref="#comments"
          footerCommentsCount={3}
          bodyBottomContent={
            <a data-testid="cta" href="https://example.com/journal">
              View Website
            </a>
          }
          preservedContent={
            isDeleted ? (
              <p data-testid="preserved">4.5 / 5 from reviews</p>
            ) : null
          }
        >
          <p data-testid="body">Author-written body</p>
        </ListPageCardShell>,
      );
    });
  };

  it("hides the author body and CTA on a deleted card", async () => {
    await draw(true);

    expect(container.querySelector('[data-testid="body"]')).toBeNull();
    expect(container.querySelector('[data-testid="cta"]')).toBeNull();
    expect(container.textContent).toContain("deleted by its author");
    expect(container.textContent).not.toContain("Author-written body");
  });

  it("keeps community content and the discussion link, drops interactions", async () => {
    await draw(true);

    expect(container.querySelector('[data-testid="preserved"]')).not.toBeNull();
    expect(container.querySelector('a[href="#comments"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="vote"]')).toBeNull();
    expect(container.querySelector('[data-testid="bookmark"]')).toBeNull();
    expect(container.querySelector('[data-testid="report"]')).toBeNull();
  });

  it("renders the body, CTA and footer controls on a live card", async () => {
    await draw(false);

    expect(container.querySelector('[data-testid="body"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="cta"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="vote"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="bookmark"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="report"]')).not.toBeNull();
    // Live cards embed the same summary inside their real body, so callers
    // pass no `preservedContent` until the row is tombstoned.
    expect(container.querySelector('[data-testid="preserved"]')).toBeNull();
  });
});
