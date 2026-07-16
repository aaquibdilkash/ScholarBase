"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createCommentClientWrapper } from "@/app/actions/comments.clientWrappers";

import {
  deleteCommentClientWrapper,
  editCommentClientWrapper,
} from "@/app/actions/comments.clientWrappers";
import { CommentLikeButton } from "@/components/interactions/CommentLikeButton";

// Define the exact shape Prisma is sending down
type User = { id: string; name: string | null; avatarUrl: string | null };
type Like = { userId: string };

type Reply = {
  id: string;
  content: string;
  createdAt: Date;
  author: User;
  likes: Like[];
  parentId: string | null;
  _count: { likes: number };
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
    | "journal";
  currentUserId: string | null;
}

export function CommentSection({
  comments,
  targetId,
  type,
  currentUserId,
}: CommentSectionProps) {
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const topLevelComments = comments.filter((comment) => !comment.parentId);

  return (
    <div className="space-y-8">
      {/* Form: Add a Top-Level Comment */}
      {currentUserId && (
        <form action={createCommentClientWrapper.bind(null)} className="flex gap-4">
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
              className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none transition resize-none text-slate-800 bg-slate-50 focus:bg-white"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition"
              >
                Post Comment
              </button>
            </div>
          </div>
        </form>
      )}

      {/* The Comment Thread */}
      <div className="space-y-6">
        {topLevelComments.map((comment) => (
          <div key={comment.id} className="flex gap-4 group">
            {/* Clickable Avatar for Parent Comment */}
            <Link
              href={`/scholar/${comment.author.id}`}
              className="shrink-0 pt-1"
            >
              <div className="w-10 h-10 rounded-full bg-slate-100 border overflow-hidden hover:ring-2 hover:ring-blue-200 transition">
                {comment.author.avatarUrl ? (
                  <Image
                    src={comment.author.avatarUrl}
                    alt="User"
                    width={40}
                    height={40}
                    unoptimized
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-bold text-slate-500 text-sm">
                    {comment.author.name?.charAt(0).toUpperCase() || "?"}
                  </div>
                )}
              </div>
            </Link>

            <div className="flex-1">
              {/* Parent Comment Bubble */}
              <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  {/* Clickable Name */}
                  <Link
                    href={`/scholar/${comment.author.id}`}
                    className="font-bold text-sm text-slate-900 hover:text-blue-600 hover:underline"
                  >
                    {comment.author.name}
                  </Link>
                  <span className="text-xs text-slate-400 font-medium">
                    {formatDate(comment.createdAt)}
                  </span>
                </div>

                {editingId === comment.id ? (
                  <form action={editCommentClientWrapper.bind(null)}>
                    <input type="hidden" name="_commentId" value={comment.id} />
                    <input type="hidden" name="_type" value={type} />

                    <textarea
                      name="content"
                      defaultValue={comment.content}
                      required
                      rows={2}
                      className="w-full p-3 mt-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none transition resize-none text-slate-800 bg-slate-50 focus:bg-white"
                    />
                    <div className="mt-3 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 text-sm rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 text-sm bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p className="text-slate-700 text-sm whitespace-pre-wrap">
                      {comment.content}
                    </p>

                    <div className="mt-3 flex items-center justify-end gap-3">
                      {currentUserId && comment.author.id === currentUserId && (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditingId(comment.id)}
                            className="text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors"
                          >
                            Edit
                          </button>

                          <form action={deleteCommentClientWrapper.bind(null)}>
                            <input
                              type="hidden"
                              name="_commentId"
                              value={comment.id}
                            />
                            <input type="hidden" name="_type" value={type} />
                            <button
                              type="submit"
                              className="text-xs font-bold text-red-600 hover:text-red-700 transition-colors"
                            >
                              Delete
                            </button>
                          </form>
                        </>
                      )}

                      <CommentLikeButton
                        commentId={comment.id}
                        type={type}
                        initialLikes={comment._count.likes}
                        initialIsLiked={comment.likes.length > 0}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Toggle Reply Box Button */}
              {currentUserId && (
                <button
                  onClick={() =>
                    setActiveReplyId(
                      activeReplyId === comment.id ? null : comment.id,
                    )
                  }
                  className="text-xs font-bold text-slate-500 hover:text-blue-600 mt-2 ml-2 transition-colors"
                >
                  Reply
                </button>
              )}

              {/* The Reply Input Box */}
              {currentUserId && activeReplyId === comment.id && (
                <form
                  className="mt-3 flex gap-3 animate-in fade-in slide-in-from-top-2"
                  action={createCommentClientWrapper.bind(null)}
                >
                  <input type="hidden" name="_targetId" value={targetId} />
                  <input type="hidden" name="_type" value={type} />
                  <input type="hidden" name="_parentId" value={comment.id} />
                  <textarea
                    name="content"
                    placeholder={`Reply to ${comment.author.name}...`}
                    required
                    rows={1}
                    className="flex-1 p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none text-sm resize-none bg-slate-50 focus:bg-white"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition"
                  >
                    Send
                  </button>
                </form>
              )}

              {/* Render Nested Replies */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="mt-4 space-y-4 border-l-2 border-slate-100 pl-4">
                  {comment.replies.map((reply) => (
                    <div key={reply.id} className="flex gap-3">
                      {/* Clickable Avatar for Reply */}
                      <Link
                        href={`/scholar/${reply.author.id}`}
                        className="shrink-0"
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-100 border overflow-hidden hover:ring-2 hover:ring-blue-200 transition">
                          {reply.author.avatarUrl ? (
                            <Image
                              src={reply.author.avatarUrl}
                              alt="User"
                              width={32}
                              height={32}
                              unoptimized
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-bold text-slate-500 text-xs">
                              {reply.author.name?.charAt(0).toUpperCase() ||
                                "?"}
                            </div>
                          )}
                        </div>
                      </Link>

                      <div className="flex-1 bg-slate-50 p-3 rounded-2xl rounded-tl-none border border-slate-100">
                        <div className="flex items-baseline justify-between gap-2 mb-1">
                          <Link
                            href={`/scholar/${reply.author.id}`}
                            className="font-bold text-sm text-slate-900 hover:text-blue-600 hover:underline"
                          >
                            {reply.author.name}
                          </Link>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {formatDate(reply.createdAt)}
                          </span>
                        </div>

                        {editingId === reply.id ? (
                          <form action={editCommentClientWrapper.bind(null)}>
                            <input
                              type="hidden"
                              name="_commentId"
                              value={reply.id}
                            />
                            <input type="hidden" name="_type" value={type} />

                            <textarea
                              name="content"
                              defaultValue={reply.content}
                              required
                              rows={2}
                              className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none transition resize-none text-slate-800 bg-slate-50 focus:bg-white"
                            />
                            <div className="mt-3 flex items-center justify-end gap-3">
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="px-3 py-1.5 text-sm rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="px-4 py-1.5 text-sm bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition"
                              >
                                Save
                              </button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <p className="text-slate-700 text-sm whitespace-pre-wrap">
                              {reply.content}
                            </p>

                            <div className="mt-3 flex items-center justify-end gap-3">
                              {currentUserId &&
                                reply.author.id === currentUserId && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setEditingId(reply.id)}
                                      className="text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors"
                                    >
                                      Edit
                                    </button>

                                    <form action={deleteCommentClientWrapper.bind(null)}>
                                      <input
                                        type="hidden"
                                        name="_commentId"
                                        value={reply.id}
                                      />
                                      <input
                                        type="hidden"
                                        name="_type"
                                        value={type}
                                      />
                                      <button
                                        type="submit"
                                        className="text-xs font-bold text-red-600 hover:text-red-700 transition-colors"
                                      >
                                        Delete
                                      </button>
                                    </form>
                                  </>
                                )}

                              <CommentLikeButton
                                commentId={reply.id}
                                type={type}
                                initialLikes={reply._count.likes}
                                initialIsLiked={reply.likes.length > 0}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {topLevelComments.length === 0 && (
          <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-slate-500 font-medium">
              No comments yet. Start the academic discussion!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
