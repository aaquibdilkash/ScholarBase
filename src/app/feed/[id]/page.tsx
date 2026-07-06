import prisma from "@/lib/db";
import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { LikeButton } from "@/components/interactions/LikeButton";
import { CommentSection } from "@/components/interactions/CommentSection";

export default async function SinglePostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch the post deeply to include top-level comments and their nested replies
  const post = await prisma.socialPost.findUnique({
    where: { id },
    include: {
      author: true,
      likes: true,
      comments: {
        where: { parentId: null }, // Only fetch top-level comments first
        include: {
          author: true,
          replies: {               // Fetch the nested replies
            include: { author: true },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!post) notFound();

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    }).format(date);
  };

  return (
    <main className="max-w-2xl mx-auto py-8 px-4">
      {/* Back to Feed Navigation */}
      <Link 
        href="/feed" 
        className="inline-flex items-center text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors mb-8"
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Feed
      </Link>

      <article className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-8">
        {/* Post Author Header (Clickable) */}
        <div className="flex items-center gap-4 mb-6">
          <Link href={`/scholar/${post.authorId}`} className="shrink-0">
            <div className="w-14 h-14 rounded-full bg-slate-100 border flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-blue-100 transition">
              {post.author.avatarUrl ? (
                <img src={post.author.avatarUrl} alt="Author" className="w-full h-full object-cover" />
              ) : (
                <span className="font-bold text-slate-400 text-xl">
                  {post.author.name?.charAt(0).toUpperCase() || "?"}
                </span>
              )}
            </div>
          </Link>
          
          <div>
            <Link href={`/scholar/${post.authorId}`} className="font-bold text-lg text-slate-900 hover:text-blue-600 hover:underline transition">
              {post.author.name}
            </Link>
            <div className="text-sm text-slate-500 font-medium mt-0.5">
              {post.author.handle && <span className="mr-2">@{post.author.handle}</span>}
              <span>{formatDate(post.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Post Content */}
        <p className="text-slate-800 text-xl leading-relaxed whitespace-pre-wrap mb-8">
          {post.content}
        </p>

        {/* Likes and Interactions */}
        <div className="pt-4 border-t border-slate-100 flex items-center gap-6">
          <LikeButton
            targetId={post.id}
            type="post"
            initialLikes={post.likes.length}
          />
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            {post.comments.length} Comments
          </div>
        </div>
      </article>

      {/* The Upgraded Comment Section */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-xl text-slate-900 mb-6">Discussion</h3>
        <CommentSection
          comments={post.comments}
          targetId={post.id}
          type="post"
        />
      </div>
    </main>
  );
}