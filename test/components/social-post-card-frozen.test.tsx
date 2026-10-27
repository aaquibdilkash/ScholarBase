/**
 * @vitest-environment jsdom
 *
 * Regression: a frozen post showed no moderation notice on the list card.
 *
 * The detail page (`/feed/[id]`) has always passed `isFrozen` + `frozenEntityId`
 * to `DetailPageCardShell`, but `SocialPostCard` only forwarded `isFrozen` to the
 * report menu — never to `ListPageCardShell`, which is what renders the banner.
 * So a post frozen by moderators looked completely normal in the feed and on
 * profile tabs, while its own page said "frozen by moderators".
 *
 * The banner itself is stubbed here: what regressed was the wiring, and this
 * test pins the props the shell must receive.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { SocialPostCard } from "@/components/feed/SocialPostCard";
import type { SocialPostWithAuthor } from "@/types/cards";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/feed",
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

// No image or avatar in these fixtures, so the loader is never rendered; the
// stub only prevents next/image's optimizer from being reached in jsdom.
vi.mock("next/image", () => ({ default: () => null }));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
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
vi.mock("@/components/ui/ImageLightbox", () => ({ ImageLightbox: () => null }));
vi.mock("@/components/interactions/MentionComposer", () => ({
  renderMentionContent: (text: string) => text,
}));
vi.mock("@/app/actions/feed", () => ({ deleteSocialPost: vi.fn() }));

/**
 * Stands in for the real banner, which lazy-loads server actions. Receiving
 * these props at all is the behaviour under test.
 */
vi.mock("@/components/moderation/FrozenContentBanner", () => ({
  FrozenContentBanner: (props: {
    entityId: string;
    module: string;
    variant?: string;
    ownerId?: string | null;
    hasActiveAppeal?: boolean;
  }) => (
    <div
      data-testid="frozen-banner"
      data-entity-id={props.entityId}
      data-module={props.module}
      data-variant={props.variant}
      data-owner-id={props.ownerId ?? ""}
      data-appeal={String(props.hasActiveAppeal)}
    />
  ),
}));

const AUTHOR = {
  id: "u-1",
  name: "kd_msc",
  handle: "kdmsc_kd",
  avatarUrl: null,
  institutionVerifiedAt: null,
};

const makePost = (
  overrides: Partial<SocialPostWithAuthor> = {},
): SocialPostWithAuthor => ({
  id: "post-1",
  content: "testing frozen without image",
  imageUrl: null,
  createdAt: new Date("2026-10-27T10:00:00.000Z"),
  updatedAt: new Date("2026-10-27T10:00:00.000Z"),
  editedAt: null,
  authorId: AUTHOR.id,
  author: AUTHOR,
  mentions: null,
  isFrozen: false,
  isDeleted: false,
  hasActiveAppeal: false,
  totalVotes: 0,
  totalBookmarks: 0,
  totalComments: 0,
  votes: [],
  bookmarks: [],
  ...overrides,
});

describe("SocialPostCard frozen state", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // jsdom has no ResizeObserver; the card only uses it to measure text.
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

  const draw = async (post: SocialPostWithAuthor) => {
    await act(async () => {
      root.render(<SocialPostCard post={post} currentUserId="u-1" />);
    });
  };

  it("shows the frozen notice on a frozen post in the feed list", async () => {
    await draw(makePost({ isFrozen: true }));

    const banner = container.querySelector('[data-testid="frozen-banner"]');
    expect(banner).not.toBeNull();
    expect(banner?.getAttribute("data-entity-id")).toBe("post-1");
    expect(banner?.getAttribute("data-module")).toBe("SOCIAL_FEED");
    // List cards use the compact variant; the detail page uses the full one.
    expect(banner?.getAttribute("data-variant")).toBe("list-compact");
    expect(banner?.getAttribute("data-owner-id")).toBe("u-1");
    expect(banner?.getAttribute("data-appeal")).toBe("false");
  });

  it("passes the active-appeal flag so the owner is not offered a second appeal", async () => {
    await draw(makePost({ isFrozen: true, hasActiveAppeal: true }));

    expect(
      container
        .querySelector('[data-testid="frozen-banner"]')
        ?.getAttribute("data-appeal"),
    ).toBe("true");
  });

  it("renders no frozen notice for a normal post", async () => {
    await draw(makePost());

    expect(container.querySelector('[data-testid="frozen-banner"]')).toBeNull();
    expect(container.textContent).toContain("testing frozen without image");
  });
});
