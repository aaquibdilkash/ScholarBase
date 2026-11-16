/**
 * @vitest-environment jsdom
 *
 * Regression: `AdmissionCard` was the only content card that never forwarded
 * `editedDate` to the shared card shell, so an edited admission kept showing
 * only "Created … ago" on the list and in the Trending tab. Every other module
 * already surfaced the "Edited … ago" label.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { AdmissionCard } from "@/components/admissions/AdmissionCard";
import type { AdmissionWithAuthor } from "@/types/cards";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admissions",
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

// The interaction children read the Supabase-backed session; the card itself
// only needs the rendered shell.
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
vi.mock("@/components/cards/CollapsibleMediaBody", () => ({
  CollapsibleMediaBody: ({
    header,
    text,
  }: {
    header?: React.ReactNode;
    text?: React.ReactNode;
  }) => (
    <div>
      {header}
      {text}
    </div>
  ),
}));
vi.mock("@/app/actions/admissions", () => ({
  deleteAdmission: vi.fn(async () => ({ success: true, data: { deletedId: "a" } })),
}));
vi.mock("@/utils/cacheMutation", () => ({ removeFromList: vi.fn() }));

const AUTHOR = {
  id: "u-1",
  name: "Me",
  handle: "me",
  avatarUrl: null,
  institutionVerifiedAt: null,
};

const makeAdmission = (
  overrides: Partial<AdmissionWithAuthor> = {},
): AdmissionWithAuthor => ({
  id: "adm-1",
  createdAt: new Date("2026-11-16T10:00:00.000Z"),
  updatedAt: new Date("2026-11-16T10:00:00.000Z"),
  deadline: new Date("2026-12-31T00:00:00.000Z"),
  university: "Oxford",
  department: "Computer Science",
  location: "Oxford, United Kingdom",
  level: "PHD",
  description: "<p>Program</p>",
  imageUrl: null,
  notificationLink: "https://example.org/notice",
  applyLink: "https://example.org/apply",
  authorId: AUTHOR.id,
  author: AUTHOR,
  totalVotes: 0,
  totalBookmarks: 0,
  totalComments: 0,
  votes: [],
  bookmarks: [],
  ...overrides,
});

describe("AdmissionCard edited label", () => {
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
    vi.restoreAllMocks();
  });

  const draw = async (admission: AdmissionWithAuthor) => {
    await act(async () => {
      root.render(<AdmissionCard admission={admission} currentUserId="u-1" />);
    });
  };

  it("shows 'Edited … ago' when the admission was edited after creation", async () => {
    await draw(
      makeAdmission({
        editedAt: new Date("2026-11-16T10:30:00.000Z"),
      }),
    );

    expect(container.textContent).toContain("Created");
    expect(container.textContent).toContain("Edited");
  });

  it("does not show the edited label when the row was never edited", async () => {
    await draw(makeAdmission({ editedAt: null }));

    expect(container.textContent).toContain("Created");
    expect(container.textContent).not.toContain("Edited");
  });

  it("renders without a department and shows the optional location", async () => {
    await draw(makeAdmission({ department: null }));

    expect(container.textContent).not.toContain("null");
    expect(container.textContent).toContain("Oxford, United Kingdom");
  });
});
