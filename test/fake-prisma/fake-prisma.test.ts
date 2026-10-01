import { beforeEach, describe, expect, it, vi } from "vitest"
import { matchWhere } from "./match"
import { fakeDb, resetFakeDb } from "./instance"
import type { FakePrismaClient } from "./store"

// Proves the fake is injected in place of the real client: `transactions.ts`
// imports it as `./db`, which resolves to the same module id as `@/lib/db`.
vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("./instance")
  return { default: fakeDb.client }
})

describe("fake-prisma: where matching", () => {
  it("matches scalar equality and null", () => {
    const row = { id: "a", authorId: "u1", isDeleted: false, deletedAt: null }
    expect(matchWhere(row, { id: "a" })).toBe(true)
    expect(matchWhere(row, { id: "b" })).toBe(false)
    expect(matchWhere(row, { deletedAt: null })).toBe(true)
    expect(matchWhere(row, { authorId: "u1", isDeleted: false })).toBe(true)
  })

  it("resolves Prisma composite-unique shorthand", () => {
    const vote = { id: "v1", socialPostId: "p1", userId: "u1", voteType: "UPVOTE" }
    expect(matchWhere(vote, { socialPostId_userId: { socialPostId: "p1", userId: "u1" } })).toBe(true)
    expect(matchWhere(vote, { socialPostId_userId: { socialPostId: "p2", userId: "u1" } })).toBe(false)
  })

  it("supports operators, OR and NOT", () => {
    const row = { id: "a", totalVotes: 5, tags: ["x"] }
    expect(matchWhere(row, { totalVotes: { gte: 5, lte: 5 } })).toBe(true)
    expect(matchWhere(row, { totalVotes: { gt: 5 } })).toBe(false)
    expect(matchWhere(row, { id: { in: ["a", "b"] } })).toBe(true)
    expect(matchWhere(row, { OR: [{ id: "zzz" }, { totalVotes: 5 }] })).toBe(true)
    expect(matchWhere(row, { NOT: [{ id: "a" }] })).toBe(false)
  })

  it("supports scalar `not`, which excludes self-lookups", () => {
    // Added for `isHandleAvailable`, which asks for `{ id: { not: <me> } }` so a
    // user keeping their own handle is not told it is taken.
    const row = { id: "u-author", handle: "ada" }
    expect(matchWhere(row, { id: { not: "u-author" } })).toBe(false)
    expect(matchWhere(row, { id: { not: "u-other" } })).toBe(true)
    // `not` composes with another operator on the same field, as Prisma allows.
    expect(matchWhere(row, { handle: { not: "ada", equals: "ada" } })).toBe(false)
    // Known limitation: the fake cannot tell a scalar column from a relation, so
    // `{ author: { not: "x" } }` evaluates instead of throwing, which real Prisma
    // rejects. Only `not` is affected, and no production query uses it on a
    // relation. Relation filters built from real columns still throw above.
  })

  it("throws on a filter it cannot honour instead of matching nothing", () => {
    expect(() => matchWhere({ id: "a" }, { author: { reputation: { gt: 1 } } })).toThrow(/relation filters/)
    expect(() => matchWhere({ id: "a" }, { id: { bogus: 1 } })).toThrow(/unsupported nested filter/)
  })
})

describe("fake-prisma: storage semantics", () => {
  beforeEach(() => resetFakeDb())

  it("applies atomic increment/decrement", async () => {
    fakeDb.seed("socialPost", { id: "p1", totalVotes: 3 })
    await fakeDb.client.socialPost.update({
      where: { id: "p1" },
      data: { totalVotes: { increment: 2 } },
    })
    await fakeDb.client.socialPost.update({
      where: { id: "p1" },
      data: { totalVotes: { decrement: 5 } },
    })
    expect(fakeDb.rows("socialPost")[0].totalVotes).toBe(0)
  })

  it("honours select projection", async () => {
    fakeDb.seed("socialPost", { id: "p1", content: "hi", totalVotes: 7, authorId: "u1" })
    const found = await fakeDb.client.socialPost.findUnique({
      where: { id: "p1" },
      select: { totalVotes: true, authorId: true },
    })
    expect(found).toEqual({ totalVotes: 7, authorId: "u1" })
  })

  it("rolls the table back when the transaction callback throws", async () => {
    fakeDb.seed("socialPost", { id: "p1", totalVotes: 1 })
    await expect(
      fakeDb.client.$transaction(async (tx: FakePrismaClient) => {
        await tx.socialPost.update({ where: { id: "p1" }, data: { totalVotes: { increment: 9 } } })
        throw new Error("boom")
      }),
    ).rejects.toThrow("boom")
    expect(fakeDb.rows("socialPost")[0].totalVotes).toBe(1)
  })

  it("rejects raw SQL loudly", async () => {
    await expect(fakeDb.client.$queryRawUnsafe("SELECT 1")).rejects.toThrow(/raw SQL/)
  })

  it("throws P2025-style when updating a row that does not exist", async () => {
    await expect(
      fakeDb.client.socialPost.update({ where: { id: "missing" }, data: { totalVotes: 1 } }),
    ).rejects.toThrow(/requires a record that does not exist/)
  })
})

describe("fake-prisma: injection replaces the real client", () => {
  beforeEach(() => resetFakeDb())

  it("serves a seeded row through the module-level prisma import", async () => {
    const { default: prisma } = await import("@/lib/db")
    fakeDb.seed("socialPost", { id: "p1", content: "hello", totalVotes: 0, authorId: "u1" })
    const found = await (prisma as unknown as FakePrismaClient).socialPost.findUnique({
      where: { id: "p1" },
      select: { content: true },
    })
    expect(found).toEqual({ content: "hello" })
  })
})
