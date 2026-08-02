"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatTimeAgo } from "@/utils/time-ago";
import {
  createCommentClientWrapper,
  deleteCommentClientWrapper,
  editCommentClientWrapper,
} from "@/app/actions/comments.clientWrappers";

import { CommentVoteButton } from "@/components/interactions/CommentVoteButton";
import CommentActionsDropdown from "@/components/interactions/CommentActionsDropdown";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { SubmitBtn } from "@/components/ui/SubmitBtn";
import { useToast } from "@/components/ui/Toast";
import { useAuthModal } from "./AuthModal";

// Define the exact shape Prisma is sending down
type User = { id: string; name: string | null; avatarUrl: string | null };
type Vote = { userId: string; voteType: "UPVOTE" | "DOWNVOTE" };

type Reply = {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author: User;
  votes: Vote[];
  parentId: string | null;
  _count: { votes: number };
};

type Comment = Reply & { replies: Reply[] };

interface CommentSectionProps {
  comments: Comment[];
  targetId: string;
  type:
    | "post"
    | "article"
    | "vacancy"
    | "admission"
    | "event"
    | "supervisor"
    | "recommendation"
    | "help"
    | "researchTool"
    | "journal"
    | "result"
    | "contribution"
    | "publication"
    | "survey";
  currentUserId: string | null;
  postAuthorId?: string | null;
}

export function CommentSection({
  comments,
  targetId,
  type,
  currentUserId,
  postAuthorId,
}: CommentSectionProps) {
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { openAuthModal } = useAuthModal();
  const draftKey = `draft_comment_${type}_${targetId}`;
  const [content, setContent] = useState("");

  const topLevelComments = comments.filter((c) => !c.parentId);

  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        setContent(savedDraft);
      }
    } catch (error) {
      console.error("Failed to read draft from localStorage", error);
    }
  }, [draftKey]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    try {
      localStorage.setItem(draftKey, e.target.value);
    } catch (error) {
      console.error("Failed to save draft to localStorage", error);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUserId) {
      openAuthModal();
      return;
    }

    const formData = new FormData(e.currentTarget);
    // Ensure the latest content from state is in the form data
    formData.set("content", content);

    try {
      await createCommentClientWrapper(formData);
      toast("Comment posted successfully!", "success");
      setContent("");
      localStorage.removeItem(draftKey);
    } catch (error) {
      toast("Failed to post comment. Please try again.", "error");
      console.error(error);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Form: Add a Top-Level Comment */}
      <form onSubmit={handleFormSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input type="hidden" name="_targetId" value={targetId} />
        <input type="hidden" name="_type" value={type} />
        <input type="hidden" name="_parentId" value="" />
        <input type="hidden" name="_commentId" value="" />

        <div className="flex-1 flex flex-col gap-2">
          <textarea
            name="content"
            placeholder="Share your thoughts on this..."
            required
            rows={2}
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 outline-none transition focus:bg-white focus:ring-2 focus:ring-blue-600 md:p-4 md:text-base dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:bg-slate-900"
            value={content}
            onChange={handleContentChange}
          />
          <div className="flex justify-end">
            <SubmitBtnWithAuth className="sb-button-primary w-full justify-center px-4 py-2 text-sm font-bold md:w-auto md:px-6 md:py-2.5 md:text-base">
              Post Comment
            </SubmitBtnWithAuth>
          </div>
        </div>
      </form>

      {/* The Comment Thread */}
      <div className="space-y-4 md:space-y-6">
        {topLevelComments.map((comment) => (
          <CommentEntry
            key={comment.id}
            comment={comment}
            replies={comment.replies}
            currentUserId={currentUserId}
            type={type}
            targetId={targetId}
            postAuthorId={postAuthorId}
            activeReplyId={activeReplyId}
            setActiveReplyId={setActiveReplyId}
            editingId={editingId}
            setEditingId={setEditingId}
            isReply={false}
            toast={toast}
            openAuthModal={openAuthModal}
          />
        ))}

        {topLevelComments.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center md:py-10 dark:border-slate-800 dark:bg-slate-950/70">
            <p className="text-sm font-medium text-slate-500 md:text-base dark:text-slate-400">
              No comments yet. Start the academic discussion!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function CommentEntry({
  comment,
  replies,
  currentUserId,
  type,
  targetId,
  postAuthorId,
  activeReplyId,
  setActiveReplyId,
  editingId,
  setEditingId,
  isReply,
  toast,
  openAuthModal,
}: {
  comment: Comment;
  replies?: Reply[];
  currentUserId: string | null;
  type: CommentSectionProps["type"];
  targetId: string;
  postAuthorId?: string | null;
  activeReplyId: string | null;
  setActiveReplyId: (id: string | null) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  isReply: boolean;
  toast: (message: string, type?: "success" | "error") => void;
  openAuthModal: () => void;
}) {
  const deleteFormRef = useRef<HTMLFormElement>(null);
  const isOwner = !!currentUserId && comment.author.id === currentUserId;
  const wasEdited =
    new Date(comment.updatedAt).getTime() -
      new Date(comment.createdAt).getTime() >
    1000;

  const handleReplySuccess = async (formData: FormData) => {
    try {
      await createCommentClientWrapper(formData);
      toast("Reply posted successfully!", "success");
      setActiveReplyId(null);
    } catch {
      toast("Failed to post reply. Please try again.", "error");
    }
  };

  const handleEditSuccess = async (formData: FormData) => {
    try {
      await editCommentClientWrapper(formData);
      toast("Comment updated!", "success");
      setEditingId(null);
    } catch {
      toast("Failed to update comment. Please try again.", "error");
    }
  };

  const handleDeleteComment = async (formData: FormData) => {
    try {
      await deleteCommentClientWrapper(formData);
      toast("Comment deleted.", "success");
    } catch {
      toast("Failed to delete comment. Please try again.", "error");
    }
  };

  return (
    <div className="group flex gap-2 md:gap-4">
      <Link href={`/scholars/${comment.author.id}`} className="shrink-0 pt-1">
        <div
          className={`overflow-hidden rounded-full border bg-slate-100 transition hover:ring-2 hover:ring-blue-200 dark:border-slate-800 dark:bg-slate-900 ${
            isReply ? "h-7 w-7 md:h-8 md:w-8" : "h-9 w-9 md:h-10 md:w-10"
          }`}
        >
          {comment.author.avatarUrl ? (
            <Image
              src={comment.author.avatarUrl}
              alt="User"
              width={isReply ? 28 : 36}
              height={isReply ? 28 : 36}
              unoptimized
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className={`flex h-full w-full items-center justify-center font-bold text-slate-500 dark:text-slate-300 ${
                isReply ? "text-[10px] md:text-xs" : "text-xs md:text-sm"
              }`}
            >
              {comment.author.name?.charAt(0).toUpperCase() || "?"}
            </div>
          )}
        </div>
      </Link>

      <div className="min-w-0 flex-1 overflow-hidden">
        <div
          className={`rounded-2xl rounded-tl-none border p-2.5 md:p-3 ${
            isReply
              ? "border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70"
              : "border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/75"
          }`}
        >
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Link
                href={`/scholars/${comment.author.id}`}
                className="text-xs font-bold text-slate-900 hover:underline hover:text-blue-600 dark:text-slate-50 dark:hover:text-blue-300 md:text-sm"
              >
                {comment.author.name}
              </Link>
              {postAuthorId && comment.author.id === postAuthorId && (
                <span className="inline-flex items-center rounded-md bg-blue-100 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 md:text-[10px]">
                  Author
                </span>
              )}
            </div>
            <span
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
            <form action={handleEditSuccess}>
              <input type="hidden" name="_commentId" value={comment.id} />
              <input type="hidden" name="_type" value={type} />
              <textarea
                name="content"
                defaultValue={comment.content}
                required
                rows={2}
                className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800 outline-none transition focus:bg-white focus:ring-2 focus:ring-blue-600 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:bg-slate-900"
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
              <p className="wrap-break-word whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-300 md:text-sm">
                {comment.content}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                {wasEdited && (
                  <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                    {`Edited ${formatTimeAgo(comment.updatedAt)}`}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-2 md:gap-3">
                  <CommentActionsDropdown
                    isOwner={isOwner}
                    onEdit={() => setEditingId(comment.id)}
                    onDelete={() => deleteFormRef.current?.requestSubmit()}
                  />
                  <form
                    ref={deleteFormRef}
                    action={handleDeleteComment}
                    className="hidden"
                  >
                    <input type="hidden" name="_commentId" value={comment.id} />
                    <input type="hidden" name="_type" value={type} />
                    <button type="submit" />
                  </form>
                  <CommentVoteButton
                    commentId={comment.id}
                    type={type}
                    initialUpvotes={
                      comment.votes?.filter((v: any) => v.voteType === "UPVOTE")
                        .length ?? 0
                    }
                    initialDownvotes={
                      comment.votes?.filter(
                        (v: any) => v.voteType === "DOWNVOTE",
                      ).length ?? 0
                    }
                    initialUserVote={
                      (comment.votes?.find(
                        (v: any) => v.userId === currentUserId,
                      )?.voteType as "UPVOTE" | "DOWNVOTE" | null) ?? null
                    }
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {!isReply && (
          <>
            <button
              onClick={() =>
                setActiveReplyId(
                  activeReplyId === comment.id ? null : comment.id,
                )
              }
              className="ml-2 mt-2 text-[11px] font-bold text-slate-500 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300 md:text-xs"
            >
              Reply
            </button>
            {activeReplyId === comment.id && (
              <form
                className="mt-2 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 md:mt-3 md:flex-row md:gap-3"
                action={handleReplySuccess}
              >
                <input type="hidden" name="_targetId" value={targetId} />
                <input type="hidden" name="_type" value={type} />
                <input type="hidden" name="_parentId" value={comment.id} />
                <textarea
                  name="content"
                  placeholder={`Reply to ${comment.author.name}...`}
                  required
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-600 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:bg-slate-900 md:p-3 md:text-sm"
                />
                <SubmitBtnWithAuth className="sb-button-primary w-full justify-center px-3 py-1.5 text-xs font-bold md:w-auto md:px-5 md:py-2.5 md:text-sm">
                  Send
                </SubmitBtnWithAuth>
              </form>
            )}
          </>
        )}

        {replies && replies.length > 0 && (
          <div className="mt-2 space-y-2 border-l-2 border-slate-100 pl-2 dark:border-slate-800 md:mt-4 md:space-y-4 md:pl-4">
            {replies.map((reply) => (
              <CommentEntry
                key={reply.id}
                comment={{ ...reply, replies: [] }}
                currentUserId={currentUserId}
                type={type}
                targetId={targetId}
                postAuthorId={postAuthorId}
                activeReplyId={activeReplyId}
                setActiveReplyId={setActiveReplyId}
                editingId={editingId}
                setEditingId={setEditingId}
                isReply={true}
                toast={toast}
                openAuthModal={openAuthModal}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}