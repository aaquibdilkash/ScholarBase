/**
 * @vitest-environment jsdom
 *
 * A deleted detail page shows only the tombstone plus community content. The
 * author body, outbound CTA, management dropdown, vote/bookmark/report
 * controls and related-content rail are hidden; the discussion link stays.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import DetailPageCardShell from "@/components/cards/DetailPageCardShell";

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
vi.mock("@/components/interactions/CommentCountDisplay", () => ({
  default: ({ href, initialCount }: { href: string; initialCount: number }) => (
    <a data-testid="comments" href={href}>
      {initialCount} Comments
    </a>
  ),
}));
vi.mock("@/components/moderation/FrozenContentBanner", () => ({
  FrozenContentBanner: () => null,
}));
vi.mock("@/components/ui/UserAvatar", () => ({
  UserAvatar: () => null,
}));
vi.mock("@/components/ui/VerifiedBadge", () => ({
  VerifiedBadge: () => null,
}));

describe("DetailPageCardShell deleted content", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const draw = async (isDeleted: boolean) => {
    await act(async () => {
      root.render(
        <DetailPageCardShell
          backHref="/journals"
          backLabel="Back to Journals"
          authorName="Scholar"
          authorId="user-1"
          currentUserId="user-1"
          isDeleted={isDeleted}
          deletedByType="AUTHOR"
          deletedNoun="journal"
          createdDate={new Date("2026-10-01T10:00:00.000Z")}
          footerCommentsHref="#comments"
          footerCommentsCount={3}
          footerVoteButton={<button data-testid="vote">Vote</button>}
          footerBookmarkButton={<button data-testid="bookmark">Save</button>}
          footerReportMenu={<button data-testid="report">Report</button>}
          managementControls={
            <button data-testid="manage" type="button">
              Edit
            </button>
          }
          relatedContent={<aside data-testid="related">Related</aside>}
          bodyBottomContent={<a data-testid="cta" href="https://example.com">Visit</a>}
          preservedContent={<p data-testid="preserved">4.5 / 5 from reviews</p>}
          discussion={<div data-testid="discussion">Comments</div>}
        >
          <p data-testid="body">Author-written body</p>
        </DetailPageCardShell>,
      );
    });
  };

  it("hides the author body, CTA, controls and related rail when deleted", async () => {
    await draw(true);

    expect(container.querySelector('[data-testid="body"]')).toBeNull();
    expect(container.querySelector('[data-testid="cta"]')).toBeNull();
    expect(container.querySelector('[data-testid="manage"]')).toBeNull();
    expect(container.querySelector('[data-testid="vote"]')).toBeNull();
    expect(container.querySelector('[data-testid="bookmark"]')).toBeNull();
    expect(container.querySelector('[data-testid="report"]')).toBeNull();
    expect(container.querySelector('[data-testid="related"]')).toBeNull();
    expect(container.textContent).toContain("deleted by its author");
  });

  it("keeps community content and the discussion available", async () => {
    await draw(true);

    expect(container.querySelector('[data-testid="preserved"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="comments"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="discussion"]')).not.toBeNull();
  });

  it("renders the full live page", async () => {
    await draw(false);

    for (const id of [
      "body",
      "cta",
      "manage",
      "vote",
      "bookmark",
      "report",
      "related",
      "comments",
      "discussion",
      // Community content must survive on live pages too — moving it into
      // `preservedContent` must not make it tombstone-only.
      "preserved",
    ]) {
      expect(container.querySelector(`[data-testid="${id}"]`)).not.toBeNull();
    }
  });
});
