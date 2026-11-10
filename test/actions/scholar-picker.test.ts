/**
 * The scholar picker is shared by `@mentions`, the new-message recipient field,
 * and publication author linking. It must mirror the fast user searches on
 * `/messages` and `/scholars`: match name/handle with an insensitive `contains`,
 * which PostgreSQL serves from the trigram indexes.
 *
 * Regression it locks down: the old raw-SQL version added
 * `similarity(name, term) > 0.25` branches. A pg_trgm GIN index cannot answer a
 * function call, and one non-indexable branch inside an `OR` forces the whole
 * statement to a sequential scan over `User`. The query is asserted here rather
 * than through the fake Prisma store because the fake does not implement
 * Prisma's `mode: "insensitive"` filter — and because a raw-SQL regression must
 * fail this suite, not pass silently.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, allowSearchRequest } = vi.hoisted(() => ({
  findMany: vi.fn(),
  allowSearchRequest: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ default: { user: { findMany } } }));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => ({ id: "viewer" })),
}));
vi.mock("@/lib/search-rate-limit", () => ({ allowSearchRequest }));

import { searchScholarsForPicker } from "@/app/actions/scholars";

beforeEach(() => {
  findMany.mockReset();
  allowSearchRequest.mockReset();
  allowSearchRequest.mockResolvedValue(true);
});

describe("searchScholarsForPicker", () => {
  it("queries name and handle only, with the indexable contains filter", async () => {
    findMany.mockResolvedValue([
      { id: "u1", name: "Alice Zhang", handle: "azhang", avatarUrl: null },
    ]);

    const results = await searchScholarsForPicker("Alice", 5);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        isDeleted: false,
        OR: [
          { name: { contains: "Alice", mode: "insensitive" } },
          { handle: { contains: "Alice", mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, handle: true, avatarUrl: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    expect(results).toEqual([
      { id: "u1", name: "Alice Zhang", handle: "azhang", avatarUrl: null },
    ]);
  });

  it("does not hit the database below the shared floor", async () => {
    await expect(searchScholarsForPicker("al")).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
    expect(allowSearchRequest).not.toHaveBeenCalled();
  });

  it("does not hit the database when the rate limit denies the search", async () => {
    allowSearchRequest.mockResolvedValue(false);

    await expect(searchScholarsForPicker("Alice")).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("clamps the limit to the picker maximum", async () => {
    findMany.mockResolvedValue([]);

    await searchScholarsForPicker("Alice", 500);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });

  it("trims the term before querying", async () => {
    findMany.mockResolvedValue([]);

    await searchScholarsForPicker("  Alice  ");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: "Alice", mode: "insensitive" } },
            { handle: { contains: "Alice", mode: "insensitive" } },
          ],
        }),
      }),
    );
  });
});
