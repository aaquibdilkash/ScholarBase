/**
 * @vitest-environment jsdom
 *
 * Regression coverage for the Learning Zone follow-ups:
 *   - Free/Paid renders independently of the amount (a free course with no
 *     amount still says "Free", a paid course shows its decimal price).
 *   - The language is surfaced on the card.
 *   - The card CTA matches the detail page ("View Course"; the detail page used
 *     to say "Open Course").
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { CourseCard } from "@/components/courses/CourseCard";
import type { CourseWithAuthor } from "@/types/cards";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/learn",
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

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    setQueryData: vi.fn(),
    setQueriesData: vi.fn(),
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/hooks/useUser", () => ({
  useUser: () => ({ user: null, isLoading: false }),
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
vi.mock("@/components/interactions/ShareButton", () => ({
  ShareButton: () => null,
}));
vi.mock("@/components/cards/OwnerActionsDropdown", () => ({
  default: () => null,
}));
vi.mock("@/components/cards/ReportMenu", () => ({
  ReportMenu: () => null,
}));
vi.mock("@/components/content/RichContent", () => ({
  RichContent: ({ content }: { content: string }) => <div>{content}</div>,
}));
vi.mock("@/app/actions/courses", () => ({
  deleteCourse: vi.fn(async () => ({ success: true, data: { deletedId: "c" } })),
}));
vi.mock("@/utils/cacheMutation", () => ({ removeFromList: vi.fn() }));

const AUTHOR = {
  id: "u-1",
  name: "Me",
  handle: "me",
  avatarUrl: null,
  institutionVerifiedAt: null,
};

const makeCourse = (
  overrides: Partial<CourseWithAuthor> = {},
): CourseWithAuthor => ({
  id: "course-1",
  createdAt: new Date("2026-11-16T10:00:00.000Z"),
  updatedAt: new Date("2026-11-16T10:00:00.000Z"),
  title: "Research Methodology 101",
  provider: "YouTube",
  instructor: "Prof. Shalabh (IIT Kanpur) and Prof. Prashant Jha (NIT Sikkim)",
  language: "English",
  format: "Video",
  level: "Beginner",
  pricing: "PAID",
  price: 9.99,
  currency: "USD",
  durationValue: 1.5,
  durationUnit: "hours",
  link: "https://example.org/course",
  description: "<p>Methods</p>",
  authorId: AUTHOR.id,
  author: AUTHOR,
  totalVotes: 0,
  totalBookmarks: 0,
  totalComments: 0,
  votes: [],
  bookmarks: [],
  ...overrides,
});

describe("CourseCard details", () => {
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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const draw = async (course: CourseWithAuthor) => {
    await act(async () => {
      root.render(<CourseCard course={course} currentUserId="u-1" />);
    });
  };

  it("shows language, paid pricing and a decimal amount", async () => {
    await draw(makeCourse());

    expect(container.textContent).toContain("Language:");
    expect(container.textContent).toContain("English");
    expect(container.textContent).toContain("Pricing:");
    expect(container.textContent).toContain("Paid");
    expect(container.textContent).toContain("$9.99");
    expect(container.textContent).toContain("1.5 hours");
  });

  it("says Free without inventing a price amount", async () => {
    await draw(
      makeCourse({
        pricing: "FREE",
        price: null,
        language: "Hindi",
        durationValue: null,
        durationUnit: null,
      }),
    );

    expect(container.textContent).toContain("Free");
    expect(container.textContent).toContain("Hindi");
    expect(container.textContent).not.toContain("Price:");
  });

  it("uses the same CTA label as the detail page", async () => {
    await draw(makeCourse());

    expect(container.textContent).toContain("View Course");
    expect(container.textContent).not.toContain("Open Course");
  });
});
