
"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import type { Article, User, VoteType } from "@prisma/client";
import { ArticleCard } from "@/components/blog/ArticleCard";

type ArticleWithDetails = Article & {
  author: User & {
    followers?: { followerId: string }[];
  };
  votes: {
    userId: string;
    voteType: VoteType;
  }[];
  _count: {
    votes: number;
    comments: number;
  };
};

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
        enableClientFiltering={false}
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
