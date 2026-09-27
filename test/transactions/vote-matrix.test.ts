import { beforeEach, describe, expect, it, vi } from "vitest"
import { VoteType } from "@prisma/client"
import { fakeDb, resetFakeDb } from "../fake-prisma"
import { ENTITY_CONFIG, handleVoteTransaction, type ModuleKey } from "@/lib/transactions"

// `transactions.ts` imports the client as `./db`, which resolves to the same
// module id as `@/lib/db`, so this replaces the real client (and the throwing
// proxy installed by test/setup.ts) with the in-memory fake for this file only.
vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance")
  return { default: fakeDb.client }
})

// The vote path never reads admin status, but importing transactions.ts pulls
// in auth.ts, which imports next/headers. Stub it so the module can load.
vi.mock("@/lib/auth", () => ({
  isUserAdmin: vi.fn(async () => false),
  getCurrentUser: vi.fn(async () => null),
}))

const AUTHOR = "u-author"
const VOTER = "u-voter"
const ENTITY_ID = "e-1"

/**
 * Independent transcription of MODULE_VOTE_TARGET_TYPE. Duplicated on purpose:
 * if production changes a target type, this test should fail rather than
 * silently agree with it.
 */
const EXPECTED_TARGET_TYPE: Record<ModuleKey, string> = {
  SOCIAL_POST: "post",
  ARTICLE: "article",
  HELP_POST: "help",
  CONTRIBUTION: "contribution",
  PUBLICATION: "publication",
  RESEARCH_TOOL: "researchTool",
  RESEARCH_GRANT: "researchGrant",
  COURSE: "course",
  JOURNAL: "journal",
  RESULT: "result",
  RESEARCH_SURVEY: "survey",
  RESEARCH_EVENT: "event",
  PHD_ADMISSION: "admission",
  JOB_VACANCY: "vacancy",
  SUPERVISOR: "supervisor",
  RECOMMENDATION: "recommendation",
  JOURNAL_REVIEW: "journalReview",
}

const MODULES = Object.keys(ENTITY_CONFIG) as ModuleKey[]

type Scenario = {
  /** The vote already on the books, or null for a first-time vote. */
  existing: VoteType | null
  /** What the user clicks. */
  next: VoteType
  /** RULE 3: the exact change to totalVotes AND to the author's reputation. */
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

/** Seed one entity of `moduleKey` with a starting counter and optional existing vote. */
function seedScenario(moduleKey: ModuleKey, scenario: Scenario, startAt = 10) {
  const config = ENTITY_CONFIG[moduleKey]

  fakeDb.seed("user", [
    { id: AUTHOR, reputation: startAt },
    { id: VOTER, reputation: startAt },
  ])

  const entity: Record<string, unknown> = {
    id: ENTITY_ID,
    [config.titleField]: `Title of ${moduleKey}`,
    totalVotes: startAt,
    authorId: AUTHOR,
    isFrozen: false,
  }
  // These two modules build a composite notification target id and need their FK.
  if (moduleKey === "RECOMMENDATION") entity.supervisorId = "sup-1"
  if (moduleKey === "JOURNAL_REVIEW") entity.journalId = "j-1"
  fakeDb.seed(config.model, entity)

  if (scenario.existing) {
    fakeDb.seed(config.voteModel, {
      id: "vote-existing",
      [config.parentFk]: ENTITY_ID,
      userId: VOTER,
      voteType: scenario.existing,
    })
  }
}

function entityRow(moduleKey: ModuleKey): Record<string, unknown> {
  return fakeDb.rows(ENTITY_CONFIG[moduleKey].model)[0]
}

function reputationOf(userId: string): number {
  return fakeDb.rows("user").find((row) => row.id === userId)?.reputation as number
}

function voteRowCount(moduleKey: ModuleKey): number {
  return fakeDb.rows(ENTITY_CONFIG[moduleKey].voteModel).length
}

/** Only mutating calls — proves a rejected action leaves the tables untouched. */
function writes() {
  const MUTATING = new Set(["create", "update", "updateMany", "delete", "deleteMany", "upsert"])
  return fakeDb.calls().filter((call) => MUTATING.has(call.op))
}

beforeEach(() => resetFakeDb())

describe.each(MODULES)("RULE 3 vote matrix — %s", (moduleKey) => {
  it.each(MATRIX.map((scenario) => [scenario.label, scenario] as const))(
    "%s moves totalVotes and author reputation by the same amount",
    async (_label, scenario) => {
      const startAt = 10
      seedScenario(moduleKey, scenario, startAt)

      const result = await handleVoteTransaction(moduleKey, ENTITY_ID, VOTER, scenario.next)

      // 1 vote === 1 rep, in lockstep, for every transition.
      expect(entityRow(moduleKey).totalVotes).toBe(startAt + scenario.delta)
      expect(reputationOf(AUTHOR)).toBe(startAt + scenario.delta)
      expect(result.totalVotes).toBe(startAt + scenario.delta)

      // Toggling the same vote off must delete the row; anything else keeps one.
      const toggledOff = scenario.existing === scenario.next
      expect(voteRowCount(moduleKey)).toBe(toggledOff ? 0 : 1)
      expect(result.userVote).toBe(toggledOff ? null : scenario.next)

      // The voter's own reputation is never touched by voting.
      expect(reputationOf(VOTER)).toBe(startAt)
    },
  )
})

describe("vote transaction: guard rails", () => {
  it("rejects an unknown module without touching the database", async () => {
    await expect(
      handleVoteTransaction("NOT_A_MODULE" as ModuleKey, ENTITY_ID, VOTER, VoteType.UPVOTE),
    ).rejects.toThrow(/Invalid module for voting/)
    expect(fakeDb.calls()).toHaveLength(0)
  })

  it("rejects a missing entity and performs no writes", async () => {
    await expect(
      handleVoteTransaction("SOCIAL_POST", "nope", VOTER, VoteType.UPVOTE),
    ).rejects.toThrow(/does not exist/)
    expect(writes()).toHaveLength(0)
  })

  it("refuses to vote on frozen content and leaves every counter alone", async () => {
    seedScenario("SOCIAL_POST", { existing: null, next: VoteType.UPVOTE, delta: 0, label: "" })
    entityRow("SOCIAL_POST").isFrozen = true

    await expect(
      handleVoteTransaction("SOCIAL_POST", ENTITY_ID, VOTER, VoteType.UPVOTE),
    ).rejects.toThrow(/frozen by moderators/)

    expect(entityRow("SOCIAL_POST").totalVotes).toBe(10)
    expect(reputationOf(AUTHOR)).toBe(10)
    expect(voteRowCount("SOCIAL_POST")).toBe(0)
  })

  it("records exactly one VOTED activity entry per call", async () => {
    seedScenario("ARTICLE", { existing: null, next: VoteType.UPVOTE, delta: 1, label: "" })
    await handleVoteTransaction("ARTICLE", ENTITY_ID, VOTER, VoteType.UPVOTE)

    const activities = fakeDb.rows("userActivity")
    expect(activities).toHaveLength(1)
    expect(activities[0]).toMatchObject({ userId: VOTER, action: "VOTED", moduleType: "ARTICLE" })
  })
})

describe("vote transaction: upvote notification", () => {
  const freshUp: Scenario = { existing: null, next: VoteType.UPVOTE, delta: 1, label: "up" }
  const freshDown: Scenario = { existing: null, next: VoteType.DOWNVOTE, delta: -1, label: "down" }
  const toggleOffUp: Scenario = {
    existing: VoteType.UPVOTE,
    next: VoteType.UPVOTE,
    delta: -1,
    label: "off",
  }

  it("notifies the author with the module's target type and title", async () => {
    seedScenario("PUBLICATION", freshUp)
    const result = await handleVoteTransaction("PUBLICATION", ENTITY_ID, VOTER, VoteType.UPVOTE)

    expect(result.notification).toMatchObject({
      recipientId: AUTHOR,
      targetType: EXPECTED_TARGET_TYPE.PUBLICATION,
      targetId: ENTITY_ID,
      body: "Title of PUBLICATION",
    })
  })

  it.each(MODULES)("derives the correct target type for %s", async (moduleKey) => {
    seedScenario(moduleKey, freshUp)
    const result = await handleVoteTransaction(moduleKey, ENTITY_ID, VOTER, VoteType.UPVOTE)
    expect(result.notification?.targetType).toBe(EXPECTED_TARGET_TYPE[moduleKey])
  })

  it("nests recommendation notification links under the supervisor id", async () => {
    seedScenario("RECOMMENDATION", freshUp)
    const result = await handleVoteTransaction("RECOMMENDATION", ENTITY_ID, VOTER, VoteType.UPVOTE)
    expect(result.notification?.targetId).toBe(`sup-1/${ENTITY_ID}`)
  })

  it("nests journal-review notification links under the journal id", async () => {
    seedScenario("JOURNAL_REVIEW", freshUp)
    const result = await handleVoteTransaction("JOURNAL_REVIEW", ENTITY_ID, VOTER, VoteType.UPVOTE)
    expect(result.notification?.targetId).toBe(`j-1/${ENTITY_ID}`)
  })

  it("stays silent when the vote value is negative", async () => {
    seedScenario("SOCIAL_POST", freshDown)
    const down = await handleVoteTransaction("SOCIAL_POST", ENTITY_ID, VOTER, VoteType.DOWNVOTE)
    expect(down.notification).toBeUndefined()
  })

  it("stays silent when an upvote is toggled back off", async () => {
    seedScenario("SOCIAL_POST", toggleOffUp)
    const off = await handleVoteTransaction("SOCIAL_POST", ENTITY_ID, VOTER, VoteType.UPVOTE)
    expect(off.notification).toBeUndefined()
  })

  it("does not notify an author who upvotes their own content", async () => {
    seedScenario("SOCIAL_POST", freshUp)
    const result = await handleVoteTransaction("SOCIAL_POST", ENTITY_ID, AUTHOR, VoteType.UPVOTE)
    expect(result.notification).toBeUndefined()
    // A self-upvote still moves the counter and the author's reputation: voting
    // is not restricted to other people. Documented here as current behaviour.
    expect(entityRow("SOCIAL_POST").totalVotes).toBe(11)
    expect(reputationOf(AUTHOR)).toBe(11)
  })

  it("falls back to 'Untitled' when the title field is empty", async () => {
    seedScenario("SOCIAL_POST", freshUp)
    entityRow("SOCIAL_POST").content = ""
    const result = await handleVoteTransaction("SOCIAL_POST", ENTITY_ID, VOTER, VoteType.UPVOTE)
    expect(result.notification?.body).toBe("Untitled")
  })
})


