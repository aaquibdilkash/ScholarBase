"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import type { Prisma } from "@prisma/client";
import { ArticleCard } from "@/components/blog/ArticleCard";

type ArticleWithDetails = Prisma.ArticleGetPayload<{
  include: {
    author: true;
    likes: false | { where: { userId: string } };
    _count: { select: { likes: true; comments: true } };
  };
}>;

export function ArticleList({
  articles,
  currentUserId,
  initialQuery,
}: {
  articles: ArticleWithDetails[];
  currentUserId?: string;
  initialQuery?: string;
}) {
  return (
    <div className="mb-10">
      <FilterableOpportunityList
        items={articles}
        placeholder="Search articles..."
        filterFn={(article, query) =>
          (article.title ?? "").toLowerCase().includes(query.toLowerCase()) ||
          (article.author?.name ?? "")
            .toLowerCase()
            .includes(query.toLowerCase())
        }
        initialQuery={initialQuery ?? ""}
        queryParamKey="q"
        basePath="/blog"
        enableClientFiltering
        renderItem={(article) => (
          <ArticleCard
            key={article.id}
            article={article}
            currentUserId={currentUserId}
          />
        )}
      />
    </div>
  );
}
