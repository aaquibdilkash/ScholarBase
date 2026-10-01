/**
 * Search guardrails (P0-3).
 *
 * Search is the one read path a stranger can call as fast as they like, and on
 * the Supabase free tier every query spends the connection pool that the whole
 * app shares (AGENTS.md Rule 1). Two independent brakes:
 *
 * 1. A **minimum length**, applied where the `where` clause is built. A 1-2
 *    character term matches a large slice of the table, so it is both useless
 *    to the person searching and the most expensive thing anyone can ask for.
 *    Below the floor the term is dropped entirely and the caller gets the
 *    unfiltered list — the same shape the "no query at all" branch already
 *    returns, so a 1-character search costs zero database work.
 *
 * 2. A **rate limit** at the server-action entry point, which also covers
 *    legitimately long queries being spammed. See `fetchFeedPage`.
 *
 * The floor lives in one plain module rather than in a `"use server"` file so
 * both `buildWhere` implementations and the tests can import it.
 */

/**
 * Minimum characters before a term is treated as a real search.
 *
 * 3 rather than 2 because `contains` with an insensitive match on a 2-letter
 * term returns nearly everything. Bump it here, never inline — it is the one
 * number both search paths must agree on.
 */
export const MIN_SEARCH_LENGTH = 3;

/**
 * True when a raw (untrimmed) query is long enough to be worth a database hit.
 *
 * Deliberately total: it accepts `unknown` because query strings arrive from
 * URL search params and form state, so `undefined`/`null`/numbers are routine.
 */
export function isSearchableQuery(query: unknown): boolean {
  return (
    typeof query === "string" && query.trim().length >= MIN_SEARCH_LENGTH
  );
}
