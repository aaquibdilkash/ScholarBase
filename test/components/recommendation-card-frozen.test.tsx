/**
 * @vitest-environment jsdom
 *
 * Regression: a frozen ANONYMOUS recommendation hid its own author from the
 * frozen banner (`frozenOwnerId` was forced to null), so the owner saw the
 * freeze notice on the list with no "View reason & Appeal" — while the detail
 * page, which passes `authorId` unconditionally, offered one. Journal reviews
 * already behaved the other way, which is what made the two anonymous modules
 * disagree.
 *
 * Anonymity is a display rule, not a data rule: the card already uses the real
 * author id for the owner's own edit/delete dropdown. The banner needs the same
 * id to recognise the owner; it renders nothing for anyone else.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { RecommendationCard } from "@/components/supervisor/RecommendationCard";
import type { RecommendationWithAuthor } from "@/types/cards";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/supervisor/sup-1",
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({ default: () => null }));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutateAsync: vi.fn() }),
  useQueryClient: () => ({
    setQueryData: vi.fn(),
    setQueriesData: vi.fn(),
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/components/interactions/VoteButton", () => ({
  VoteButton: () => <span data-testid="vote" />,
}));
vi.mock("@/components/interactions/BookmarkButton", () => ({
  BookmarkButton: () => <span data-testid="bookmark" />,
}));
vi.mock("@/components/interactions/FollowButton", () => ({
  FollowButton: () => null,
}));

vi.mock("@/components/cards/OwnerActionsDropdown", () => ({ default: () => null }));
vi.mock("@/components/cards/ReportMenu", () => ({ ReportMenu: () => null }));
vi.mock("@/components/content/RichContent", () => ({
  RichContent: ({ content }: { content: string }) => <p>{content}</p>,
}));
vi.mock("@/components/ui/StarRating", () => ({ StarRating: () => null }));
vi.mock("@/components/supervisor/recommendationCount", () => ({
  decrementRecommendation: vi.fn(),
}));
vi.mock("@/utils/cacheMutation", () => ({ tombstoneInList: vi.fn() }));
vi.mock("@/app/actions/recommendations", () => ({
  deleteRecommendation: vi.fn(),
}));

vi.mock("@/components/moderation/FrozenContentBanner", () => ({
  FrozenContentBanner: (props: {
    entityId: string;
    module: string;
    ownerId?: string | null;
  }) => (
    <div
      data-testid="frozen-banner"
      data-entity-id={props.entityId}
      data-module={props.module}
      data-owner-id={props.ownerId ?? ""}
    />
  ),
}));

const AUTHOR = {
  id: "u-1",
  name: "Me",
  handle: "me",
  avatarUrl: null,
  institutionVerifiedAt: null,
};

const makeRecommendation = (
  overrides: Partial<RecommendationWithAuthor> = {},
): RecommendationWithAuthor => ({
  id: "rec-1",
  createdAt: new Date("2026-10-20T10:00:00.000Z"),
  updatedAt: new Date("2026-10-20T10:00:00.000Z"),
  rating: 5,
  feedback: "Outstanding mentorship.",
  turnaroundTimeDays: 3,
  responsivenessScore: 5,
  guidanceScore: 5,
  supervisorId: "sup-1",
  authorId: AUTHOR.id,
  author: AUTHOR,
  isFrozen: true,
  isAnonymous: false,
  hasActiveAppeal: false,
  totalVotes: 0,
  totalBookmarks: 0,
  totalComments: 0,
  votes: [],
  bookmarks: [],
  ...overrides,
});

describe("RecommendationCard frozen ownership", () => {
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

  const draw = async (recommendation: RecommendationWithAuthor) => {
    await act(async () => {
      root.render(
        <RecommendationCard
          recommendation={recommendation}
          supervisor={{ id: "sup-1", name: "Prof. Example" }}
          currentUserId={AUTHOR.id}
        />,
      );
    });
  };

  const banner = () =>
    container.querySelector('[data-testid="frozen-banner"]');

  it("keeps the owner id on an anonymous recommendation so the owner can appeal", async () => {
    await draw(makeRecommendation({ isAnonymous: true }));

    expect(banner()).not.toBeNull();
    expect(banner()?.getAttribute("data-owner-id")).toBe(AUTHOR.id);
    expect(banner()?.getAttribute("data-module")).toBe("RECOMMENDATION");
    // The anonymity rule still holds visually: no author name or profile link.
    expect(container.textContent).toContain("Anonymous recommendation");
    expect(container.textContent).not.toContain("@me");
  });

  it("passes the same owner id for a named recommendation", async () => {
    await draw(makeRecommendation());

    expect(banner()?.getAttribute("data-owner-id")).toBe(AUTHOR.id);
  });
});
