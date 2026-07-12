
"use client";

import { SocialPost, User, SocialLike } from "@prisma/client";
import Link from "next/link";
import Image from "next/image";
import { LikeButton } from "@/components/interactions/LikeButton";
import { CommentIcon } from "@/components/icons/CommentIcon";

type PostWithDetails = SocialPost & {
    author: User;
    likes: SocialLike[];
    _count: {
        comments: number;
    };
};

export function SocialPostCard({ post, isLiked }: { post: PostWithDetails, isLiked: boolean }) {
    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        }).format(date);
    };

    return (
        <article key={post.id} className="sb-card sb-card-hover">
            {/* Header: Author Info */}
            <div className="flex items-center gap-4 mb-4">
                <Link href={`/scholar/${post.authorId}`} className="shrink-0">
                    <div className="w-12 h-12 rounded-full bg-slate-100 border flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-blue-100 transition">
                        {post.author.avatarUrl ? (
                            <Image
                                src={post.author.avatarUrl}
                                alt="Author"
                                width={48}
                                height={48}
                                unoptimized
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <span className="font-semibold text-slate-400 text-lg">
                                {post.author.name?.charAt(0).toUpperCase() || "?"}
                            </span>
                        )}
                    </div>
                </Link>
                <div>
                    <Link
                        href={`/scholar/${post.authorId}`}
                        className="font-semibold text-slate-950 hover:text-blue-700 hover:underline transition"
                    >
                        {post.author.name || "Scholar"}
                    </Link>
                    <div className="mt-0.5 text-xs font-medium text-slate-500">
                        {post.author.handle && (
                            <span className="mr-2">@{post.author.handle}</span>
                        )}
                        <span>{formatDate(post.createdAt)}</span>
                    </div>
                </div>
            </div>

            {/* Body: Clickable Post Content */}
            <Link href={`/feed/${post.id}`} className="block group">
                <p className="mb-4 whitespace-pre-wrap leading-relaxed text-slate-800 transition-colors group-hover:text-slate-600">
                    {post.content}
                </p>
            </Link>

            {/* Footer: Interactions */}
            <div className="pt-4 border-t border-slate-100 flex items-center gap-6">
                <LikeButton
                    targetId={post.id}
                    type="post"
                    initialLikes={post.likes.length}
                    initialIsLiked={isLiked}
                />

                <Link
                    href={`/feed/${post.id}`}
                    className="flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-blue-700"
                >
                    <CommentIcon className="w-5 h-5" />
                    {post._count.comments} Comments
                </Link>
            </div>
        </article>
    );
}
