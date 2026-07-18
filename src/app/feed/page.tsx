import { createSocialPost } from "@/app/actions/feed";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import Link from "next/link";

import { getTrendingSocialPosts } from "@/lib/trending";
import { TrendingList } from "@/components/feed/TrendingList";
import { SocialPostCard } from "@/components/feed/SocialPostCard";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const { tab, q } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const isFollowingTab = tab === "following";
  const isTrendingTab = tab === "trending";
  const hasQuery = Boolean(q && q.trim().length > 0);
  let followingIds: string[] = [];

  // If on the following tab, get the IDs first
  if (isFollowingTab) {
    const following = await prisma.follows.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    });
    followingIds = following.map((f) => f.followingId);
  }

  const posts = isTrendingTab
    ? []
    : await prisma.socialPost.findMany({
        where: {
          ...(isFollowingTab ? { authorId: { in: followingIds } } : {}),
          ...(hasQuery
            ? {
                OR: [
                  {
                    content: {
                      contains: q,
                      mode: "insensitive",
                    },
                  },
                  {
                    author: {
                      name: {
                        contains: q,
                        mode: "insensitive",
                      },
                    },
                  },
                  {
                    author: {
                      handle: {
                        contains: q,
                        mode: "insensitive",
                      },
                    },
                  },
                ],
              }
            : {}),
        },
        include: {
          author: true,
          likes: true,
          _count: {
            select: { comments: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

  const trendingItems = (isTrendingTab
    ? await getTrendingSocialPosts(user.id)
    : []) as unknown as import("@/types/trending").TrendingItem[];

  const userLikes = new Set(
    posts
      .flatMap((p) => p.likes)
      .filter((l) => l.userId === user.id)
      .map((l) => l.socialPostId),
  );

  return (
    <main className="mx-auto max-w-3xl py-6">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Scholar Feed
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Short research updates from the community.
          </p>
        </div>
      </div>

      <div className="mb-8 inline-flex rounded-2xl border border-slate-200 bg-white/80 p-1.5 shadow-sm">
        <Link
          href="/feed"
          className={`px-6 py-2 rounded-xl font-semibold transition-all ${
            !isFollowingTab && !isTrendingTab
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          All
        </Link>
        <Link
          href="/feed?tab=following"
          className={`px-6 py-2 rounded-xl font-semibold transition-all ${
            isFollowingTab
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          Following
        </Link>
        <Link
          href="/feed?tab=trending"
          className={`px-6 py-2 rounded-xl font-semibold transition-all ${
            isTrendingTab
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          Trending
        </Link>
      </div>

      {!isTrendingTab && (
        <div className="sb-surface-strong mb-10 p-6 md:p-7">
          <form action={createSocialPost} className="flex flex-col gap-4">
            <textarea
              name="content"
              placeholder="What are you researching today?"
              className="w-full resize-none border-none bg-transparent p-2 text-lg text-slate-800 outline-none placeholder:text-slate-400 focus:ring-0"
              rows={3}
              required
            />
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <button type="submit" className="sb-button-accent">
                Post Update
              </button>
            </div>
          </form>
        </div>
      )}

      {!isTrendingTab && (
        <form className="relative mb-10">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <svg
              className="h-5 w-5 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            name="q"
            placeholder="Search posts..."
            className="sb-input pl-12"
            defaultValue={q}
          />
        </form>
      )}

      {isTrendingTab ? (
        <TrendingList key="trending" items={trendingItems} />
      ) : (
        <div
          key={isFollowingTab ? "following" : "all"}
          className="flex flex-col gap-6"
        >
          {posts.map((post) => (
            <SocialPostCard
              key={post.id}
              post={post}
              isLiked={userLikes.has(post.id)}
              currentUserId={user.id}
            />
          ))}

          {posts.length === 0 && (
            <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/80 py-12 text-center">
              <p className="font-medium text-slate-500">
                No posts to show right now.
              </p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
