"use client";

import { useCallback, useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { searchInbox } from "@/app/actions/messages";
import { LIST_REVALIDATE_MS } from "@/components/layout/listPage";
import { MIN_SEARCH_LENGTH } from "@/lib/search-guard";

type InboxSearchResults = Awaited<ReturnType<typeof searchInbox>>;

/**
 * Coalesce typing into one request per term. The server allows 30 searches a
 * minute per account, so firing per keystroke would burn the budget on partial
 * terms.
 */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Debounced, race-safe search over the viewer's conversations, backed by the
 * React Query cache — matching the list pages.
 *
 * Repeating a term is an instant cache hit, and `keepPreviousData` keeps the
 * previous term's results on screen while the next one loads (no blank flash).
 *
 * `results` is `null` when no search is applied (render the normal inbox) and
 * an array once a search has settled. Responses for a term the user has since
 * changed are keyed separately, so an in-flight request can never repopulate
 * the list with stale matches.
 *
 * `searchNow` runs the current term immediately, skipping the debounce — used
 * by Enter and the search button so an explicit submit never waits.
 */
export function useInboxSearch(userId: string | undefined, query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const q = query.trim();
  const isActive = q.length >= MIN_SEARCH_LENGTH && !!userId;
  // The term the search below should fetch; `""` means no search applied.
  const appliedQuery = isActive ? debouncedQuery : "";
  const isDebouncing = isActive && q !== debouncedQuery;

  useEffect(() => {
    if (!isActive) {
      setDebouncedQuery("");
      return;
    }
    if (q === debouncedQuery) return;

    const timer = setTimeout(() => setDebouncedQuery(q), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q, isActive, debouncedQuery]);

  const { data, isFetching } = useQuery<InboxSearchResults>({
    queryKey: ["inboxSearch", userId, appliedQuery],
    queryFn: async () => searchInbox(userId!, appliedQuery),
    enabled: isActive && appliedQuery.length > 0,
    // Keep the previous term's results on screen while the new term loads.
    placeholderData: keepPreviousData,
    // Cache repeat searches so backspacing to a prior term is instant.
    staleTime: LIST_REVALIDATE_MS,
  });

  // `null` = no search applied (show the inbox); `[]` = searching / no matches.
  const results = appliedQuery.length > 0 ? (data ?? []) : null;
  const isSearching = isDebouncing || isFetching;

  const searchNow = useCallback(() => {
    // Explicit submit skips the debounce.
    if (isActive) setDebouncedQuery(q);
  }, [q, isActive]);

  return {
    results,
    isSearching,
    searchNow,
  };
}
