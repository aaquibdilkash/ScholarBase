/**
 * The journal picker is used when linking a publication. It must mirror the
 * fast user searches and the `/journals` list search: match the fields that
 * identify a journal (title, publisher, ISSN) with an insensitive `contains`,
 * which PostgreSQL serves from the trigram indexes.
 *
 * Regression it locks down: the old raw-SQL version added
 * `similarity()` / `word_similarity()` / `to_tsvector(...)` branches. A pg_trgm
 * GIN index cannot answer a function call, and one non-indexable branch inside
 * an `OR` forces the whole statement to a sequential scan over `Journal`.
 *
 * The query is asserted rather than run through the fake Prisma store because
 * the fake does not implement Prisma's `mode: "insensitive"` filter — and a
 * raw-SQL regression must fail this suite, not pass silently.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, allowSearchRequest } = vi.hoisted(() => ({
  findMany: vi.fn(),
  allowSearchRequest: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ default: { journal: { findMany } } }));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => ({ id: "viewer" })),
}));
vi.mock("@/lib/search-rate-limit", () => ({ allowSearchRequest }));

import { searchJournalsForPicker } from "@/app/actions/journals";

beforeEach(() => {
  findMany.mockReset();
  allowSearchRequest.mockReset();
  allowSearchRequest.mockResolvedValue(true);
});

describe("searchJournalsForPicker", () => {
  it("queries title, publisher, and ISSN only, with the indexable contains filter", async () => {
    findMany.mockResolvedValue([
      {
        id: "j1",
        title: "Nature",
        publisher: "Springer",
        issn: "0028-0836",
      },
    ]);

    const results = await searchJournalsForPicker("Nature", 5);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        isDeleted: false,
        OR: [
          { title: { contains: "Nature", mode: "insensitive" } },
          { publisher: { contains: "Nature", mode: "insensitive" } },
          { issn: { contains: "Nature", mode: "insensitive" } },
        ],
      },
      select: { id: true, title: true, publisher: true, issn: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    expect(results).toEqual([
      { id: "j1", title: "Nature", publisher: "Springer", issn: "0028-0836" },
    ]);
  });

  it("does not hit the database below the shared floor", async () => {
    await expect(searchJournalsForPicker("Na")).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
    expect(allowSearchRequest).not.toHaveBeenCalled();
  });

  it("does not hit the database when the rate limit denies the search", async () => {
    allowSearchRequest.mockResolvedValue(false);

    await expect(searchJournalsForPicker("Nature")).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("clamps the limit to the picker maximum", async () => {
    findMany.mockResolvedValue([]);

    await searchJournalsForPicker("Nature", 500);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });

  it("trims the term before querying", async () => {
    findMany.mockResolvedValue([]);

    await searchJournalsForPicker("  Nature  ");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { title: { contains: "Nature", mode: "insensitive" } },
            { publisher: { contains: "Nature", mode: "insensitive" } },
            { issn: { contains: "Nature", mode: "insensitive" } },
          ],
        }),
      }),
    );
  });
});
