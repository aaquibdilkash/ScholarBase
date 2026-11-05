/**
 * @vitest-environment jsdom
 *
 * Regression: a frozen account could edit/delete its REPLIES but not its
 * top-level COMMENTS. The server intentionally allows frozen owners to
 * edit/delete their own content (`editComment` / `deleteComment` use
 * `requireCurrentUser`, so content can be corrected before an appeal), but the
 * parent comment card hid the whole actions menu when the viewer was frozen
 * while reply cards never received the `userFrozen` prop.
 *
 * Frozen accounts must still be able to manage their own content, while
 * replying (creating) stays disabled.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { CommentThread } from "@/components/interactions/CommentThread";
import type { CommentWithAuthorAndVotes } from "@/types/comments";

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
  fetchReplies: vi.fn(),
}));

vi.mock("@/components/interactions/CommentActionsDropdown", () => ({
  default: ({
    canEdit,
    onReply,
  }: {
    canEdit?: boolean;
    onReply?: () => void;
  }) => (
    <div
      data-testid="comment-actions"
      data-can-edit={String(canEdit ?? true)}
      data-can-reply={String(!!onReply)}
    />
  ),
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
  useIsFrozen: () => true,
}));

const AUTHOR_ID = "u-frozen-owner";

const COMMENT: CommentWithAuthorAndVotes = {
  id: "c-1",
  content: "top-level comment",
  createdAt: new Date("2026-10-29T10:00:00.000Z"),
  updatedAt: new Date("2026-10-29T10:00:00.000Z"),
  editedAt: null,
  parentId: null,
  authorId: AUTHOR_ID,
  author: {
    id: AUTHOR_ID,
    name: "Frozen Owner",
    handle: "frozen_owner",
    avatarUrl: null,
    institutionVerifiedAt: null,
  },
  isDeleted: false,
  isFrozen: false,
  deletedByType: null,
  hasActiveAppeal: false,
  totalVotes: 0,
  totalReplies: 0,
  votes: [],
  mentions: [],
} as CommentWithAuthorAndVotes;

describe("CommentThread for a frozen account", () => {
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

  const draw = async (comment: CommentWithAuthorAndVotes) => {
    await act(async () => {
      root.render(
        <CommentThread
          comment={comment}
          module="post"
          targetId="p-1"
          currentUserId={AUTHOR_ID}
          postAuthorId={AUTHOR_ID}
          onCountDelta={() => {}}
          onRemoved={() => {}}
        />,
      );
    });
  };

  const actions = () =>
    Array.from(container.querySelectorAll('[data-testid="comment-actions"]'));

  it("keeps Edit/Delete on the owner's top-level comment", async () => {
    await draw(COMMENT);

    expect(actions()).toHaveLength(1);
    expect(actions()[0]?.getAttribute("data-can-edit")).toBe("true");
    expect(actions()[0]?.getAttribute("data-can-reply")).toBe("false");
  });

  it("keeps Edit/Delete on the owner's reply", async () => {
    const reply = {
      ...COMMENT,
      id: "c-2",
      content: "a reply",
      parentId: COMMENT.id,
    } as CommentWithAuthorAndVotes;

    await draw({ ...COMMENT, totalReplies: 1, replies: [reply] });

    // One menu for the parent, one for the reply — both owned by the viewer.
    expect(actions()).toHaveLength(2);
    for (const action of actions()) {
      expect(action.getAttribute("data-can-edit")).toBe("true");
      expect(action.getAttribute("data-can-reply")).toBe("false");
    }
    expect(container.textContent).not.toContain("Add a reply");
  });

  it("still hides the menu on content frozen by moderators", async () => {
    await draw({ ...COMMENT, isFrozen: true });

    expect(actions()).toHaveLength(0);
  });
});
