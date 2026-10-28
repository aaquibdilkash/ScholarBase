/**
 * @vitest-environment jsdom
 *
 * Regression: deleting or freezing a post passes `locked` to CommentThread
 * (read-only discussion). The reply pager was gated behind the same condition
 * as "Add a reply", so every reply vanished from the preserved discussion
 * while the materialized totalComments still counted it (e.g. "2 Comments",
 * one visible).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { CommentThread } from "@/components/interactions/CommentThread";
import type { CommentWithAuthorAndVotes } from "@/types/comments";

const fetchReplies = vi.hoisted(() => vi.fn());

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

vi.mock("@/app/actions/comments", () => ({
  createComment: vi.fn(),
  deleteComment: vi.fn(),
  editComment: vi.fn(),
  fetchReplies,
}));

vi.mock("@/components/interactions/CommentActionsDropdown", () => ({
  default: () => null,
}));
vi.mock("@/components/cards/ReportMenu", () => ({ ReportMenu: () => null }));
vi.mock("@/components/interactions/CommentVoteButton", () => ({
  CommentVoteButton: () => null,
}));
vi.mock("@/components/ui/SubmitBtnWithAuth", () => ({
  SubmitBtnWithAuth: ({ children }: { children: React.ReactNode }) => (
    <button type="submit">{children}</button>
  ),
}));
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock("@/components/interactions/MentionComposer", () => ({
  MentionComposer: () => null,
  renderMentionContent: (content: string) => content,
}));
vi.mock("@/components/interactions/FrozenUserProvider", () => ({
  useIsFrozen: () => false,
}));

const PARENT: CommentWithAuthorAndVotes = {
  id: "c-1",
  content: "hello",
  createdAt: new Date("2026-10-29T10:00:00.000Z"),
  updatedAt: new Date("2026-10-29T10:00:00.000Z"),
  editedAt: null,
  parentId: null,
  authorId: "u-1",
  author: {
    id: "u-1",
    name: "Kaksha Dilkash",
    handle: "kaksha_dilkash",
    avatarUrl: null,
    institutionVerifiedAt: null,
  },
  isDeleted: false,
  isFrozen: false,
  deletedByType: null,
  hasActiveAppeal: false,
  totalVotes: 0,
  totalReplies: 1,
  votes: [],
  mentions: [],
} as CommentWithAuthorAndVotes;

const REPLY: CommentWithAuthorAndVotes = {
  ...PARENT,
  id: "c-2",
  content: "a reply",
  parentId: PARENT.id,
  totalReplies: 0,
  authorId: "u-2",
  author: {
    id: "u-2",
    name: "Replier",
    handle: "replier",
    avatarUrl: null,
    institutionVerifiedAt: null,
  },
} as CommentWithAuthorAndVotes;

describe("CommentThread on a locked (deleted) post", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    fetchReplies.mockReset();
    fetchReplies.mockResolvedValue([REPLY]);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const draw = async (comment: CommentWithAuthorAndVotes = PARENT) => {
    await act(async () => {
      root.render(
        <CommentThread
          comment={comment}
          module="post"
          targetId="p-1"
          currentUserId={null}
          postAuthorId={comment.authorId}
          locked
          onCountDelta={() => {}}
          onRemoved={() => {}}
        />,
      );
    });
  };

  const pagerButton = () =>
    Array.from(container.querySelectorAll("button")).find((el) =>
      el.textContent?.includes("replies"),
    );

  it("keeps existing replies reachable without offering a reply action", async () => {
    await draw();

    expect(container.textContent).not.toContain("Add a reply");

    const pager = pagerButton();
    expect(pager).toBeDefined();
    expect(pager?.textContent).toContain("(1)");

    await act(async () => {
      pager?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchReplies).toHaveBeenCalledWith("post", PARENT.id, 0);
    expect(container.textContent).toContain("a reply");
  });

  it("keeps replies reachable under a frozen post (locked + isFrozen)", async () => {
    await draw({ ...PARENT, isFrozen: true });

    expect(container.textContent).not.toContain("Add a reply");

    const pager = pagerButton();
    expect(pager).toBeDefined();
    expect(pager?.textContent).toContain("(1)");

    await act(async () => {
      pager?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchReplies).toHaveBeenCalledWith("post", PARENT.id, 0);
    expect(container.textContent).toContain("a reply");
  });
});
