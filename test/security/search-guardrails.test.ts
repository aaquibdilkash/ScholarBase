import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetFakeDb } from "../fake-prisma";
import { fetchFeedPage } from "@/app/actions/feed";
import { isSearchableQuery, MIN_SEARCH_LENGTH } from "@/lib/search-guard";

/**
 * P0-3 — search guardrails.
 *
 * Search is the one read path a stranger can hammer, and every query spends the
 * shared Supabase connection pool (AGENTS.md Rule 1). Two brakes are asserted
 * here: a minimum length that keeps a 1-character search off the database
 * entirely, and a rate limit on the entry point for everything longer than that.
 */

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

let mockCurrentUser: { id: string } | null = null;
let mockOutcome = { allowed: true, limited: false, degraded: false };

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => mockCurrentUser),
  requireCurrentUser: vi.fn(async () => mockCurrentUser),
  requireActiveUser: vi.fn(async () => mockCurrentUser),
  getActiveUser: vi.fn(async () => ({ user: mockCurrentUser, frozen: false })),
  isUserAdmin: vi.fn(async () => false),
  isAuthorizedOrAdmin: vi.fn(async () => false),
}));

const checkRateLimitMock = vi.fn(async () => mockOutcome);
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: never[]) => checkRateLimitMock(...(args as [])),
  enforceRateLimit: vi.fn(async () => {}),
  getRequestFingerprint: vi.fn(() => "fp-anon"),
  RATE_LIMIT_ERROR: "Too many requests. Please slow down.",
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "1.2.3.4" })),
}));

const loadFeedPageMock = vi.fn(async () => [{ id: "p1" }]);
vi.mock("@/lib/tri-split/modules/registry", () => ({
  loadContentPage: (...args: never[]) => loadFeedPageMock(...(args as [])),
  revalidateContent: vi.fn(),
}));
vi.mock("@/lib/tri-split/modules/survey", () => ({ revalidateSurvey: vi.fn() }));
vi.mock("@/lib/cloudinary", () => ({
  deleteCloudinaryAsset: vi.fn(async () => {}),
  promoteDraftCloudinaryAsset: vi.fn(async () => null),
  extractCloudinaryPublicId: vi.fn(() => null),
}));
vi.mock("@/lib/qstash", () => ({ queueNotification: vi.fn(async () => {}) }));

beforeEach(() => {
  resetFakeDb();
  mockCurrentUser = null;
  mockOutcome = { allowed: true, limited: false, degraded: false };
  checkRateLimitMock.mockClear();
  loadFeedPageMock.mockClear();
});

describe("isSearchableQuery", () => {
  it("rejects terms below the floor", () => {
    expect(isSearchableQuery("")).toBe(false);
    expect(isSearchableQuery("a")).toBe(false);
    expect(isSearchableQuery("ab")).toBe(false);
    expect(isSearchableQuery("  a  ")).toBe(false);
  });

  it("accepts terms at or above the floor", () => {
    expect(isSearchableQuery("abc")).toBe(true);
    expect(isSearchableQuery("  abc  ")).toBe(true);
    expect(isSearchableQuery("machine learning")).toBe(true);
  });

  it("treats non-strings as not searchable", () => {
    expect(isSearchableQuery(undefined)).toBe(false);
    expect(isSearchableQuery(null)).toBe(false);
    expect(isSearchableQuery(42)).toBe(false);
    expect(isSearchableQuery({ length: 9 })).toBe(false);
  });

  it("has a floor of 3, which both search paths share", () => {
    expect(MIN_SEARCH_LENGTH).toBe(3);
  });
});

describe("fetchFeedPage rate limiting", () => {
  it("does not rate-limit ordinary browsing with no query", async () => {
    await fetchFeedPage(undefined, undefined);
    expect(checkRateLimitMock).not.toHaveBeenCalled();
    expect(loadFeedPageMock).toHaveBeenCalledTimes(1);
  });

  it("does not rate-limit a 1-character query, which costs no DB work", async () => {
    await fetchFeedPage(undefined, "a");
    expect(checkRateLimitMock).not.toHaveBeenCalled();
    expect(loadFeedPageMock).toHaveBeenCalledTimes(1);
  });

  it("does not rate-limit a 2-character query either", async () => {
    await fetchFeedPage(undefined, "ab");
    expect(checkRateLimitMock).not.toHaveBeenCalled();
    expect(loadFeedPageMock).toHaveBeenCalledTimes(1);
  });

  it("rate-limits a real search", async () => {
    await fetchFeedPage(undefined, "genomics");
    expect(checkRateLimitMock).toHaveBeenCalledTimes(1);
    // Namespaced through the shared `allowSearchRequest` helper so every search
    // surface uses one limit.
    expect(checkRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "search:feed", limit: 30 }),
    );
    expect(loadFeedPageMock).toHaveBeenCalledTimes(1);
  });

  it("keys by account when signed in", async () => {
    mockCurrentUser = { id: "u-1" };
    await fetchFeedPage(undefined, "genomics");
    expect(checkRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({ key: "u-1" }),
    );
  });

  it("keys by request fingerprint when anonymous", async () => {
    await fetchFeedPage(undefined, "genomics");
    expect(checkRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({ key: "fp-anon" }),
    );
  });

  it("returns an empty page instead of throwing when limited", async () => {
    mockOutcome = { allowed: false, limited: true, degraded: false };
    const posts = await fetchFeedPage(undefined, "genomics");
    expect(posts).toEqual([]);
    // Crucially the query never reaches the database.
    expect(loadFeedPageMock).not.toHaveBeenCalled();
  });

  it("still serves results when Redis is degraded (fail-open)", async () => {
    mockOutcome = { allowed: true, limited: false, degraded: true };
    const posts = await fetchFeedPage(undefined, "genomics");
    expect(posts).toEqual([{ id: "p1" }]);
    expect(loadFeedPageMock).toHaveBeenCalledTimes(1);
  });

  it("rate-limits each page of a paginated search, not just the first", async () => {
    await fetchFeedPage(undefined, "genomics", 10, "cursor-1");
    expect(checkRateLimitMock).toHaveBeenCalledTimes(1);
    expect(loadFeedPageMock).toHaveBeenCalledWith(
      "FEED",
      expect.objectContaining({ cursor: "cursor-1" }),
    );
  });
});
