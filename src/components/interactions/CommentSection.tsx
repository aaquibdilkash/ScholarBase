"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { createComment } from "@/app/actions/comments";

// Define the exact shape Prisma is sending down
type User = { id: string; name: string | null; avatarUrl: string | null };
type Reply = { id: string; content: string; createdAt: Date; author: User };
type Comment = Reply & { replies: Reply[] };

interface CommentSectionProps {
  comments: Comment[];
  targetId: string;
  type: "post" | "article";
}

export function CommentSection({
  comments,
  targetId,
  type,
}: CommentSectionProps) {
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const mainFormRef = useRef<HTMLFormElement>(null);

  // Wrapper for the main top-level comment
  const handleMainComment = async (formData: FormData) => {
    await createComment(formData, targetId, type);
    mainFormRef.current?.reset(); // Clear the text area after sending
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(date));
  };

  return (
    <div className="space-y-8">
      {/* Form: Add a Top-Level Comment */}
      <form ref={mainFormRef} action={handleMainComment} className="flex gap-4">
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

      {/* The Comment Thread */}
      <div className="space-y-6">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-4 group">
            {/* Clickable Avatar for Parent Comment */}
            <Link
              href={`/scholar/${comment.author.id}`}
              className="shrink-0 pt-1"
            >
              <div className="w-10 h-10 rounded-full bg-slate-100 border overflow-hidden hover:ring-2 hover:ring-blue-200 transition">
                {comment.author.avatarUrl ? (
                  <img
                    src={comment.author.avatarUrl}
                    alt="User"
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
                <p className="text-slate-700 text-sm whitespace-pre-wrap">
                  {comment.content}
                </p>
              </div>

              {/* Toggle Reply Box Button */}
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

              {/* The Reply Input Box (Only visible if active) */}
              {activeReplyId === comment.id && (
                <form
                  action={async (formData) => {
                    await createComment(formData, targetId, type, comment.id); // Pass parentId
                    setActiveReplyId(null); // Close the box
                  }}
                  className="mt-3 flex gap-3 animate-in fade-in slide-in-from-top-2"
                >
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
                            <img
                              src={reply.author.avatarUrl}
                              alt="User"
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
                          {/* Clickable Name for Reply */}
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
                        <p className="text-slate-700 text-sm whitespace-pre-wrap">
                          {reply.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {comments.length === 0 && (
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
