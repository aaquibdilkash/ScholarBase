import { beforeEach, describe, expect, it, vi } from "vitest"
import { VoteType } from "@prisma/client"
import { fakeDb, resetFakeDb } from "../fake-prisma"
import {
  COMMENT_TYPE_TO_MODULE,
  ENTITY_CONFIG,
  handleCommentVoteTransaction,
} from "@/lib/transactions"
import type { CommentEntityType } from "@/types/comments"

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance")
  return { default: fakeDb.client }
})

vi.mock("@/lib/auth", () => ({
  isUserAdmin: vi.fn(async () => false),
  getCurrentUser: vi.fn(async () => null),
}))

const AUTHOR = "u-author"
const VOTER = "u-voter"
const COMMENT_ID = "c-1"
const PARENT_ENTITY_ID = "e-1"

type Scenario = {
  existing: VoteType | null
  next: VoteType
  delta: number
  label: string
}

const MATRIX: Scenario[] = [
  { existing: null, next: VoteType.UPVOTE, delta: 1, label: "fresh upvote" },
  { existing: null, next: VoteType.DOWNVOTE, delta: -1, label: "fresh downvote" },
  { existing: VoteType.UPVOTE, next: VoteType.UPVOTE, delta: -1, label: "upvote toggled off" },
  { existing: VoteType.DOWNVOTE, next: VoteType.DOWNVOTE, delta: 1, label: "downvote toggled off" },
  { existing: VoteType.UPVOTE, next: VoteType.DOWNVOTE, delta: -2, label: "upvote flipped to downvote" },
  { existing: VoteType.DOWNVOTE, next: VoteType.UPVOTE, delta: 2, label: "downvote flipped to upvote" },
]

const ALL_TYPES = Object.keys(COMMENT_TYPE_TO_MODULE) as CommentEntityType[]

function seedScenario(commentType: CommentEntityType, scenario: Scenario, startAt = 10) {
  const moduleKey = COMMENT_TYPE_TO_MODULE[commentType]
  const config = ENTITY_CONFIG[moduleKey]

  fakeDb.seed("user", [
    { id: AUTHOR, reputation: startAt },
    { id: VOTER, reputation: startAt },
  ])

  fakeDb.seed(config.model, {
    id: PARENT_ENTITY_ID,
    isFrozen: false,
  })

  fakeDb.seed(config.commentModel, {
    id: COMMENT_ID,
    [config.commentFk]: PARENT_ENTITY_ID,
    content: "A helpful comment",
    totalVotes: startAt,
    authorId: AUTHOR,
    isFrozen: false,
  })

  if (scenario.existing) {
    fakeDb.seed(config.commentVoteModel, {
      id: "v-pre",
      commentId: COMMENT_ID,
      userId: VOTER,
      voteType: scenario.existing,
    })
  }
}

describe("RULE 3: Comment voting matrix across all 17 entity types", () => {
  beforeEach(() => resetFakeDb())

  for (const commentType of ALL_TYPES) {
    const moduleKey = COMMENT_TYPE_TO_MODULE[commentType]
    const config = ENTITY_CONFIG[moduleKey]

    describe(`${commentType} -> ${moduleKey}`, () => {
      for (const scenario of MATRIX) {
        it(`${scenario.label}: totalVotes and author reputation move by ${scenario.delta}`, async () => {
          const START = 10
          seedScenario(commentType, scenario, START)

          const result = await handleCommentVoteTransaction(
            COMMENT_ID,
            VOTER,
            scenario.next,
            commentType,
          )

          const expectedTotal = START + scenario.delta
          expect(result.totalVotes).toBe(expectedTotal)

          const comments = fakeDb.rows(config.commentModel)
          expect(comments[0].totalVotes).toBe(expectedTotal)

          const users = fakeDb.rows("user")
          const author = users.find((u) => u.id === AUTHOR)!
          const voter = users.find((u) => u.id === VOTER)!
          expect(author.reputation).toBe(START + scenario.delta)
          expect(voter.reputation).toBe(START)

          const votes = fakeDb.rows(config.commentVoteModel)
          if (scenario.existing === scenario.next) {
            expect(result.userVote).toBeNull()
            expect(votes).toHaveLength(0)
          } else {
            expect(result.userVote).toBe(scenario.next)
            expect(votes).toHaveLength(1)
            expect(votes[0].voteType).toBe(scenario.next)
          }

          const activities = fakeDb.rows("userActivity")
          expect(activities).toHaveLength(1)
          expect(activities[0].action).toBe("VOTED")
          expect(activities[0].moduleType).toBe(`${moduleKey}_COMMENT`)
          expect(activities[0].entityId).toBe(COMMENT_ID)
        })
      }

      it("blocks voting when the comment is frozen", async () => {
        seedScenario(commentType, MATRIX[0])
        const comment = fakeDb.rows(config.commentModel)[0]
        comment.isFrozen = true

        await expect(
          handleCommentVoteTransaction(COMMENT_ID, VOTER, VoteType.UPVOTE, commentType),
        ).rejects.toThrow(/frozen by moderators/)

        const calls = fakeDb.calls()
        const writes = calls.filter((c) =>
          ["create", "update", "delete", "upsert"].includes(c.op),
        )
        expect(writes).toHaveLength(0)
      })

      it("blocks voting when the parent entity discussion is frozen", async () => {
        seedScenario(commentType, MATRIX[0])
        const parent = fakeDb.rows(config.model)[0]
        parent.isFrozen = true

        await expect(
          handleCommentVoteTransaction(COMMENT_ID, VOTER, VoteType.UPVOTE, commentType),
        ).rejects.toThrow(/discussion is frozen/)

        const calls = fakeDb.calls()
        const writes = calls.filter((c) =>
          ["create", "update", "delete", "upsert"].includes(c.op),
        )
        expect(writes).toHaveLength(0)
      })

      it("rejects an author who votes on their own comment with zero writes", async () => {
        seedScenario(commentType, MATRIX[0])

        await expect(
          handleCommentVoteTransaction(COMMENT_ID, AUTHOR, VoteType.UPVOTE, commentType),
        ).rejects.toThrow(/own comment/)

        const comments = fakeDb.rows(config.commentModel)
        expect(comments[0].totalVotes).toBe(10)
        const users = fakeDb.rows("user")
        expect(users.find((u) => u.id === AUTHOR)!.reputation).toBe(10)
        const calls = fakeDb.calls()
        const writes = calls.filter((c) =>
          ["create", "update", "delete", "upsert"].includes(c.op),
        )
        expect(writes).toHaveLength(0)
      })
    })
  }

  it("throws when the comment does not exist", async () => {
    fakeDb.seed("user", [{ id: VOTER, reputation: 10 }])
    await expect(
      handleCommentVoteTransaction("non-existent-comment", VOTER, VoteType.UPVOTE, "post"),
    ).rejects.toThrow(/Comment not found/)
  })

  it("throws on an unknown comment entity type", async () => {
    await expect(
      handleCommentVoteTransaction(COMMENT_ID, VOTER, VoteType.UPVOTE, "unknown" as CommentEntityType),
    ).rejects.toThrow(/Invalid module for comment voting/)
  })
})
