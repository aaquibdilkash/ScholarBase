/**
 * List-page search is URL state (`?q=`), shared by every module's list header.
 *
 * Submitting an empty box means "clear the search", not "search for nothing":
 * the parameter is removed entirely so the URL falls back to the plain list
 * page (`/feed`, not `/feed?q=`) and every other param (`tab`, `sort`, ...)
 * survives.
 */
export function buildSearchHref(
  pathname: string,
  currentSearch: string,
  query: string,
): string {
  const params = new URLSearchParams(currentSearch);
  const trimmed = query.trim();

  if (trimmed) {
    params.set("q", trimmed);
  } else {
    params.delete("q");
  }

  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}

/** Shared empty-state copy for a search that matched nothing. */
export const NO_SEARCH_MATCH = "No match found.";

/**
 * A search that matches nothing is not an empty directory: show the search
 * copy instead of the module's "nothing posted yet" message.
 */
export function listEmptyMessage(
  query: string | undefined,
  emptyMessage: string,
): string {
  return (query ?? "").trim() ? NO_SEARCH_MATCH : emptyMessage;
}
