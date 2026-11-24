/**
 * Inbox search must find groups by their own title.
 *
 * The query used to only match participant names, so a group whose members were
 * not the search term ("papite log") was invisible in the very search box that
 * lists it. The GROUP-title branch is part of the Prisma `OR`; this test pins it
 * without needing a database.
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

describe("searchInbox group titles", () => {
  it("searches group titles as well as participant names", async () => {
    const group = {
      id: "c-group",
      type: "GROUP",
      title: "Reading circle",
      participants: [],
      messages: [],
    };
    findMany.mockResolvedValue([group]);

    const results = await searchInbox("u-1", "reading");

    expect(results).toEqual([{ ...group, unreadCount: 0 }]);
    const where = findMany.mock.calls[0][0].where;
    expect(where.participants).toEqual({ some: { userId: "u-1" } });
    expect(where.OR[0]).toEqual({
      type: "GROUP",
      title: { contains: "reading", mode: "insensitive" },
    });
  });

  it("does not query below the shared search floor", async () => {
    await searchInbox("u-1", "ab");

    expect(findMany).not.toHaveBeenCalled();
  });

  it("refuses to search on behalf of another user", async () => {
    mockUser = { id: "u-2" };

    await expect(searchInbox("u-1", "reading")).rejects.toThrow(
      /Not authorized/i,
    );
    expect(findMany).not.toHaveBeenCalled();
  });
});
