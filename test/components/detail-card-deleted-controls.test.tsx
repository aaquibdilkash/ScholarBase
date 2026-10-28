/**
 * @vitest-environment jsdom
 *
 * Regression: a deleted detail page still rendered the owner's management
 * dropdown (Edit / Delete), so authors could try to edit content that was
 * already tombstoned. The shared shell must hide those controls once
 * `isDeleted` is true while keeping the tombstone and preserved body.
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
  default: () => null,
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
          footerCommentsCount={0}
          managementControls={
            <button data-testid="manage" type="button">
              Edit
            </button>
          }
        >
          <p>Preserved body</p>
        </DetailPageCardShell>,
      );
    });
  };

  it("hides the owner management controls on a deleted detail page", async () => {
    await draw(true);

    expect(container.querySelector('[data-testid="manage"]')).toBeNull();
    expect(container.textContent).toContain("deleted by its author");
    expect(container.textContent).toContain("Preserved body");
  });

  it("keeps the owner management controls on a live detail page", async () => {
    await draw(false);

    expect(container.querySelector('[data-testid="manage"]')).not.toBeNull();
  });
});
