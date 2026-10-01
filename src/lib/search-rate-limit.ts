import { headers } from "next/headers";
import { checkRateLimit, getRequestFingerprint } from "@/lib/rate-limit";

/**
 * Search throttling (P0-3, part 2 of 2).
 *
 * `@/lib/search-guard` holds the pure minimum-length rule because it is imported
 * by the cached `buildWhere` factories, which must stay free of request-scoped
 * APIs. The rate limiter is the opposite — it needs the current request — so it
 * lives here and every search entry point calls into it.
 *
 * One implementation for all of them, so the limit can never drift between the
 * feed, the 13 content-module listings, and the two raw-SQL pickers.
 *
 * Fails open when Redis is degraded: `checkRateLimit` reports `allowed: true`
 * with `degraded: true` in that case, matching the documented limiter policy.
 */
export const SEARCH_RATE_LIMIT = { limit: 30, window: "1 m" } as const;

/**
 * Consume one unit of search budget.
 *
 * Keyed by account when signed in, by request fingerprint otherwise — the same
 * split `contact.ts` uses. Returns false when the caller is over budget.
 */
export async function allowSearchRequest(
  namespace: string,
  viewerId?: string | null,
): Promise<boolean> {
  const headersList = await headers();
  const outcome = await checkRateLimit({
    namespace: `search:${namespace}`,
    key: viewerId ?? getRequestFingerprint(headersList),
    ...SEARCH_RATE_LIMIT,
  });
  return outcome.allowed;
}
