/**
 * Inbox search: groups by their own title, direct chats by the other participant.
 *
 * Two scoped queries, direct matches first. A group is no longer matched just
 * because a member's name contains the term ("kahkasha" in every group), which
 * used to drown out the one direct chat the user was actually looking for.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.hoisted(() => vi.fn());
const queryRaw = vi.hoisted(() => vi.fn(async () => []));

vi.mock("@/lib/db", () => ({
  default: {
    conversation: { findMany },
    $queryRaw: queryRaw,
  },
}));

let mockUser: { id: string } | null = { id: "u-1" };
vi.mock("@/lib/auth", () => ({
  requireCurrentUser: vi.fn(async () => {
    if (!mockUser) throw new Error("Not logged in");
    return mockUser;
  }),
}));

vi.mock("@/lib/search-rate-limit", () => ({
  allowSearchRequest: vi.fn(async () => true),
}));

import { searchInbox } from "@/app/actions/messages";

beforeEach(() => {
  findMany.mockReset();
  queryRaw.mockClear();
  mockUser = { id: "u-1" };
});

describe("searchInbox", () => {
  it("searches groups by title and direct chats by the other participant", async () => {
    const direct = { id: "c-direct", type: "DIRECT", title: null, participants: [], messages: [] };
    const group = { id: "c-group", type: "GROUP", title: "Reading circle", participants: [], messages: [] };
    findMany
      .mockResolvedValueOnce([direct])
      .mockResolvedValueOnce([group]);

    const results = await searchInbox("u-1", "reading");

    expect(results.map((r) => r.id)).toEqual(["c-direct", "c-group"]);
    expect(findMany).toHaveBeenCalledTimes(2);
    const directWhere = findMany.mock.calls[0][0].where;
    expect(directWhere.type).toBe("DIRECT");
    const groupWhere = findMany.mock.calls[1][0].where;
    expect(groupWhere.type).toBe("GROUP");
    expect(groupWhere.title).toEqual({ contains: "reading", mode: "insensitive" });
    // Groups are NOT matched by member names.
    expect(groupWhere).not.toHaveProperty("OR");
  });

  it("does not query below the shared search floor", async () => {
    await searchInbox("u-1", "ab");
    expect(findMany).not.toHaveBeenCalled();
  });

  it("refuses to search on behalf of another user", async () => {
    mockUser = { id: "u-2" };
    await expect(searchInbox("u-1", "reading")).rejects.toThrow(/Not authorized/i);
    expect(findMany).not.toHaveBeenCalled();
  });
});
