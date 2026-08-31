"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatTimeAgo } from "@/utils/time-ago";
import {
  createComment,
  deleteComment,
  editComment,
  fetchReplies,
} from "@/app/actions/comments";

import CommentActionsDropdown from "@/components/interactions/CommentActionsDropdown";
import { ReportMenu } from "@/components/cards/ReportMenu";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { SubmitBtn } from "@/components/ui/SubmitBtn";
import { CommentVoteButton } from "@/components/interactions/CommentVoteButton";
import { useToast } from "@/components/ui/Toast";
import {
  MentionComposer,
  renderMentionContent,
  type MentionUser,
} from "./MentionComposer";
import type {
  CommentWithAuthorAndVotes,
  CommentEntityType,
} from "@/types/comments";
import type { ReportModule } from "@/types/reports";
import { COMMENT_CONTENT_TIP } from "@/constants/tooltips";
import { MAX_COMMENT_BODY } from "@/lib/constants";

export { type MentionUser, renderMentionContent as renderCommentContent };
export type { MentionUser as MentionUserType };

type ToastFn = (options: {
  title: string;
  description: string;
  variant?: "default" | "destructive";
}) => void;

// ============================================
// COMMENT MODULE -> REPORT MODULE MAP
// ============================================
// When reporting a comment row, the underlying content model is resolved from
// the report `module`. Comments for each parent entity map to the matching
// comment module (defaulting to SOCIAL_COMMENT).
const COMMENT_REPORT_MODULE: Record<CommentEntityType, ReportModule> = {
  post: "SOCIAL_COMMENT",
  article: "ARTICLE_COMMENT",
  vacancy: "JOB_VACANCY_COMMENT",
  admission: "PHD_ADMISSION_COMMENT",
  event: "RESEARCH_EVENT_COMMENT",
  supervisor: "SUPERVISOR_COMMENT",
  recommendation: "RECOMMENDATION_COMMENT",
  help: "HELP_COMMENT",
  journal: "JOURNAL_COMMENT",
  researchTool: "RESEARCH_TOOL_COMMENT",
  researchGrant: "RESEARCH_GRANT_COMMENT",
  course: "COURSE_COMMENT",
  result: "RESULT_COMMENT",
  contribution: "CONTRIBUTION_COMMENT",
  publication: "PUBLICATION_COMMENT",
  survey: "SURVEY_COMMENT",
};

// ============================================
// SHARED HELPERS (used by CommentSection too)
// ============================================

function ReplyForm({
  targetId,
  module,
  parentComment,
  onSuccess,
  toast,
}: {
  targetId: string;
  module: CommentEntityType;
  parentComment: CommentWithAuthorAndVotes;
  onSuccess: (reply: CommentWithAuthorAndVotes) => void;
  toast: ToastFn;
}) {
  const draftKey = `draft_reply_${module}_${targetId}_${parentComment.id}`;
  const [reply, setReply] = useState("");
  const [mentionedUsers, setMentionedUsers] = useState<MentionUser[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const { content: savedContent, mentionedUsers: savedMentionedUsers } =
          JSON.parse(saved);
        setReply(savedContent || "");
        setMentionedUsers(savedMentionedUsers || []);
      }
    } catch (error) {
      console.error("Failed to read reply draft from localStorage", error);
    }
  }, [draftKey]);

  const handleReplyChange = (value: string) => {
    const currentMentions = mentionedUsers.filter((u) =>
      value.includes(`@${u.handle}`),
    );
    if (currentMentions.length !== mentionedUsers.length) {
      setMentionedUsers(currentMentions);
    }
    setReply(value);
    try {
      const draft = JSON.stringify({
        content: value,
        mentionedUsers: currentMentions,
      });
      localStorage.setItem(draftKey, draft);
    } catch (error) {
      console.error("Failed to save reply draft to localStorage", error);
    }
  };

  const handleReplySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("content", reply);
    formData.append(
      "mentions",
      JSON.stringify(
        mentionedUsers.map((u) => ({ id: u.id, handle: u.handle })),
      ),
    );

    try {
      const response = await createComment(
        formData,
        targetId,
        module,
        parentComment.id,
      );

      if (!response?.success || !response.data) {
        toast({
          title: "Error",
          description: "Failed to post reply. Please try again.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Success", description: "Reply posted successfully!" });
      setReply("");
      setMentionedUsers([]);
      localStorage.removeItem(draftKey);
      onSuccess(response.data as CommentWithAuthorAndVotes);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to post reply. Please try again.",
        variant: "destructive",
      });
      console.error(error);
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleReplySubmit}
      className="mt-2 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 md:mt-3"
    >
      <div className="flex-1">
        <MentionComposer
          name="content"
          value={reply}
          onChange={handleReplyChange}
          placeholder={`Reply to ${parentComment.author?.name}...type @ to mention a scholar`}
          mentionedUsers={mentionedUsers}
          onMentionedUsersChange={setMentionedUsers}
          label="Add a reply"
          tooltip={COMMENT_CONTENT_TIP}
          maxLength={MAX_COMMENT_BODY}
        />
      </div>
      <div className="flex justify-end">
        <SubmitBtnWithAuth className="sb-button-primary w-full justify-center px-3 py-1.5 text-xs font-bold md:w-auto md:px-5 md:py-2.5 md:text-sm">
          Send
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}

// Maps the deletedByType tracker (RULE 4) to a human-readable tombstone.
function getDeletedMessage(
  deletedByType: CommentWithAuthorAndVotes["deletedByType"],
  isReply: boolean,
): string {
  switch (deletedByType) {
    case "ADMIN":
      return "This content was removed by a moderator.";
    case "POST_AUTHOR":
      return "This comment was removed by the author of the post.";
    case "PARENT_COMMENT_AUTHOR":
      return "This reply was removed by the author of the comment it replies to.";
    case "AUTHOR":
    default:
      return isReply
        ? "This reply was deleted by its author."
        : "This comment was deleted by its author.";
  }
}

// ============================================
// SINGLE COMMENT CARD (parent or reply)
// ============================================

interface CommentCardProps {
  comment: CommentWithAuthorAndVotes;
  isReply: boolean;
  module: CommentEntityType;
  targetId: string;
  currentUserId: string | null;
  postAuthorId?: string | null;
  replyingToThis: boolean;
  onToggleReplyForm: () => void;
  onEdited: (next: CommentWithAuthorAndVotes) => void;
  onTombstoned: () => void;
  onHardDeleted: () => void;
  onCountDelta: (delta: number) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  toast: ToastFn;
  /** Whole discussion locked (frozen parent post) — disables replying. */
  locked?: boolean;
}

function CommentCard({
  comment,
  isReply,
  module,
  currentUserId,
  postAuthorId,
  replyingToThis,
  onToggleReplyForm,
  onEdited,
  onTombstoned,
  onHardDeleted,
  onCountDelta,
  editingId,
  setEditingId,
  toast,
  locked = false,
}: CommentCardProps) {
  const isOwner = !!currentUserId && comment.author?.id === currentUserId;
  const wasEdited =
    comment.editedAt != null &&
    new Date(comment.editedAt).getTime() -
      new Date(comment.createdAt).getTime() >
      1000;
  // RULE 4: soft-deleted comments (isDeleted) and legacy tombstones
  // (authorId: null) both render the muted "[deleted]" placeholder card.
  const isTombstone = comment.isDeleted || !comment.authorId || !comment.author;
  // Frozen comments stay visible but read-only: no voting, reporting,
  // editing or replying until an admin unfreezes them.
  const isFrozen = comment.isFrozen === true;

  const [editedContent, setEditedContent] = useState(comment.content);
  const [editedMentions, setEditedMentions] = useState<MentionUser[]>(
    Array.isArray(comment.mentions) ? (comment.mentions as MentionUser[]) : [],
  );

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("content", editedContent);
    formData.append(
      "mentions",
      JSON.stringify(
        editedMentions.map((m) => ({ id: m.id, handle: m.handle })),
      ),
    );

    try {
      const response = await editComment(formData, comment.id, module);
      if (!response?.success || !response.data) {
        toast({
          title: "Error",
          description: "Failed to update comment. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // RULE 1: surgical local state update — no revalidatePath.
      onEdited({
        ...comment,
        content: response.data.content,
        editedAt: response.data.editedAt,
      });
      toast({ title: "Success", description: "Comment updated!" });
      setEditingId(null);
    } catch {
      toast({
        title: "Error",
        description: "Failed to update comment. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteComment = async () => {
    try {
      const response = await deleteComment(comment.id, module);
      if (response?.success) {
        // RULE 4: soft delete keeps the row alive (isDeleted = true);
        // the card stays in place as a "[deleted]" placeholder.
        if (response.data.wasTombstoned) {
          onTombstoned();
        } else {
          onHardDeleted();
        }
        onCountDelta(-1);
        toast({ title: "Success", description: "Comment Deleted!" });
      } else {
        throw new Error("Unknown error");
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : "Failed to delete comment. Please try again.";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  if (isTombstone) {
    return (
      <div className="group flex gap-1 md:gap-2">
        <div className="shrink-0 pt-1">
          <div
            className={`overflow-hidden rounded-full border bg-slate-100 dark:border-slate-800 dark:bg-slate-900 ${isReply ? "h-8 w-8" : "h-9 w-9 md:h-10 md:w-10"}`}
          >
            <div
              className={`flex h-full w-full items-center justify-center font-bold text-slate-500 dark:text-slate-300 ${isReply ? "text-[10px] md:text-xs" : "text-xs md:text-sm"}`}
            >
              ?
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={`rounded-2xl rounded-tl-none border p-2.5 md:p-3 ${isReply ? "border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70" : "border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/75"}`}
          >
            <p className="italic mt-2 text-xs text-slate-500 dark:text-slate-400 md:text-sm">
              {comment.isDeleted
                ? getDeletedMessage(comment.deletedByType, isReply)
                : comment.content}
            </p>
          </div>
          {!isReply && (
            <span className="ml-2 mt-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 md:text-xs">
              {comment.totalReplies ?? 0}{" "}
              {(comment.totalReplies ?? 0) === 1 ? "Reply" : "Replies"}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="group flex gap-1 md:gap-2">
      <Link
        href={`/scholars/${comment.author?.id ?? "#"}`}
        className="shrink-0 pt-1"
      >
        <div
          className={`overflow-hidden rounded-full border bg-slate-100 transition hover:ring-2 hover:ring-blue-200 dark:border-slate-800 dark:bg-slate-900 ${
            isReply ? "h-8 w-8" : "h-9 w-9 md:h-10 md:w-10"
          }`}
        >
          {comment.author?.avatarUrl ? (
            <Image
              src={comment.author.avatarUrl}
              alt="User"
              width={isReply ? 40 : 44}
              height={isReply ? 40 : 44}
              unoptimized
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className={`flex h-full w-full items-center justify-center font-bold text-slate-500 dark:text-slate-300 ${
                isReply ? "text-[10px] md:text-xs" : "text-xs md:text-sm"
              }`}
            >
              {comment.author?.name?.charAt(0).toUpperCase() || "?"}
            </div>
          )}
        </div>
      </Link>

      <div className="min-w-0 flex-1">
        <div
          className={`rounded-2xl rounded-tl-none border p-2.5 md:p-3 ${
            isReply
              ? "border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70"
              : "border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/75"
          }`}
        >
          <div className="mb-1 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/scholars/${comment.author?.id ?? "#"}`}
                  className="truncate text-xs font-bold text-slate-900 hover:text-blue-600 hover:underline dark:text-slate-50 dark:hover:text-blue-300 md:text-sm"
                >
                  {comment.author?.name || "Scholar"}
                </Link>
                {postAuthorId && comment.author?.id === postAuthorId && (
                  <span className="inline-flex items-center rounded-md bg-blue-100 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 md:text-[10px]">
                    Author
                  </span>
                )}
              </div>
              {comment.author?.handle ? (
                <Link
                  href={`/scholars/${comment.author?.id ?? "#"}`}
                  className="mt-0.5 block truncate text-[11px] font-medium text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300 md:text-xs"
                >
                  @{comment.author?.handle}
                </Link>
              ) : null}
            </div>
            <span
              suppressHydrationWarning
              className={`font-medium ${
                isReply
                  ? "text-[10px] text-slate-400 md:text-[11px]"
                  : "text-[11px] text-slate-400 md:text-xs"
              }`}
            >
              Created {formatTimeAgo(comment.createdAt)}
            </span>
          </div>

          {editingId === comment.id ? (
            <form onSubmit={handleEditSubmit}>
              <MentionComposer
                name="content"
                value={editedContent}
                onChange={setEditedContent}
                placeholder="Update your comment..."
                mentionedUsers={editedMentions}
                onMentionedUsersChange={setEditedMentions}
                label="Edit comment"
                maxLength={MAX_COMMENT_BODY}
              />
              <div className="mt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  Cancel
                </button>
                <SubmitBtn className="rounded-xl bg-slate-950 px-4 py-1.5 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-slate-950 dark:hover:bg-slate-800">
                  Save
                </SubmitBtn>
              </div>
            </form>
          ) : (
            <>
              <p className="wrap-break-word whitespace-pre-wrap text-xs text-slate-700 mt-2 dark:text-slate-300 md:text-sm">
                {renderMentionContent(comment.content, comment.mentions)}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                {wasEdited && (
                  <span
                    suppressHydrationWarning
                    className="text-xs font-semibold text-slate-400 dark:text-slate-500"
                  >
                    {`Edited ${formatTimeAgo(comment.editedAt)}`}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-2 md:gap-3">
                  {isFrozen ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 md:text-xs">
                      ❄ Frozen by moderators
                    </span>
                  ) : (
                    <>
                      <ReportMenu
                        entityId={comment.id}
                        entityType="COMMENT"
                        module={COMMENT_REPORT_MODULE[module]}
                        ownerId={comment.author?.id ?? null}
                        currentUserId={currentUserId ?? null}
                        isFrozen={comment.isFrozen}
                        isDeleted={comment.isDeleted}
                        hasActiveAppeal={comment.hasActiveAppeal}
                      />
                      <CommentActionsDropdown
                        isOwner={isOwner}
                        onEdit={() => setEditingId(comment.id)}
                        onDelete={handleDeleteComment}
                      />
                      <CommentVoteButton
                        commentId={comment.id}
                        type={module}
                        initialTotalVotes={comment.totalVotes}
                        initialUserVote={comment.votes?.[0]?.voteType ?? null}
                      />
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {!isReply && !isFrozen && !locked && (
          <button
            onClick={onToggleReplyForm}
            className="ml-2 mt-2 text-[11px] font-bold text-slate-500 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300 md:text-xs"
          >
            Reply ({comment.totalReplies ?? 0})
          </button>
        )}
        {replyingToThis && null}
      </div>
    </div>
  );
}

// ============================================
// COMMENT THREAD (one parent + its lazy replies)
// ============================================
// Owns ONLY its own reply slice. Loading replies here never re-renders other
// threads or the parent CommentSection list.
export function CommentThread({
  comment: initialComment,
  module,
  targetId,
  currentUserId,
  postAuthorId,
  locked = false,
  onCountDelta,
  onRemoved,
}: {
  comment: CommentWithAuthorAndVotes;
  module: CommentEntityType;
  targetId: string;
  currentUserId: string | null;
  postAuthorId?: string | null;
  locked?: boolean;
  onCountDelta: (delta: number) => void;
  onRemoved: () => void;
}) {
  const { toast } = useToast();
  const [comment, setComment] = useState(initialComment);
  // Local reply slice — starts empty unless the server preloaded a page.
  const [replies, setReplies] = useState<CommentWithAuthorAndVotes[]>(
    initialComment.replies ?? [],
  );
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Materialized counter decides button visibility — zero extra queries.
  const hasMoreReplies = (comment.totalReplies ?? 0) > replies.length;

  const loadMoreReplies = async () => {
    if (loadingReplies || !hasMoreReplies) return;
    setLoadingReplies(true);
    try {
      // Offset pagination: skip exactly what this thread already holds locally.
      const next = await fetchReplies(
        module,
        comment.id,
        replies.length,
        currentUserId,
      );
      setReplies((prev) => [...prev, ...(next ?? [])]);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to load replies.",
        variant: "destructive",
      });
    } finally {
      setLoadingReplies(false);
    }
  };

  const handleReplyPosted = (reply: CommentWithAuthorAndVotes) => {
    setReplies((prev) => [...prev, reply]);
    setComment((c) => ({ ...c, totalReplies: (c.totalReplies ?? 0) + 1 }));
    onCountDelta(1);
    setActiveReplyId(null);
  };

  return (
    <div>
      <CommentCard
        comment={comment}
        isReply={false}
        module={module}
        targetId={targetId}
        currentUserId={currentUserId}
        postAuthorId={postAuthorId}
        replyingToThis={activeReplyId === comment.id}
        locked={locked}
        onToggleReplyForm={() =>
          setActiveReplyId(activeReplyId === comment.id ? null : comment.id)
        }
        onEdited={(next) => setComment(next)}
        onTombstoned={() =>
          setComment((c) => ({
            ...c,
            // RULE 4: soft delete — toggle isDeleted, keep the row intact.
            isDeleted: true,
          }))
        }
        onHardDeleted={() => onRemoved()}
        onCountDelta={onCountDelta}
        editingId={editingId}
        setEditingId={setEditingId}
        toast={(...args) => toast(...args)}
      />

      {/* 🔥 WRAPPER ADDED HERE: Indents everything past the parent avatar */}
      <div className="ml-10 md:ml-12">
        {hasMoreReplies && (
          <button
            onClick={loadMoreReplies}
            disabled={loadingReplies}
            className="ml-2 mt-2 block text-[11px] font-bold text-blue-600 transition-colors hover:text-blue-700 disabled:opacity-50 dark:text-blue-300 dark:hover:text-blue-200 md:text-xs"
          >
            {loadingReplies
              ? "Loading..."
              : replies.length === 0
                ? "Load Replies"
                : "Load More Replies"}
          </button>
        )}

        {activeReplyId === comment.id &&
          !!comment.authorId &&
          !comment.isDeleted && (
            <ReplyForm
              targetId={targetId}
              module={module}
              parentComment={comment}
              onSuccess={handleReplyPosted}
              toast={toast}
            />
          )}

        {replies.length > 0 && (
          <div className="mt-2 space-y-2 border-l-2 border-slate-100 pl-2 dark:border-slate-800 md:mt-3 md:space-y-3 md:pl-4">
            {replies.map((reply) => (
              <CommentCard
                key={reply.id}
                comment={reply}
                isReply={true}
                module={module}
                targetId={targetId}
                currentUserId={currentUserId}
                postAuthorId={postAuthorId}
                replyingToThis={false}
                locked={locked}
                onToggleReplyForm={() => {}}
                onEdited={(next) =>
                  setReplies((prev) =>
                    prev.map((r) => (r.id === next.id ? next : r)),
                  )
                }
                onTombstoned={() =>
                  setReplies((prev) =>
                    prev.map((r) =>
                      r.id === reply.id ? { ...r, isDeleted: true } : r,
                    ),
                  )
                }
                onHardDeleted={() =>
                  setReplies((prev) => prev.filter((r) => r.id !== reply.id))
                }
                onCountDelta={onCountDelta}
                editingId={editingId}
                setEditingId={setEditingId}
                toast={(...args) => toast(...args)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
