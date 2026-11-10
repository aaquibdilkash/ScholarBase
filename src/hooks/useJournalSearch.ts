"use client";

import { searchJournalsForPicker } from "@/app/actions/journals";
import { useDebouncedSearch } from "@/hooks/useDebouncedSearch";

/**
 * Debounced, cached journal typeahead used when linking a publication.
 *
 * Same primitive as `useScholarSearch`, so the journal picker gets the same
 * floor, debounce, cache, and stale-response protection as every other picker.
 */
export function useJournalSearch(term: string, limit = 6) {
  return useDebouncedSearch({
    term,
    limit,
    queryKey: "journalSearch",
    fetcher: searchJournalsForPicker,
  });
}
