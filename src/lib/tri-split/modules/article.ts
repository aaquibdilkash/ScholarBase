/**
 * Article (blog) wiring for the shared Tri-Split list factory.
 *
 * Mirrors `modules/feed.ts`, but goes through the generic `createContentList`
 * helper, which derives every table and FK name from `ENTITY_CONFIG`. This is
 * the template the remaining content modules copy.
 */
import type { ArticleWithAuthor } from "@/types/cards";

import { createContentList } from "../content";

/** Cache tag for the viewer-agnostic public article pages. */
export const ARTICLES_PUBLIC_TAG = "articles-public";

/**
 * Viewer-agnostic projection. Deliberately excludes `votes`, `bookmarks` and
 * `author.followers`: those are viewer state and belong to the live overlay.
 */
const ARTICLE_SELECT = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  createdAt: true,
  updatedAt: true,
  editedAt: true,
  authorId: true,
  isFrozen: true,
  hasActiveAppeal: true,
  totalVotes: true,
  totalBookmarks: true,
  totalComments: true,
  author: {
    select: {
      id: true,
      name: true,
      handle: true,
      avatarUrl: true,
      institutionVerifiedAt: true,
    },
  },
} as const;

const articleList = createContentList({
  module: "ARTICLE",
  tag: ARTICLES_PUBLIC_TAG,
  where: { isDeleted: false },
  select: ARTICLE_SELECT as unknown as Record<string, unknown>,
  searchFields: [{ field: "title" }, { field: "name", relation: "author" }],
});

/** Loads one page of articles for the current viewer. */
export function loadArticlesPage(args: {
  query?: string;
  pageSize?: number;
  cursor?: string;
}): Promise<ArticleWithAuthor[]> {
  return articleList.fetchPage(args) as Promise<ArticleWithAuthor[]>;
}

/**
 * Purges the cached article pages. Call on publish / edit / delete / freeze so
 * a removed or frozen article cannot be served from the cache.
 */
export function revalidateArticles(): void {
  articleList.revalidate();
}
