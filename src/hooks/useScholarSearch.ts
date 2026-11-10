"use client";

import { searchScholarsForPicker } from "@/app/actions/scholars";
import { useDebouncedSearch } from "@/hooks/useDebouncedSearch";

/**
 * Debounced, cached scholar typeahead shared by the message recipient picker,
 * the `@mention` picker, and publication author linking.
 *
 * The debounce, minimum-length floor, cache keying, and stale-response handling
 * live in `useDebouncedSearch`, so no two pickers can drift apart.
 */
export function useScholarSearch(term: string, limit = 6) {
  return useDebouncedSearch({
    term,
    limit,
    queryKey: "scholarSearch",
    fetcher: searchScholarsForPicker,
  });
}
