"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import { formatTimeAgo } from "@/utils/time-ago";
import { getScholars } from "@/app/actions/scholars";
import {
  createComment,
  deleteComment,
  editComment,
} from "@/app/actions/comments";

import CommentActionsDropdown from "@/components/interactions/CommentActionsDropdown";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { SubmitBtn } from "@/components/ui/SubmitBtn";
import { CommentVoteButton } from "@/components/interactions/CommentVoteButton";
import { useToast } from "@/components/ui/Toast";
import { useAuthModal } from "./AuthModal";
import { emitCommentCount, getCommentCount } from "@/lib/comment-count-store";
import type { CommentWithAuthorAndVotes, CommentEntityType } from "@/types/comments";

type MentionUser = { id: string; handle: string | null };

interface CommentSectionProps {
  comments: CommentWithAuthorAndVotes[];
  targetId: string;
  module: CommentEntityType;
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
    const trimmed = value.replace(
      /(?:^|\s)@([a-z0-9_]{1,})$/i,
      ` @${user.handle || user.name || "scholar"} `,
    );
    onChange(trimmed.replace(/^ /, ""));
    setSuggestions([]);
    setActiveIndex(0);
    if (!mentionedUsers.find((u) => u.id === user.id)) {
      onMentionedUsersChange([
        ...mentionedUsers,
        { id: user.id, handle: user.handle ?? null },
      ]);
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
            setActiveIndex(
              (current) =>
                (current - 1 + suggestions.length) % suggestions.length,
            );
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
                  <Image
                    src={user.avatarUrl}
                    alt=""
                    width={36}
                    height={36}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
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
  module,
  currentUserId,
  postAuthorId,
}: CommentSectionProps) {
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { openAuthModal } = useAuthModal();
  const queryClient = useQueryClient();
  const commentsQueryKey = ["comments", module, targetId];
  const draftKey = `draft_comment_${module}_${targetId}`;
  const [content, setContent] = useState("");
  const [mentionedUsers, setMentionedUsers] = useState<MentionUser[]>([]);

  const { data: cachedComments = [] } = useQuery({
    queryKey: commentsQueryKey,
    queryFn: async () => comments,
    initialData: comments,
  });

  const topLevelComments = cachedComments.filter((c) => !c.parentId);

  useEffect(() => {
    emitCommentCount(
      cachedComments.reduce((sum, c) => sum + 1 + (c.replies?.length ?? 0), 0),
    );
  }, [cachedComments]);

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
      const draft = JSON.stringify({
        content: value,
        mentionedUsers: currentMentions,
      });
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

    const formData = new FormData();
    formData.append('content', content);
    formData.append('mentions', JSON.stringify(mentionedUsers.map((u) => ({ id: u.id, handle: u.handle }))));

    try {
      const response = await createComment(formData, targetId, module);

      if (!response?.success || !response.data) {
        toast({ title: "Error", description: "Failed to post comment. Please try again.", variant: "destructive"});
        return;
      }
      const newComment = response.data as CommentWithAuthorAndVotes;
      queryClient.setQueryData<CommentWithAuthorAndVotes[]>(
        commentsQueryKey,
        (oldComments = []) => [newComment, ...oldComments],
      );
      queryClient.setQueriesData<{ totalComments?: number }>(
        { queryKey: [module, targetId] },
        (oldData: any) => {
          if (!oldData || typeof oldData !== 'object') return oldData;
          if (typeof oldData.totalComments === 'number') {
            return { ...oldData, totalComments: oldData.totalComments + 1 };
          }
          return oldData;
        },
      );
      queryClient.setQueriesData(
        { queryKey: ["feed"] },
        (oldData: any) => {
          if (!Array.isArray(oldData)) return oldData;
          return oldData.map((item: any) =>
            item.id === targetId && typeof item.totalComments === 'number'
              ? { ...item, totalComments: item.totalComments + 1 }
              : item,
          );
        },
      );

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

        <div className="space-y-4 md:space-y-6">
          {topLevelComments.map((comment) => (
            <CommentEntry
              key={comment.id}
              comment={comment}
              replies={comment.replies}
              currentUserId={currentUserId}
              module={module}
              targetId={targetId}
              postAuthorId={postAuthorId}
              activeReplyId={activeReplyId}
              setActiveReplyId={setActiveReplyId}
              editingId={editingId}
              setEditingId={setEditingId}
              isReply={false}
              toast={(...args) => toast(...args)}
              commentsQueryKey={commentsQueryKey}
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
  const typedMentions = Array.isArray(mentions)
    ? (mentions as MentionUser[])
    : null;
  const parts = content.split(/(@[a-z0-9_]+)/gi);

  if (!typedMentions || typedMentions.length === 0) {
    return parts.map((part, index) => <span key={index}>{part}</span>);
  }

  const mentionMap = new Map(
    typedMentions.filter((m) => m.handle).map((m) => [m.handle!, m.id]),
  );

  return parts.map((part, index) => {
    if (part.startsWith("@")) {
      const handle = part.substring(1);
      const mentionId = mentionMap.get(handle);
      if (mentionId) {
        return (
          <Link
            key={index}
            href={`/scholars/${mentionId}`}
            className="font-semibold text-blue-600 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
          >
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
  module,
  parentComment,
  onSuccess,
  toast,
}: {
  targetId: string;
  module: CommentEntityType;
  parentComment: CommentWithAuthorAndVotes;
  onSuccess: (reply: CommentWithAuthorAndVotes) => void;
  toast: (options: { title: string, description: string, variant?: "default" | "destructive" }) => void;
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
    formData.append('content', reply);
    formData.append('mentions', JSON.stringify(mentionedUsers.map((u) => ({ id: u.id, handle: u.handle }))));

    try {
      const response = await createComment(formData, targetId, module, parentComment.id);

      if (!response?.success || !response.data) {
        toast({ title: "Error", description: "Failed to post reply. Please try again.", variant: "destructive"});
        return;
      }
      toast({ title: "Success", description: "Reply posted successfully!" });
      setReply("");
      setMentionedUsers([]);
      localStorage.removeItem(draftKey);
      onSuccess(response.data as CommentWithAuthorAndVotes);
    } catch (error) {
      toast({ title: "Error", description: "Failed to post reply. Please try again.", variant: "destructive"});
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
  module,
  targetId,
  postAuthorId,
  activeReplyId,
  setActiveReplyId,
  editingId,
  setEditingId,
  isReply,
  toast,
  commentsQueryKey,
}: {
  comment: CommentWithAuthorAndVotes;
  replies?: CommentWithAuthorAndVotes[];
  currentUserId: string | null;
  module: CommentEntityType;
  targetId: string;
  postAuthorId?: string | null;
  activeReplyId: string | null;
  setActiveReplyId: (id: string | null) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  isReply: boolean;
  toast: (options: { title: string, description: string, variant?: "default" | "destructive" }) => void;
  commentsQueryKey: unknown[];
}) {
  const isOwner = !!currentUserId && comment.author?.id === currentUserId;
  const wasEdited =
    comment.editedAt != null &&
    new Date(comment.editedAt).getTime() -
      new Date(comment.createdAt).getTime() >
    1000;
  
  const isTombstone = !comment.authorId || !comment.author;

  const [editedContent, setEditedContent] = useState(comment.content);
  const [editedMentions, setEditedMentions] = useState<MentionUser[]>(
    Array.isArray(comment.mentions) ? (comment.mentions as MentionUser[]) : [],
  );

  const queryClient = useQueryClient();

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('content', editedContent);
    formData.append('mentions', JSON.stringify(editedMentions.map((m) => ({ id: m.id, handle: m.handle }))));

    try {
      const response = await editComment(formData, comment.id, module);
      if (!response?.success || !response.data) {
        toast({ title: "Error", description: "Failed to update comment. Please try again.", variant: "destructive"});
        return;
      }
      
      queryClient.setQueryData<CommentWithAuthorAndVotes[]>(
        commentsQueryKey,
        (oldComments = []) =>
          oldComments.map((c) =>
            c.id === comment.id
              ? { ...c, content: response.data.content, editedAt: response.data.editedAt }
              : c,
          ),
      );
      toast({ title: "Success", description: "Comment updated!" });
      setEditingId(null);
    } catch {
      toast({ title: "Error", description: "Failed to update comment. Please try again.", variant: "destructive"});
    }
  };

  const handleDeleteComment = async () => {
    try {
      const response = await deleteComment(comment.id, module);
      if (response?.success) {
        let newCount = getCommentCount();
        
        if (response.data.wasTombstoned) {
          queryClient.setQueryData<CommentWithAuthorAndVotes[]>(
            commentsQueryKey,
            (oldComments = []) => {
              const result = isReply
                ? oldComments.map((c) => {
                    if (c.id !== comment.parentId) return c;
                    return {
                      ...c,
                      replies: (c.replies ?? []).map((r) =>
                        r.id === comment.id
                          ? { ...r, content: '[This comment was deleted by author]', authorId: null, author: null }
                          : r,
                      ),
                    };
                  })
                : oldComments.map((c) =>
                    c.id === comment.id
                      ? { ...c, content: '[This comment was deleted by author]', authorId: null, author: null }
                      : c,
                  );
              newCount = result.reduce((sum, c) => sum + 1 + (c.replies?.length ?? 0), 0);
              return result;
            },
          );
          queryClient.setQueriesData<{ totalComments?: number }>(
            { queryKey: [module, targetId] },
            (oldData: any) => {
              if (!oldData || typeof oldData !== 'object') return oldData;
              return { ...oldData, totalComments: newCount };
            },
          );
          queryClient.setQueriesData(
            { queryKey: ["feed"] },
            (oldData: any) => {
              if (!Array.isArray(oldData)) return oldData;
              return oldData.map((item: any) =>
                item.id === targetId && typeof item.totalComments === 'number'
                  ? { ...item, totalComments: newCount }
                  : item,
              );
            },
          );
        } else {
          queryClient.setQueryData<CommentWithAuthorAndVotes[]>(
            commentsQueryKey,
            (oldComments = []) => {
              if (isReply) {
                const result = oldComments.reduce<CommentWithAuthorAndVotes[]>((acc, c) => {
                  if (c.id !== comment.parentId) {
                    acc.push(c);
                    return acc;
                  }
                  const updatedReplies = (c.replies ?? []).filter((r) => r.id !== comment.id);
                  const updatedTotalReplies = Math.max(0, (c.totalReplies ?? 0) - 1);
                  if (!c.authorId && updatedReplies.length === 0) {
                    return acc;
                  }
                  acc.push({
                    ...c,
                    replies: updatedReplies,
                    totalReplies: updatedTotalReplies,
                  });
                  return acc;
                }, []);
                newCount = result.reduce((sum, c) => sum + 1 + (c.replies?.length ?? 0), 0);
                return result;
              }
              const result = oldComments.filter((c) => c.id !== comment.id);
              newCount = result.reduce((sum, c) => sum + 1 + (c.replies?.length ?? 0), 0);
              return result;
            },
          );
          queryClient.setQueriesData<{ totalComments?: number }>(
            { queryKey: [module, targetId] },
            (oldData: any) => {
              if (!oldData || typeof oldData !== 'object') return oldData;
              return { ...oldData, totalComments: newCount };
            },
          );
          queryClient.setQueriesData(
            { queryKey: ["feed"] },
            (oldData: any) => {
              if (!Array.isArray(oldData)) return oldData;
              return oldData.map((item: any) =>
                item.id === targetId && typeof item.totalComments === 'number'
                  ? { ...item, totalComments: newCount }
                  : item,
              );
            },
          );
        }
        
        emitCommentCount(Math.max(0, newCount));
        toast({ title: "Success", description: "Comment Deleted!" });
      } else {
        throw new Error("Unknown error");
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to delete comment. Please try again.";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  if (isTombstone) {
    return (
        <div className="group flex gap-1 md:gap-2">
            <div className="shrink-0 pt-1">
                <div className={`overflow-hidden rounded-full border bg-slate-100 dark:border-slate-800 dark:bg-slate-900 ${isReply ? "h-10 w-10" : "h-11 w-11 md:h-12 md:w-12"}`}>
                    <div className={`flex h-full w-full items-center justify-center font-bold text-slate-500 dark:text-slate-300 ${isReply ? "text-xs md:text-sm" : "text-sm md:text-base"}`}>?</div>
                </div>
            </div>
            <div className="min-w-0 flex-1">
                <div className={`rounded-2xl rounded-tl-none border p-2.5 md:p-3 ${isReply ? "border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70" : "border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/75"}`}>
                    <p className="italic text-xs text-slate-500 mt-2 dark:text-slate-400 md:text-sm">{comment.content}</p>
                </div>
                {replies && replies.length > 0 && (
                  <div className="mt-2 space-y-2 border-l-2 border-slate-100 pl-2 dark:border-slate-800 md:mt-4 md:space-y-4 md:pl-4">
                    {replies.map((reply) => (
                      <CommentEntry
                        key={reply.id}
                        comment={reply}
                        replies={reply.replies}
                        currentUserId={currentUserId}
                        module={module}
                        targetId={targetId}
                        postAuthorId={postAuthorId}
                        activeReplyId={activeReplyId}
                        setActiveReplyId={setActiveReplyId}
                        editingId={editingId}
                        setEditingId={setEditingId}
                        isReply={true}
                        toast={toast}
                        commentsQueryKey={commentsQueryKey}
                      />
                    ))}
                  </div>
                )}
            </div>
        </div>
    )
  }

  return (
    <div className="group flex gap-1 md:gap-2">
      <Link href={`/scholars/${comment.author?.id ?? '#'}`} className="shrink-0 pt-1">
        <div
          className={`overflow-hidden rounded-full border bg-slate-100 transition hover:ring-2 hover:ring-blue-200 dark:border-slate-800 dark:bg-slate-900 ${
            isReply ? "h-10 w-10" : "h-11 w-11 md:h-12 md:w-12"
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
                isReply ? "text-xs md:text-sm" : "text-sm md:text-base"
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
                  href={`/scholars/${comment.author?.id ?? '#'}`}
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
                  href={`/scholars/${comment.author?.id ?? '#'}`}
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
                  <span suppressHydrationWarning className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                    {`Edited ${formatTimeAgo(comment.editedAt)}`}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-2 md:gap-3">
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
                </div>
              </div>
            </>
          )}
        </div>

        {!isReply && !isTombstone && (
          <>
            <button
              onClick={() =>
                setActiveReplyId(
                  activeReplyId === comment.id ? null : comment.id,
                )
              }
              className="ml-2 mt-2 text-[11px] font-bold text-slate-500 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300 md:text-xs"
            >
                  Reply ({comment.totalReplies ?? 0})
            </button>
            {activeReplyId === comment.id && (
              <ReplyForm
                targetId={targetId}
                module={module}
                parentComment={comment}
                onSuccess={(reply) => {
                  queryClient.setQueryData<CommentWithAuthorAndVotes[]>(
                    commentsQueryKey,
                    (oldComments = []) =>
                      oldComments.map((c) =>
                        c.id === reply.parentId
                          ? { ...c, replies: [...(c.replies ?? []), reply], totalReplies: (c.totalReplies ?? 0) + 1 }
                          : c,
                      ),
                  );
                  queryClient.setQueriesData<{ totalComments?: number }>(
                    { queryKey: [module, targetId] },
                    (oldData: any) => {
                      if (!oldData || typeof oldData !== 'object') return oldData;
                      if (typeof oldData.totalComments === 'number') {
                        return { ...oldData, totalComments: oldData.totalComments + 1 };
                      }
                      return oldData;
                    },
                  );
                  queryClient.setQueriesData(
                    { queryKey: ["feed"] },
                    (oldData: any) => {
                      if (!Array.isArray(oldData)) return oldData;
                      return oldData.map((item: any) =>
                        item.id === targetId && typeof item.totalComments === 'number'
                          ? { ...item, totalComments: item.totalComments + 1 }
                          : item,
                      );
                    },
                  );
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
                replies={reply.replies}
                currentUserId={currentUserId}
                module={module}
                targetId={targetId}
                postAuthorId={postAuthorId}
                activeReplyId={activeReplyId}
                setActiveReplyId={setActiveReplyId}
                editingId={editingId}
                setEditingId={setEditingId}
                isReply={true}
                toast={toast}
                commentsQueryKey={commentsQueryKey}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
