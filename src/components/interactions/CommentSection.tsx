"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createComment,
  fetchParentComments,
} from "@/app/actions/comments";
import { COMMENT_PAGE_SIZE } from "@/lib/constants";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useToast } from "@/components/ui/Toast";
import { useAuthModal } from "./AuthModal";
import { emitCommentCount } from "@/lib/comment-count-store";
import type { CommentWithAuthorAndVotes, CommentEntityType } from "@/types/comments";
import { CommentThread, MentionComposer, type MentionUser } from "./CommentThread";

interface CommentSectionProps {
  /** First page of parent comments (parentId === null), length <= 5. */
  comments: CommentWithAuthorAndVotes[];
  targetId: string;
  module: CommentEntityType;
  currentUserId: string | null;
  postAuthorId?: string | null;
  /**
   * Materialized totalComments for this entity. The header/footer badge shows
   * the TRUE total even though only one page of comments is loaded, and stays
   * accurate via +/- deltas as comments and replies are added or deleted.
   */
  totalComments?: number;
  /** Read-only mode (frozen post): hides the composer and reply buttons. */
  locked?: boolean;
}

export function CommentSection({
  comments: initialComments,
  targetId,
  module,
  currentUserId,
  postAuthorId,
  totalComments,
  locked = false,
}: CommentSectionProps) {
  // Parent slice ONLY. Replies live inside each CommentThread's local state.
  // Dedupe by id so offset pagination (which can overlap when a new comment is
  // inserted server-side at the head) never yields two rows with the same key.
  const [parents, setParents] = useState<CommentWithAuthorAndVotes[]>(() => {
    const seen = new Set<string>();
    return initialComments
      .slice(0, COMMENT_PAGE_SIZE)
      .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
  });
  const [parentSkip, setParentSkip] = useState(
    Math.min(initialComments.length, COMMENT_PAGE_SIZE),
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(
    initialComments.length > COMMENT_PAGE_SIZE,
  );

  const [content, setContent] = useState("");
  const [mentionedUsers, setMentionedUsers] = useState<MentionUser[]>([]);
  const draftKey = `draft_comment_${module}_${targetId}`;
  const { toast } = useToast();
  const { openAuthModal } = useAuthModal();
  const queryClient = useQueryClient();

  // Track how many comments are visible so the header badge stays accurate
  // without ever recounting the DB. Seed with the materialized totalComments
  // when available (only one PAGE of comments is actually loaded); fall back
  // to counting what was shipped for callers that don't pass it.
  const [visibleCount, setVisibleCount] = useState(() =>
    totalComments ??
    initialComments.reduce(
      (sum, c) => sum + (c.authorId ? 1 : 0) + (c.replies?.length ?? 0),
      0,
    ),
  );

  useEffect(() => {
    emitCommentCount(visibleCount);
  }, [visibleCount]);

  // Central counter handler: every thread reports +/-1 deltas here so we can
  // surgically update the detail-page and feed caches (RULE 1).
  const handleCountDelta = (delta: number) => {
    setVisibleCount((v) => Math.max(0, v + delta));
    queryClient.setQueriesData<{ totalComments?: number }>(
      { queryKey: [module, targetId] },
      (oldData) => {
        if (!oldData || typeof oldData !== "object") return oldData;
        const data = oldData as { totalComments?: number };
        if (typeof data.totalComments === "number") {
          return {
            ...data,
            totalComments: Math.max(0, data.totalComments + delta),
          };
        }
        return data;
      },
    );
    queryClient.setQueriesData(
      { queryKey: ["feed"] },
      (oldData) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData.map((item) => {
          const feedItem = item as { id: string; totalComments?: number };
          if (feedItem.id !== targetId || typeof feedItem.totalComments !== "number")
            return item;
          return {
            ...feedItem,
            totalComments: Math.max(0, feedItem.totalComments + delta),
          };
        });
      },
    );
  };

  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        const { content: savedContent, mentionedUsers: savedMentionedUsers } =
          JSON.parse(savedDraft);
        setContent(savedContent || "");
        setMentionedUsers(savedMentionedUsers || []);
      }
    } catch (error) {
      console.error("Failed to read draft from localStorage", error);
    }
  }, [draftKey]);

  const handleContentChange = (value: string) => {
    const currentMentions = mentionedUsers.filter((u) =>
      value.includes(`@${u.handle}`),
    );
    if (currentMentions.length !== mentionedUsers.length) {
      setMentionedUsers(currentMentions);
    }
    setContent(value);
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ content: value, mentionedUsers: currentMentions }),
      );
    } catch (error) {
      console.error("Failed to save draft to localStorage", error);
    }
  };

  const loadMoreComments = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = await fetchParentComments(
        module,
        targetId,
        parentSkip,
        currentUserId,
      );
      if (next && next.length > 0) {
        // Drop any rows we already hold (offset overlap after a head insert).
        setParents((prev) => {
          const seen = new Set(prev.map((c) => c.id));
          return [...prev, ...next.filter((c) => !seen.has(c.id))];
        });
        setParentSkip((s) => s + next.length);
        if (next.length < COMMENT_PAGE_SIZE) setHasMore(false);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to load comments.", variant: "destructive" });
    } finally {
      setLoadingMore(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUserId) {
      openAuthModal();
      return;
    }

    const formData = new FormData();
    formData.append('content', content);
    formData.append('mentions', JSON.stringify(mentionedUsers.map((u) => ({ id: u.id, handle: u.handle }))));

    try {
      const response = await createComment(formData, targetId, module);

      if (!response?.success || !response.data) {
        toast({ title: "Error", description: "Failed to post comment. Please try again.", variant: "destructive"});
        return;
      }

      // RULE 1: optimistic local prepend — no revalidatePath, no refetch.
      setParents((prev) => {
        const newComment = response.data as CommentWithAuthorAndVotes;
        if (prev.some((c) => c.id === newComment.id)) return prev;
        return [newComment, ...prev];
      });
      handleCountDelta(1);

      toast({ title: "Success", description: "Comment posted successfully!"});
      setContent("");
      setMentionedUsers([]);
      localStorage.removeItem(draftKey);
    } catch (error) {
      toast({ title: "Error", description: "Failed to post comment. Please try again.", variant: "destructive"});
      console.error(error);
    }
  };

  return (
    <div
      className="mt-4 sm:mt-6 p-4 sm:p-6 md:p-8 md:mt-8 sb-surface-strong rounded-xl"
      id="comments"
    >
      <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-950 mb-3 sm:mb-4 md:mb-6">
        Discussion
      </h2>
      <div className="space-y-4 md:space-y-6">
        {locked ? (
          <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
            <span aria-hidden>❄</span>
            Commenting is disabled while this post is under moderation.
          </p>
        ) : (
          <form
            onSubmit={handleFormSubmit}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <div className="flex-1 flex flex-col gap-2">
              <MentionComposer
                name="content"
                value={content}
                onChange={handleContentChange}
                placeholder="Share your thoughts on this...type @ to mention a scholar"
                mentionedUsers={mentionedUsers}
                onMentionedUsersChange={setMentionedUsers}
              />
              <div className="flex justify-end">
                <SubmitBtnWithAuth className="sb-button-primary w-full justify-center px-4 py-2 text-sm font-bold md:w-auto md:px-6 md:py-2.5 md:text-base">
                  Post Comment
                </SubmitBtnWithAuth>
              </div>
            </div>
          </form>
        )}

        <div className="space-y-4 md:space-y-6">
          {parents.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              module={module}
              targetId={targetId}
              currentUserId={currentUserId}
              postAuthorId={postAuthorId}
              locked={locked}
              onCountDelta={handleCountDelta}
              onRemoved={() =>
                setParents((prev) => prev.filter((c) => c.id !== comment.id))
              }
            />
          ))}

          {parents.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center md:py-10 dark:border-slate-800 dark:bg-slate-950/70">
              <p className="text-sm font-medium text-slate-500 md:text-base dark:text-slate-400">
                No comments yet. Start the academic discussion!
              </p>
            </div>
          )}

          {/* Shallow parent pagination — only while a previous page came back full */}
          {hasMore && (
            <button
              onClick={loadMoreComments}
              disabled={loadingMore}
              className="w-full rounded-xl border border-slate-200 py-2 text-sm font-bold text-blue-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:text-blue-300 dark:hover:bg-slate-900"
            >
              {loadingMore ? "Loading..." : "Load More Comments"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

