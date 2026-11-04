"use client";

import { useMemo } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { useListSearch } from "@/hooks/useListSearch";
import { listEmptyMessage } from "@/lib/list-search";
import { SearchInput } from "@/components/ui/SearchInput";
import { SocialPostCard } from "@/components/feed/SocialPostCard";
import { CacheBackedList } from "@/components/layout/CacheBackedList";
import { fetchFeedPage } from "@/app/actions/feed";
import type { SocialPostFeedItem } from "@/types/feed";

export function FeedList({
  posts,
  currentUserId,
  initialQuery,
  tab,
  pageSize = 10,
}: {
  posts: SocialPostFeedItem[];
  currentUserId?: string;
  initialQuery?: string;
  /** Active feed tab ("trending", "following", ...). Part of the query key. */
  tab?: string;
  /** Page size, shared with the server so `hasMore` stays in sync. */
  pageSize?: number;
}) {
  const { query, setQuery, appliedQuery, isDebouncing, handleSearch, handleClear } =
    useListSearch("/feed", initialQuery);
  // Keep the same key shape the cache writers in CreateSocialPostForm /
  // SocialPostCard / CommentSection target via `{ queryKey: ["feed"] }`.
  const queryKey = useMemo(
    () => ["feed", { q: appliedQuery, tab: tab ?? "" }] as const,
    [appliedQuery, tab],
  );
  const isFetching = useIsFetching({ queryKey, exact: true }) > 0;
  const isSearching = isDebouncing || isFetching;
  // Only the server-rendered term has data to seed the cache with.
  const isServerQuery = appliedQuery === (initialQuery ?? "");

  return (
    <div className="mb-10">
      <form onSubmit={handleSearch}>
        <SearchInput
          value={query}
          activeQuery={appliedQuery}
          onChange={(e) => setQuery(e.target.value)}
          onClear={handleClear}
          loading={isSearching}
          placeholder="Search posts..."
          className="mb-4"
        />
      </form>

      <CacheBackedList<SocialPostFeedItem>
        queryKey={queryKey}
        initialItems={isServerQuery ? posts : undefined}
        keepPreviousOnKeyChange
        chunkSize={pageSize}
        fetchPage={(cursor) =>
          // Viewer identity is resolved server-side inside the action; the
          // client never sends a userId.
          fetchFeedPage(tab, appliedQuery, pageSize, cursor)
        }
        renderItem={(post, index) => (
          <SocialPostCard
            key={post.id}
            post={post}
            currentUserId={currentUserId}
            priority={index === 0}
          />
        )}
        className="flex flex-col gap-6"
        emptyMessage={listEmptyMessage(
          appliedQuery,
          "No posts to show right now.",
        )}
        onLoadError={(error) => {
          console.error("Failed to load more posts:", error);
        }}
      />
    </div>
  );
}
