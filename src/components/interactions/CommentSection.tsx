"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import { formatTimeAgo } from "@/utils/time-ago";
import { getScholars } from "@/app/actions/scholars";
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
import {
  CommentItem,
  CommentTargetType,
} from "@/types/comment";

type MentionUser = { id: string; handle: string | null };
type RenderableCommentItem = Omit<CommentItem, "mentions"> & {
  mentions?: unknown;
  replies?: RenderableCommentItem[];
};

interface CommentSectionProps {
  comments: RenderableCommentItem[];
  targetId: string;
  type: CommentTargetType;
  currentUserId: string | null;
  postAuthorId?: string | null;
}

type ScholarSuggestion = Awaited<ReturnType<typeof getScholars>>[number];



function MentionComposer({
  name,
  value,
  onChange,
  placeholder,
  mentionedUsers,
  onMentionedUsersChange,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  mentionedUsers: MentionUser[];
  onMentionedUsersChange: (users: MentionUser[]) => void;
}) {
  const [suggestions, setSuggestions] = useState<ScholarSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const match = value.match(/(?:^|\s)@([a-z0-9_]{1,})$/i);
    const term = match?.[1] ?? "";
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }
    const handle = window.setTimeout(() => {
      getScholars(term).then((users) => setSuggestions(users.slice(0, 5)));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [value]);

  const insertSuggestion = (user: ScholarSuggestion) => {
    const trimmed = value.replace(/(?:^|\s)@([a-z0-9_]{1,})$/i, ` @${user.handle || user.name || "scholar"} `);
    onChange(trimmed.replace(/^ /, ""));
    setSuggestions([]);
    setActiveIndex(0);
    if (!mentionedUsers.find(u => u.id === user.id)) {
        onMentionedUsersChange([...mentionedUsers, { id: user.id, handle: user.handle ?? null }]);
    }
  };

  return (
    <div className="relative">
      <textarea
        name={name}
        placeholder={placeholder}
        required
        rows={2}
        className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 outline-none transition focus:bg-white focus:ring-2 focus:ring-blue-600 md:p-4 md:text-base dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:bg-slate-900"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (!suggestions.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((current) => (current + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            insertSuggestion(suggestions[activeIndex]);
          } else if (e.key === "Escape") {
            setSuggestions([]);
          }
        }}
      />
      {suggestions.length > 0 && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
          {suggestions.map((user, index) => (
            <button
              key={user.id}
              type="button"
              onClick={() => insertSuggestion(user)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${index === activeIndex ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-900"}`}
            >
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-slate-950 text-xs font-semibold text-white dark:bg-slate-800">
                {user.avatarUrl ? (
                  <Image src={user.avatarUrl} alt="" width={36} height={36} unoptimized className="h-full w-full object-cover" />
                ) : (
                  user.name?.charAt(0).toUpperCase() || "@"
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {user.name || "Scholar"}
                </span>
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                  @{user.handle || "scholar"}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="mt-2 rounded-xl border border-dashed border-slate-200 bg-white/70 p-3 text-sm leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
        {renderCommentContent(value || placeholder, mentionedUsers)}
      </div>
    </div>
  );
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
  const queryClient = useQueryClient();
  const commentsQueryKey = ["comments", type, targetId];
  const draftKey = `draft_comment_${type}_${targetId}`;
  const [content, setContent] = useState("");
  const [mentionedUsers, setMentionedUsers] = useState<MentionUser[]>([]);

  const { data: cachedComments = [] } = useQuery({
    queryKey: commentsQueryKey,
    queryFn: async () => comments,
    initialData: comments,
  });

  const topLevelComments = cachedComments.filter((c) => !c.parentId);

  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        const { content: savedContent, mentionedUsers: savedMentionedUsers } = JSON.parse(savedDraft);
        setContent(savedContent || '');
        setMentionedUsers(savedMentionedUsers || []);
      }
    } catch (error) {
      console.error("Failed to read draft from localStorage", error);
    }
  }, [draftKey]);

  const handleContentChange = (value: string) => {
    const currentMentions = mentionedUsers.filter(u => value.includes(`@${u.handle}`));
    if (currentMentions.length !== mentionedUsers.length) {
        setMentionedUsers(currentMentions);
    }
    setContent(value);
    try {
      const draft = JSON.stringify({ content: value, mentionedUsers: currentMentions });
      localStorage.setItem(draftKey, draft);
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
    formData.set("content", content);
    formData.set("mentions", JSON.stringify(mentionedUsers.map(u => ({id: u.id, handle: u.handle}))));

    try {
      const response = await createCommentClientWrapper(formData);
      if (!response?.success || !response.data) {
        toast("Failed to post comment. Please try again.", "error");
        return;
      }
      queryClient.setQueryData<RenderableCommentItem[]>(
        commentsQueryKey,
        (oldComments = []) => [response.data, ...oldComments],
      );
      if (type === "post") {
        queryClient.setQueriesData<{ id: string; _count: { comments: number } }[]>(
          { queryKey: ["feed"] },
          (oldPosts = []) =>
            oldPosts.map((post) =>
              post.id === targetId
                ? {
                    ...post,
                    _count: {
                      ...post._count,
                      comments: post._count.comments + 1,
                    },
                  }
                : post,
            ),
        );
      }
      toast("Comment posted successfully!", "success");
      setContent("");
      setMentionedUsers([]);
      localStorage.removeItem(draftKey);
    } catch (error) {
      toast("Failed to post comment. Please try again.", "error");
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
        <form
          onSubmit={handleFormSubmit}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <input type="hidden" name="_targetId" value={targetId} />
          <input type="hidden" name="_type" value={type} />
          <input type="hidden" name="_parentId" value="" />
          <input type="hidden" name="_commentId" value="" />

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
              onReplyCreated={(reply) => {
                queryClient.setQueryData<RenderableCommentItem[]>(
                  commentsQueryKey,
                  (oldComments = []) =>
                    oldComments.map((item) =>
                      item.id === reply.parentId
                        ? {
                            ...item,
                            replies: [...(item.replies ?? []), reply],
                          }
                        : item,
                    ),
                );
                if (type === "post") {
                  queryClient.setQueriesData<
                    { id: string; _count: { comments: number } }[]
                  >({ queryKey: ["feed"] }, (oldPosts = []) =>
                    oldPosts.map((post) =>
                      post.id === targetId
                        ? {
                            ...post,
                            _count: {
                              ...post._count,
                              comments: post._count.comments + 1,
                            },
                          }
                        : post,
                    ),
                  );
                }
              }}
              onDeleted={(deleted) => {
                queryClient.setQueryData<RenderableCommentItem[]>(
                  commentsQueryKey,
                  (oldComments = []) =>
                    deleted.parentId
                      ? oldComments.map((item) =>
                          item.id === deleted.parentId
                            ? {
                                ...item,
                                replies: (item.replies ?? []).filter(
                                  (reply) => reply.id !== deleted.id,
                                ),
                              }
                            : item,
                        )
                      : oldComments.filter((item) => item.id !== deleted.id),
                );
                if (type === "post") {
                  queryClient.setQueriesData<
                    { id: string; _count: { comments: number } }[]
                  >({ queryKey: ["feed"] }, (oldPosts = []) =>
                    oldPosts.map((post) =>
                      post.id === targetId
                        ? {
                            ...post,
                            _count: {
                              ...post._count,
                              comments: Math.max(0, post._count.comments - 1),
                            },
                          }
                        : post,
                    ),
                  );
                }
              }}
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
    </div>
  );
}

function renderCommentContent(content: string, mentions: unknown) {
    const typedMentions = Array.isArray(mentions) ? mentions as MentionUser[] : null;
    const parts = content.split(/(@[a-z0-9_]+)/gi);

    if (!typedMentions || typedMentions.length === 0) {
        return parts.map((part, index) => <span key={index}>{part}</span>);
    }

    const mentionMap = new Map(typedMentions.filter(m => m.handle).map(m => [m.handle!, m.id]));

    return parts.map((part, index) => {
        if (part.startsWith('@')) {
            const handle = part.substring(1);
            const mentionId = mentionMap.get(handle);
            if (mentionId) {
                return (
                    <Link key={index} href={`/scholars/${mentionId}`} className="font-semibold text-blue-600 hover:underline dark:text-blue-400 dark:hover:text-blue-300">
                        {part}
                    </Link>
                );
            }
        }
        return <span key={index}>{part}</span>;
    });
}

function ReplyForm({
  targetId,
  type,
  parentComment,
  onSuccess,
  toast,
}: {
  targetId: string;
  type: CommentTargetType;
  parentComment: RenderableCommentItem;
  onSuccess: (reply: RenderableCommentItem) => void;
  toast: (message: string, type?: "success" | "error") => void;
}) {
  const draftKey = `draft_reply_${type}_${targetId}_${parentComment.id}`;
  const [reply, setReply] = useState("");
  const [mentionedUsers, setMentionedUsers] = useState<MentionUser[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const { content: savedContent, mentionedUsers: savedMentionedUsers } = JSON.parse(saved);
        setReply(savedContent || '');
        setMentionedUsers(savedMentionedUsers || []);
      }
    } catch (error) {
      console.error("Failed to read reply draft from localStorage", error);
    }
  }, [draftKey]);

  const handleReplyChange = (value: string) => {
    const currentMentions = mentionedUsers.filter(u => value.includes(`@${u.handle}`));
    if (currentMentions.length !== mentionedUsers.length) {
        setMentionedUsers(currentMentions);
    }
    setReply(value);
    try {
      const draft = JSON.stringify({ content: value, mentionedUsers: currentMentions });
      localStorage.setItem(draftKey, draft);
    } catch (error) {
      console.error("Failed to save reply draft to localStorage", error);
    }
  };

  const handleReplySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("content", reply);
    formData.set("mentions", JSON.stringify(mentionedUsers.map(u => ({id: u.id, handle: u.handle}))));
    try {
      const response = await createCommentClientWrapper(formData);
      if (!response?.success || !response.data) {
        toast("Failed to post reply. Please try again.", "error");
        return;
      }
      toast("Reply posted successfully!", "success");
      setReply("");
      setMentionedUsers([]);
      localStorage.removeItem(draftKey);
      onSuccess(response.data);
    } catch (error) {
      toast("Failed to post reply. Please try again.", "error");
      console.error(error);
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleReplySubmit}
      className="mt-2 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 md:mt-3"
    >
      <input type="hidden" name="_targetId" value={targetId} />
      <input type="hidden" name="_type" value={type} />
      <input type="hidden" name="_parentId" value={parentComment.id} />
      <div className="flex-1">
        <MentionComposer
          name="content"
          value={reply}
          onChange={handleReplyChange}
          placeholder={`Reply to ${parentComment.author.name}...type @ to mention a scholar`}
          mentionedUsers={mentionedUsers}
          onMentionedUsersChange={setMentionedUsers}
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
  onReplyCreated,
  onDeleted,
}: {
  comment: RenderableCommentItem;
  replies?: RenderableCommentItem[];
  currentUserId: string | null;
  type: CommentTargetType;
  targetId: string;
  postAuthorId?: string | null;
  activeReplyId: string | null;
  setActiveReplyId: (id: string | null) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  isReply: boolean;
  toast: (message: string, type?: "success" | "error") => void;
  onReplyCreated: (reply: RenderableCommentItem) => void;
  onDeleted: (deleted: { id: string; parentId: string | null }) => void;
}) {
  const deleteFormRef = useRef<HTMLFormElement>(null);
  const isOwner = !!currentUserId && comment.author.id === currentUserId;
  const wasEdited =
    new Date(comment.updatedAt).getTime() -
      new Date(comment.createdAt).getTime() >
    1000;

  const [editedContent, setEditedContent] = useState(comment.content);
  const [editedMentions, setEditedMentions] = useState<MentionUser[]>(
    Array.isArray(comment.mentions) ? (comment.mentions as MentionUser[]) : [],
  );

  const queryClient = useQueryClient();
  const commentsQueryKey = ["comments", type, targetId];

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("content", editedContent);
    formData.set("mentions", JSON.stringify(editedMentions.map(m => ({id: m.id, handle: m.handle}))));
    try {
      const response = await editCommentClientWrapper(formData);
      if (!response?.success || !response.data) {
        toast("Failed to update comment. Please try again.", "error");
        return;
      }
      const updatedComment = response.data as RenderableCommentItem;
      queryClient.setQueryData<RenderableCommentItem[]>(
        commentsQueryKey,
        (oldComments = []) => {
          const updateCommentRecursive = (comments: RenderableCommentItem[]): RenderableCommentItem[] => {
            return comments.map(c => {
              if (c.id === updatedComment.id) {
                return { ...c, ...updatedComment };
              }
              if (c.replies) {
                return { ...c, replies: updateCommentRecursive(c.replies) };
              }
              return c;
            });
          };
          return updateCommentRecursive(oldComments);
        }
      );
      toast("Comment updated!", "success");
      setEditingId(null);
    } catch {
      toast("Failed to update comment. Please try again.", "error");
    }
  };

  const handleDeleteComment = async (formData: FormData) => {
    try {
      const response = await deleteCommentClientWrapper(formData);
      if (response?.success && response.data) {
        onDeleted({
          id: response.data.id,
          parentId: response.data.parentId ?? null,
        });
      }
      toast("Comment deleted.", "success");
    } catch {
      toast("Failed to delete comment. Please try again.", "error");
    }
  };

  return (
    <div className="group flex gap-1 md:gap-2">
      <Link href={`/scholars/${comment.author.id}`} className="shrink-0 pt-1">
        <div
          className={`overflow-hidden rounded-full border bg-slate-100 transition hover:ring-2 hover:ring-blue-200 dark:border-slate-800 dark:bg-slate-900 ${
            isReply ? "h-10 w-10" : "h-11 w-11 md:h-12 md:w-12"
          }`}
        >
          {comment.author.avatarUrl ? (
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
                isReply ? "text-xs md:text-sm" : "text-sm md:text-base"
              }`}
            >
              {comment.author.name?.charAt(0).toUpperCase() || "?"}
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
                  href={`/scholars/${comment.author.id}`}
                  className="truncate text-xs font-bold text-slate-900 hover:text-blue-600 hover:underline dark:text-slate-50 dark:hover:text-blue-300 md:text-sm"
                >
                  {comment.author.name || "Scholar"}
                </Link>
                {postAuthorId && comment.author.id === postAuthorId && (
                  <span className="inline-flex items-center rounded-md bg-blue-100 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 md:text-[10px]">
                    Author
                  </span>
                )}
              </div>
              {comment.author.handle ? (
                <Link
                  href={`/scholars/${comment.author.id}`}
                  className="mt-0.5 block truncate text-[11px] font-medium text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300 md:text-xs"
                >
                  @{comment.author.handle}
                </Link>
              ) : null}
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
            <form onSubmit={handleEditSubmit}>
              <input type="hidden" name="_commentId" value={comment.id} />
              <input type="hidden" name="_type" value={type} />
              <MentionComposer
                name="content"
                value={editedContent}
                onChange={setEditedContent}
                placeholder="Update your comment..."
                mentionedUsers={editedMentions}
                onMentionedUsersChange={setEditedMentions}
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
                {renderCommentContent(comment.content, comment.mentions)}
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
                      comment.votes?.filter((v) => v.voteType === "UPVOTE")
                        .length ?? 0
                    }
                    initialDownvotes={
                      comment.votes?.filter((v) => v.voteType === "DOWNVOTE")
                        .length ?? 0
                    }
                    initialUserVote={
                      (comment.votes?.find((v) => v.userId === currentUserId)
                        ?.voteType as "UPVOTE" | "DOWNVOTE" | null) ?? null
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
              <ReplyForm
                targetId={targetId}
                type={type}
                parentComment={comment}
                onSuccess={(reply) => {
                  onReplyCreated(reply);
                  setActiveReplyId(null);
                }}
                toast={toast}
              />
            )}
          </>
        )}

        {replies && replies.length > 0 && (
          <div className="mt-2 space-y-2 border-l-2 border-slate-100 pl-2 dark:border-slate-800 md:mt-4 md:space-y-4 md:pl-4">
            {replies.map((reply) => (
              <CommentEntry
                key={reply.id}
                comment={reply}
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
                onReplyCreated={onReplyCreated}
                onDeleted={onDeleted}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
