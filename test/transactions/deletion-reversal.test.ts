import { beforeEach, describe, expect, it, vi } from "vitest"
import { fakeDb, resetFakeDb } from "../fake-prisma"
import { deleteSocialPost } from "@/app/actions/feed"
import { deleteArticle } from "@/app/actions/blog"
import { deletePublication } from "@/app/actions/publications"
import { deleteHelpPost } from "@/app/actions/help"
import { deleteJobVacancy } from "@/app/actions/vacancies"
import { deletePhdAdmission } from "@/app/actions/admissions"
import { deleteResearchEvent } from "@/app/actions/events"
import { deleteResearchGrant } from "@/app/actions/grants"
import { deleteResearchTool } from "@/app/actions/researchTools"
import { deleteCourse } from "@/app/actions/courses"
import { deleteJournal } from "@/app/actions/journals"
import { deleteResult } from "@/app/actions/results"
import { deleteContribution } from "@/app/actions/contributions"
import { deleteSurvey } from "@/app/actions/surveys"
import { deleteSupervisor } from "@/app/actions/supervisors"
import { deleteRecommendation } from "@/app/actions/recommendations"
import { deleteJournalReview } from "@/app/actions/journalReviews"

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance")
  return { default: fakeDb.client }
})

let mockCurrentUser: { id: string } | null = null
let mockIsAdmin = false

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => mockCurrentUser),
  requireCurrentUser: vi.fn(async () => {
    if (!mockCurrentUser) throw new Error("Not logged in")
    return mockCurrentUser
  }),
  requireActiveUser: vi.fn(async () => {
    if (!mockCurrentUser) throw new Error("Not logged in")
    return mockCurrentUser
  }),
  getActiveUser: vi.fn(async () => {
    if (!mockCurrentUser) throw new Error("Not logged in")
    return { user: mockCurrentUser, frozen: false }
  }),
  isUserAdmin: vi.fn(async () => mockIsAdmin),
}))

// Mock revalidations
vi.mock("@/lib/tri-split/modules/feed", () => ({ revalidatePublicFeed: vi.fn() }))
vi.mock("@/lib/tri-split/modules/article", () => ({ revalidateArticles: vi.fn() }))
vi.mock("@/lib/tri-split/modules/registry", () => ({ revalidateContent: vi.fn() }))
vi.mock("@/lib/tri-split/modules/survey", () => ({ revalidateSurvey: vi.fn() }))
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  enforceRateLimit: vi.fn(async () => {}),
  RATE_LIMIT_ERROR: "Rate limit exceeded",
}))
vi.mock("@/lib/cloudinary", () => ({
  deleteCloudinaryAsset: vi.fn(async () => {}),
  promoteDraftCloudinaryAsset: vi.fn(async () => null),
  extractCloudinaryPublicId: vi.fn(() => null),
}))
vi.mock("@/lib/qstash", () => ({
  queueNotification: vi.fn(async () => {}),
}))

const AUTHOR = "u-author"
const ADMIN = "u-admin"
const STRANGER = "u-stranger"
const INITIAL_REP = 100

describe("RULE 3 & RULE 4: Top-level entity deletion and reputation reversal across all 17 entities", () => {
  beforeEach(() => {
    resetFakeDb()
    mockCurrentUser = { id: AUTHOR }
    mockIsAdmin = false
  })

  const ENTITY_SPECS = [
    {
      name: "SocialPost (feed)",
      model: "socialPost",
      counter: "socialPostCount",
      deleter: (id: string) => deleteSocialPost(id),
      seedExtra: { content: "Hello world" },
    },
    {
      name: "Article (blog)",
      model: "article",
      counter: "articleCount",
      deleter: (id: string) => deleteArticle(id),
      seedExtra: { title: "Research blog", slug: "res-blog" },
    },
    {
      name: "Publication",
      model: "publication",
      counter: "publicationCount",
      deleter: (id: string) => deletePublication(id),
      seedExtra: { title: "Paper title" },
    },
    {
      name: "HelpPost",
      model: "helpPost",
      counter: "helpPostCount",
      deleter: (id: string) => deleteHelpPost(id),
      seedExtra: { title: "Help needed" },
    },
    {
      name: "JobVacancy",
      model: "jobVacancy",
      counter: "jobVacancyCount",
      deleter: (id: string) => deleteJobVacancy(id),
      seedExtra: { title: "Postdoc open" },
    },
    {
      name: "PhdAdmission",
      model: "phdAdmission",
      counter: "phdAdmissionCount",
      deleter: (id: string) => deletePhdAdmission(id),
      seedExtra: { university: "Oxford" },
    },
    {
      name: "ResearchEvent",
      model: "researchEvent",
      counter: "researchEventCount",
      deleter: (id: string) => deleteResearchEvent(id),
      seedExtra: { title: "AI Conf" },
    },
    {
      name: "ResearchGrant",
      model: "researchGrant",
      counter: "researchGrantCount",
      deleter: (id: string) => deleteResearchGrant(id),
      seedExtra: { title: "ERC Grant" },
    },
    {
      name: "ResearchTool",
      model: "researchTool",
      counter: "researchToolCount",
      deleter: (id: string) => deleteResearchTool(id),
      seedExtra: { name: "LabTool" },
    },
    {
      name: "Course",
      model: "course",
      counter: "courseCount",
      deleter: (id: string) => deleteCourse(id),
      seedExtra: { title: "Quantum 101" },
    },
    {
      name: "Journal",
      model: "journal",
      counter: "journalCount",
      deleter: (id: string) => deleteJournal(id),
      seedExtra: { title: "Nature Fake" },
    },
    {
      name: "Result",
      model: "result",
      counter: "resultCount",
      deleter: (id: string) => deleteResult(id),
      seedExtra: { title: "Benchmark Result" },
    },
    {
      name: "Contribution",
      model: "contribution",
      counter: "contributionCount",
      deleter: (id: string) => deleteContribution(id),
      seedExtra: { title: "Dataset Share" },
    },
    {
      name: "Survey",
      model: "researchSurvey",
      counter: "surveyCount",
      deleter: (id: string) => deleteSurvey(id),
      seedExtra: { title: "Academic Survey" },
    },
    {
      name: "Supervisor",
      model: "supervisor",
      counter: "supervisorCount",
      deleter: (id: string) => deleteSupervisor(id),
      seedExtra: { name: "Prof Smith" },
    },
    {
      name: "Recommendation",
      model: "recommendation",
      counter: null,
      deleter: (id: string) => deleteRecommendation(id),
      seedExtra: { feedback: "Great mentor", supervisorId: "sup-1" },
      seedDependencies: () => {
        fakeDb.seed("supervisor", { id: "sup-1", name: "Prof Smith", recommendationCount: 5 })
      },
    },
    {
      name: "JournalReview",
      model: "journalReview",
      counter: null,
      deleter: (id: string) => deleteJournalReview(id),
      seedExtra: { feedback: "Fast review turnaround", journalId: "j-1", rating: 4 },
      seedDependencies: () => {
        fakeDb.seed("journal", { id: "j-1", title: "Nature Fake", reviewCount: 5, ratingSum: 20 })
      },
    },
  ]

  for (const spec of ENTITY_SPECS) {
    describe(spec.name, () => {
      it("reverses all accumulated totalVotes (no creation bonus), soft-deletes row", async () => {
        const ENTITY_ID = `entity-${spec.model}`
        const VOTES = 7

        fakeDb.seed("user", [
          {
            id: AUTHOR,
            reputation: INITIAL_REP,
            ...(spec.counter ? { [spec.counter]: 3 } : {}),
          },
        ])

        if (spec.seedDependencies) spec.seedDependencies()

        fakeDb.seed(spec.model, {
          id: ENTITY_ID,
          authorId: AUTHOR,
          totalVotes: VOTES,
          isDeleted: false,
          ...spec.seedExtra,
        })

        const res = await spec.deleter(ENTITY_ID)
        expect(res).toBeDefined()

        // 1. Soft delete verified (RULE 4)
        const row = fakeDb.rows(spec.model)[0]
        expect(row.isDeleted).toBe(true)

        // 2. Author reputation reversed by vote total only (creation grants
        // no reputation, so there is no +1 to reverse).
        const author = fakeDb.rows("user").find((u) => u.id === AUTHOR)!
        const expectedDeduction = VOTES
        expect(author.reputation).toBe(INITIAL_REP - expectedDeduction)

        // 3. Counter decremented if applicable
        if (spec.counter) {
          expect(author[spec.counter]).toBe(2)
        }
      })

      it("leaves reputation untouched when totalVotes === 0", async () => {
        const ENTITY_ID = `entity-zero-${spec.model}`
        fakeDb.seed("user", [
          {
            id: AUTHOR,
            reputation: INITIAL_REP,
            ...(spec.counter ? { [spec.counter]: 1 } : {}),
          },
        ])

        if (spec.seedDependencies) spec.seedDependencies()

        fakeDb.seed(spec.model, {
          id: ENTITY_ID,
          authorId: AUTHOR,
          totalVotes: 0,
          isDeleted: false,
          ...spec.seedExtra,
        })

        await spec.deleter(ENTITY_ID)

        const author = fakeDb.rows("user").find((u) => u.id === AUTHOR)!
        expect(author.reputation).toBe(INITIAL_REP)
      })

      it("handles negative totalVotes cleanly during reversal", async () => {
        const ENTITY_ID = `entity-neg-${spec.model}`
        const VOTES = -3
        fakeDb.seed("user", [
          {
            id: AUTHOR,
            reputation: INITIAL_REP,
            ...(spec.counter ? { [spec.counter]: 1 } : {}),
          },
        ])

        if (spec.seedDependencies) spec.seedDependencies()

        fakeDb.seed(spec.model, {
          id: ENTITY_ID,
          authorId: AUTHOR,
          totalVotes: VOTES,
          isDeleted: false,
          ...spec.seedExtra,
        })

        await spec.deleter(ENTITY_ID)

        const author = fakeDb.rows("user").find((u) => u.id === AUTHOR)!
        expect(author.reputation).toBe(INITIAL_REP - VOTES)
      })

      it("rejects deletion by an unauthorized stranger", async () => {
        const ENTITY_ID = `entity-stranger-${spec.model}`
        mockCurrentUser = { id: STRANGER }

        fakeDb.seed("user", [
          { id: AUTHOR, reputation: INITIAL_REP },
          { id: STRANGER, reputation: INITIAL_REP },
        ])

        if (spec.seedDependencies) spec.seedDependencies()

        fakeDb.seed(spec.model, {
          id: ENTITY_ID,
          authorId: AUTHOR,
          totalVotes: 5,
          isDeleted: false,
          ...spec.seedExtra,
        })

        await expect(spec.deleter(ENTITY_ID)).rejects.toThrow()
      })

      it("permits deletion by an admin", async () => {
        const ENTITY_ID = `entity-admin-${spec.model}`
        mockCurrentUser = { id: ADMIN }
        mockIsAdmin = true

        fakeDb.seed("user", [
          { id: AUTHOR, reputation: INITIAL_REP },
          { id: ADMIN, reputation: INITIAL_REP },
        ])

        if (spec.seedDependencies) spec.seedDependencies()

        fakeDb.seed(spec.model, {
          id: ENTITY_ID,
          authorId: AUTHOR,
          totalVotes: 4,
          isDeleted: false,
          ...spec.seedExtra,
        })

        const res = await spec.deleter(ENTITY_ID)
        expect(res).toBeDefined()

        const row = fakeDb.rows(spec.model)[0]
        expect(row.isDeleted).toBe(true)
        expect(row.deletedByType).toBe("ADMIN")
      })
    })
  }
})
