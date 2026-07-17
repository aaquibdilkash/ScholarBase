"use client";

import { FilterableOpportunityList } from "@/components/opportunities/FilterableList";
import { Article, ArticleLike, User } from "@prisma/client";
import { ArticleCard } from "@/components/blog/ArticleCard";

type ArticleWithDetails = Article & {
  author: User;
  likes: ArticleLike[];
  _count: {
    likes: number;
    comments: number;
  };
};

export function ArticleList({
  articles,
}: {
  articles: ArticleWithDetails[];
}) {
  return (
    <FilterableOpportunityList
      items={articles}
      placeholder="Search by title..."
      filterFn={(article, query) =>
        article.title.toLowerCase().includes(query.toLowerCase())
      }
      renderItem={(article) => (
        <ArticleCard
          key={article.id}
          article={article}
        />
      )}
    />
  );
}
