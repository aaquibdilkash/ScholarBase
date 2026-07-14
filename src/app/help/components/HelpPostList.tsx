"use client";

import { HelpPost, User } from "@prisma/client";
import { HelpPostCard } from "./HelpPostCard";

type HelpPostWithAuthor = HelpPost & {
    author: User;
    isLiked: boolean;
    _count: { likes: number; comments: number };
};

export function HelpPostList({
  posts,
}: {
  posts: HelpPostWithAuthor[];
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {posts.map((post) => (
        <HelpPostCard key={post.id} helpPost={post} />
      ))}
    </div>
  );
}
