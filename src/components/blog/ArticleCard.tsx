
import { Article, ArticleLike } from "@prisma/client";
import Link from "next/link";
import { LikeButton } from "@/components/interactions/LikeButton";
import { CommentIcon } from "@/components/icons/CommentIcon";

type ArticleWithCountsAndLikes = Article & {
    _count: {
        likes: number;
        comments: number;
    };
    likes: ArticleLike[];
};

export function ArticleCard({ article }: { article: ArticleWithCountsAndLikes }) {
    return (
        <div
            key={article.id}
            className="sb-card sb-card-hover group flex flex-col"
        >
            <Link
                href={`/blog/${article.slug}`}
                className="flex-grow"
            >
                <h2 className="mb-2 text-xl font-semibold leading-tight text-slate-950 group-hover:text-blue-700 transition-colors">
                    {article.title}
                </h2>
                <p className="text-sm leading-relaxed text-slate-600 line-clamp-3">
                    {article.excerpt}
                </p>
            </Link>
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-semibold">
                <div className="flex gap-4">
                    <LikeButton
                        targetId={article.id}
                        type="article"
                        initialLikes={article._count.likes}
                        initialIsLiked={!!article.likes?.length}
                    />
                    <Link href={`/blog/${article.slug}`} className="flex items-center gap-1 text-slate-500 hover:text-blue-700">
                        <CommentIcon className="h-5 w-5" />
                        {article._count.comments}
                    </Link>
                </div>
                <Link
                    href={`/blog/${article.slug}`}
                    className="text-blue-700">
                    Read Article{" "}
                    <span className="ml-1 group-hover:translate-x-1 transition-transform">
                        →
                    </span>
                </Link>
            </div>
        </div>
    );
}
