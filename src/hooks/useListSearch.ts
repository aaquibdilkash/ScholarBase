"use client";

import { type FormEvent, useEffect, useState } from "react";

import { buildSearchHref } from "@/lib/list-search";
import { MIN_SEARCH_LENGTH } from "@/lib/search-guard";

/**
 * Coalesce typing into one request. The server allows 30 searches a minute per
 * account, so firing per keystroke would burn the budget on partial terms.
 */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Search state shared by every list page.
 *
 * Lists fetch through their existing server action (`getX(query, …)`), so a
 * search is one action call that returns rows — not an RSC navigation that
 * re-renders the page and swaps the list for a skeleton. `appliedQuery` is the
 * term the list below should fetch.
 *
 * Below the shared search floor there is no search: the unfiltered list shows,
 * matching the conversation search. The URL is kept in sync with
 * `history.replaceState`, which Next's router applies shallowly — the page
 * stays shareable and refreshable without a server round trip.
 */
export function useListSearch(pathname: string, initialQuery?: string) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(
    initialQuery?.trim() ?? "",
  );

  const trimmed = query.trim();
  const searchable = trimmed.length >= MIN_SEARCH_LENGTH;
  // No search while the term is below the floor: show the plain list instead of
  // a term the server would ignore.
  const appliedQuery = searchable ? debouncedQuery : "";
  const isDebouncing = searchable && trimmed !== debouncedQuery;

  useEffect(() => {
    if (!searchable) {
      setDebouncedQuery("");
      return;
    }
    if (trimmed === debouncedQuery) return;

    const timer = setTimeout(() => setDebouncedQuery(trimmed), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmed, searchable, debouncedQuery]);

  // Shallow URL sync: no RSC fetch, no skeleton, but a reload or a shared link
  // still lands on the same search. Other params (`tab`, `sort`) are preserved.
  useEffect(() => {
    const href = buildSearchHref(pathname, window.location.search, appliedQuery);
    if (`${window.location.pathname}${window.location.search}` !== href) {
      window.history.replaceState(null, "", href);
    }
  }, [pathname, appliedQuery]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Explicit submit skips the debounce. `SearchInput` has already blocked a
    // below-floor term, so there is nothing to do for one here.
    if (searchable) setDebouncedQuery(trimmed);
  };

  const handleClear = () => {
    setQuery("");
    setDebouncedQuery("");
  };

  return {
    query,
    setQuery,
    /** The term the list should fetch; `""` means the unfiltered list. */
    appliedQuery,
    /** Typing has moved on and the debounce has not fired yet. */
    isDebouncing,
    handleSearch,
    handleClear,
  };
}
