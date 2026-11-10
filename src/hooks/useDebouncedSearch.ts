"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { LIST_REVALIDATE_MS } from "@/components/layout/listPage";
import { MIN_SEARCH_LENGTH } from "@/lib/search-guard";

/**
 * Coalesce typing into one request per term. The server allows 30 searches a
 * minute per account, so firing per keystroke would burn the budget on partial
 * terms. Same 300 ms as `useListSearch` / `useInboxSearch`.
 */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Debounced, race-safe typeahead backed by the React Query cache — the one
 * primitive behind every picker (`useScholarSearch`, `useJournalSearch`).
 *
 * Mirrors `useInboxSearch`: the same minimum-length floor, the same debounce,
 * and the same cache so repeating a term (or backspacing to a prior one) is
 * instant. `keepPreviousData` keeps the previous suggestions on screen while
 * the next term loads, so the dropdown never blanks mid-search.
 *
 * Below the floor `results` is `[]` and no request is made — the server would
 * ignore the term anyway. A failed request clears the list rather than leaving
 * the previous term's rows under the new term.
 *
 * `queryKey` namespaces the cache, and the term and limit are appended to it,
 * so two pickers asking for the same text never share a page.
 */
export function useDebouncedSearch<T>({
  term,
  limit,
  queryKey,
  fetcher,
}: {
  term: string;
  limit: number;
  queryKey: string;
  fetcher: (term: string, limit: number) => Promise<T[]>;
}) {
  const q = term.trim();
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const isActive = q.length >= MIN_SEARCH_LENGTH;
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

  const { data, isFetching, isError } = useQuery<T[]>({
    queryKey: [queryKey, appliedQuery, limit],
    queryFn: async () => fetcher(appliedQuery, limit),
    enabled: appliedQuery.length > 0,
    // Keep the previous term's suggestions on screen while the new term loads.
    placeholderData: keepPreviousData,
    // Cache repeat searches so backspacing to a prior term is instant.
    staleTime: LIST_REVALIDATE_MS,
  });

  return {
    // A failed search clears the list rather than leaving the previous term's
    // matches in the dropdown under the new term.
    results: appliedQuery.length > 0 && !isError ? (data ?? []) : [],
    isSearching: isActive && (isDebouncing || isFetching),
    isError: appliedQuery.length > 0 && isError,
  };
}
