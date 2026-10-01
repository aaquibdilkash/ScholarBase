import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetFakeDb } from "../fake-prisma";
import { loadContentPage } from "@/lib/tri-split/modules/registry";
import { searchJournalsForPicker } from "@/app/actions/journals";
import { searchScholarsForPicker } from "@/app/actions/scholars";
import { searchInbox } from "@/app/actions/messages";

/**
 * P0-3 — the search guardrails must cover EVERY search surface, not just the
 * feed. This file exists because of a real gap it now locks down:
 *
 *   * the minimum-length floor reached every module through the shared
 *     `createContentList` factory, but the *rate limit* only ever reached
 *     `fetchFeedPage`;
 *   * the two raw-SQL pickers used a local floor of 2 and no limit at all,
 *     despite `similarity()` being the most expensive query shape here;
 *   * the scholar directory has its own `buildWhere` that skipped the floor.
 *
 * The tri-split modules are deliberately NOT mocked — only their leaf
 * dependencies are — because the thing under test is whether these entry points
 * throttle at all.
 */

let mockCurrentUser: { id: string } | null = null;
let mockOutcome = { allowed: true, limited: false, degraded: false };

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => mockCurrentUser),
  getActiveUser: vi.fn(async () => ({ user: mockCurrentUser, frozen: false })),
  requireCurrentUser: vi.fn(async () => {
    if (!mockCurrentUser) throw new Error("Not logged in");
    return mockCurrentUser;
  }),
  requireActiveUser: vi.fn(async () => {
    if (!mockCurrentUser) throw new Error("Not logged in");
    return mockCurrentUser;
  }),
  isUserAdmin: vi.fn(async () => false),
  isAuthorizedOrAdmin: vi.fn(async () => false),
  resolvePostDeletePermission: vi.fn(async () => ({ canDelete: false })),
}));

const checkRateLimitMock = vi.fn(async () => mockOutcome);
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: never[]) => checkRateLimitMock(...(args as [])),
  enforceRateLimit: vi.fn(async () => {}),
  getRequestFingerprint: vi.fn(() => "fp-anon"),
  hashRateLimitKey: vi.fn((v: string) => v),
  RATE_LIMIT_ERROR: "Too many requests. Please slow down.",
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "1.2.3.4" })),
}));

vi.mock("@/lib/qstash", () => ({
  queueNotification: vi.fn(async () => {}),
  queueMessagePush: vi.fn(async () => {}),
}));

beforeEach(() => {
  resetFakeDb();
  mockCurrentUser = { id: "u-1" };
  mockOutcome = { allowed: true, limited: false, degraded: false };
  checkRateLimitMock.mockClear();
});

describe("registry content listings (13 modules, one chokepoint)", () => {
  it.each(["COURSE", "JOURNAL", "PUBLICATION", "RESEARCH_GRANT"])(
    "throttles a real search on %s",
    async (key) => {
      await loadContentPage(key as never, { query: "genomics" });
      expect(checkRateLimitMock).toHaveBeenCalledWith(
        expect.objectContaining({ namespace: `search:content:${key}` }),
      );
    },
  );

  it("does not consume budget for browsing with no query", async () => {
    // `.catch` is about the data layer only: `unstable_cache` needs a Next
    // request context these unit tests do not have. The assertion under test is
    // that the limiter was never consulted.
    await loadContentPage("COURSE", {}).catch(() => []);
    expect(checkRateLimitMock).not.toHaveBeenCalled();
  });

  it("does not consume budget for a 1-character query", async () => {
    await loadContentPage("COURSE", { query: "a" }).catch(() => []);
    expect(checkRateLimitMock).not.toHaveBeenCalled();
  });

  it("returns an empty page instead of throwing when limited", async () => {
    mockOutcome = { allowed: false, limited: true, degraded: false };
    await expect(
      loadContentPage("JOURNAL", { query: "genomics" }),
    ).resolves.toEqual([]);
  });
});

describe("scholar directory (its own list factory)", () => {
  it("throttles a real search", async () => {
    await loadContentPage("SCHOLAR_DIRECTORY", { query: "genomics" });
    // Routed through the registry, so it shares the one throttle namespace
    // with every other listing.
    expect(checkRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "search:content:SCHOLAR_DIRECTORY" }),
    );
  });

  it("does not consume budget for a 1-character query", async () => {
    await loadContentPage("SCHOLAR_DIRECTORY", { query: "a" }).catch(() => []);
    expect(checkRateLimitMock).not.toHaveBeenCalled();
  });

  it("returns empty instead of throwing when limited", async () => {
    mockOutcome = { allowed: false, limited: true, degraded: false };
    await expect(
      loadContentPage("SCHOLAR_DIRECTORY", { query: "genomics" }),
    ).resolves.toEqual([]);
  });
});

describe("raw-SQL pickers (trigram similarity — the priciest shape)", () => {
  it("throttles the journal picker", async () => {
    await searchJournalsForPicker("genomics").catch(() => []);
    expect(checkRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "search:picker:journal" }),
    );
  });

  it("throttles the scholar picker", async () => {
    await searchScholarsForPicker("genomics").catch(() => []);
    expect(checkRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "search:picker:scholar" }),
    );
  });

  it.each([
    ["journal picker", searchJournalsForPicker],
    ["scholar picker", searchScholarsForPicker],
  ])(
    "rejects a 2-character term on the %s (floor raised from 2 to 3)",
    async (_label, fn) => {
      checkRateLimitMock.mockClear();
      await expect(fn("ab")).resolves.toEqual([]);
      expect(checkRateLimitMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["journal picker", searchJournalsForPicker],
    ["scholar picker", searchScholarsForPicker],
  ])(
    "returns empty instead of throwing when the %s is limited",
    async (_label, fn) => {
      mockOutcome = { allowed: false, limited: true, degraded: false };
      await expect(fn("genomics")).resolves.toEqual([]);
    },
  );
});

describe("inbox search", () => {
  it("throttles a real search", async () => {
    await searchInbox("u-1", "genomics").catch(() => []);
    expect(checkRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "search:messages:inbox" }),
    );
  });

  it("does not consume budget for a 1-character query", async () => {
    await searchInbox("u-1", "a");
    expect(checkRateLimitMock).not.toHaveBeenCalled();
  });
});

describe("fails open when Redis is degraded", () => {
  it("honours the degraded verdict and lets the request through", async () => {
    mockOutcome = { allowed: true, limited: false, degraded: true };
    // Not `[]` — the point is that a degraded limiter does not hard-fail the
    // search, matching the documented fail-open policy.
    await expect(loadContentPage("COURSE", { query: "genomics" })).resolves.not.toThrow();
  });
});

