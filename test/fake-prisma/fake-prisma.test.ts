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

describe("fake-prisma: nested relation writes", () => {
  // These cover the explicit relation registry added for the survey response
  // path (`surveyResponse.create({ answers: { create: [...] } })`). The registry
  // exists so the fake never has to guess Prisma's naming, and these tests are
  // what keep "refuses to guess" a real guarantee rather than a comment.
  beforeEach(() => {
    resetFakeDb()
    fakeDb.link({
      parent: "surveyResponse",
      relation: "answers",
      child: "surveyAnswer",
      fk: "responseId",
    })
    fakeDb.link({
      parent: "surveyAnswer",
      relation: "question",
      child: "surveyQuestion",
      fk: "questionId",
    })
  })

  it("materialises a nested `create` array as real child rows", async () => {
    const response = await fakeDb.client.surveyResponse.create({
      data: {
        surveyId: "s1",
        answers: {
          create: [
            { question: { connect: { id: "q1" } }, value: "Yes" },
            { question: { connect: { id: "q2" } }, value: JSON.stringify(["a", "b"]) },
          ],
        },
      },
    })

    const answers = fakeDb.rows("surveyAnswer")
    expect(answers).toHaveLength(2)
    // The parent's foreign key is stamped on every child.
    expect(answers.map((a) => a.responseId)).toEqual([response.id, response.id])
    // A nested `connect` resolves to the child's own foreign key rather than
    // being stored as a literal `{ connect: ... }` object.
    expect(answers.map((a) => a.questionId)).toEqual(["q1", "q2"])
    expect(answers.map((a) => a.value)).toEqual(["Yes", '["a","b"]'])
    for (const answer of answers) {
      expect(answer).not.toHaveProperty("question")
    }
    // Distinct ids, or a later `connect` would silently match the wrong child.
    expect(new Set(answers.map((a) => a.id)).size).toBe(2)
  })

  it("attaches created children to the parent so `include` reads them back", async () => {
    const response = await fakeDb.client.surveyResponse.create({
      data: { surveyId: "s1", answers: { create: [{ value: "Yes" }] } },
    })
    expect(response.answers).toHaveLength(1)
  })

  it("refuses an undeclared relation rather than guessing the table name", async () => {
    await expect(
      fakeDb.client.publication.create({
        data: { title: "T", coAuthors: { create: [{ userId: "u2" }] } },
      }),
    ).rejects.toThrow(/has no declared relation/)
  })

  it("names the offending relation in the failure, so the fix is obvious", async () => {
    await expect(
      fakeDb.client.publication.create({ data: { mysteryRelation: { create: [{}] } } }),
    ).rejects.toThrow(/publication\.mysteryRelation\.create/)
  })

  it("stores a JSONB answer object verbatim instead of reading it as a relation write", async () => {
    // A MATRIX_LIKERT answer is `{ rowValue: columnIndex }` — a plain object that
    // must reach the database unchanged. If relation detection were "any
    // non-numeric object", this legitimate payload would be refused.
    const matrix = { row_teaching: 3, row_research: 5 }
    await fakeDb.client.surveyResponse.create({
      data: { surveyId: "s1", answers: { create: [{ value: matrix }] } },
    })
    expect(fakeDb.rows("surveyAnswer")[0].value).toEqual(matrix)
  })

  it("still refuses the relation verbs it has never supported", async () => {
    await expect(
      fakeDb.client.surveyResponse.create({ data: { answers: { deleteMany: {} } } }),
    ).rejects.toThrow(/is not\s+supported/)
  })

  it("detaches deleted children from the parent's materialised array", async () => {
    await fakeDb.client.surveyResponse.create({
      data: {
        surveyId: "s1",
        answers: { create: [{ value: "keep" }, { value: "drop" }] },
      },
    })

    // `submitSurveyResponse`'s upsert path deletes the active answers and
    // recreates them. If the parent kept a stale copy, the reloaded response
    // would report twice the answers the database actually holds.
    await fakeDb.client.surveyAnswer.deleteMany({ where: { value: "drop" } })
    const reloaded = await fakeDb.client.surveyResponse.findFirst({
      where: { surveyId: "s1" },
      include: { answers: true },
    })
    expect(reloaded).not.toBeNull()
    const answers = reloaded?.answers as Array<{ value: unknown }>
    expect(answers).toHaveLength(1)
    expect(answers[0].value).toBe("keep")
  })

  it("keeps declared relations across a reset so module-scope wiring survives", async () => {
    resetFakeDb()
    await expect(
      fakeDb.client.surveyResponse.create({ data: { answers: { create: [{ value: "x" }] } } }),
    ).resolves.toBeTruthy()
  })
})

describe("fake-prisma: createMany", () => {
  beforeEach(() => resetFakeDb())

  it("inserts one row per spec and reports the count", async () => {
    const result = await fakeDb.client.surveyQuestion.createMany({
      data: [
        { surveyId: "s1", order: 0, type: "SHORT_TEXT" },
        { surveyId: "s1", order: 1, type: "DATE" },
        { surveyId: "s1", order: 2, type: "RATING" },
      ],
    })
    expect(result).toEqual({ count: 3 })
    expect(fakeDb.rows("surveyQuestion").map((q) => q.order)).toEqual([0, 1, 2])
  })

  it("assigns each row its own id", async () => {
    await fakeDb.client.surveyQuestion.createMany({
      data: [{ surveyId: "s1" }, { surveyId: "s1" }],
    })
    const ids = fakeDb.rows("surveyQuestion").map((q) => q.id)
    expect(new Set(ids).size).toBe(2)
  })

  it("rejects a non-array payload instead of inserting nothing silently", async () => {
    await expect(
      fakeDb.client.surveyQuestion.createMany({ data: { surveyId: "s1" } as never }),
    ).rejects.toThrow(/requires `data` to be an array/)
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
