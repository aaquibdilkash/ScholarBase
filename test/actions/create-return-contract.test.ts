/**
 * RULE 1 — the create-action return contract, across every content module.
 *
 * RULE 1 requires every server action to return the COMPLETE newly created
 * object as `{ success: true, data }`, because the client splices it into the
 * cached list with `queryClient.setQueryData`. An action that returns
 * `{ success: true }` with no `data` still "succeeds", so nothing fails
 * loudly — the row simply never appears until a refetch, which looks like a
 * phantom bug report.
 *
 * This is written as ONE data-driven file on purpose. 18 hand-written
 * per-module suites would assert the same four things 18 times and then drift
 * apart, which is the same duplication that produced the dead `feed-stitch.ts`.
 *
 * The transaction-layer behaviour of these same entities (counters, reputation
 * reversal, tombstones) is already covered in `test/transactions/`. This file
 * deliberately asserts only the *return shape*, so the two suites cannot
 * overlap.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";

import { createSocialPost } from "@/app/actions/feed";
import { createArticle } from "@/app/actions/blog";
import { createPublication } from "@/app/actions/publications";
import { createHelpPost } from "@/app/actions/help";
import { createJobVacancy } from "@/app/actions/vacancies";
import { createPhdAdmission } from "@/app/actions/admissions";
import { createResearchEvent } from "@/app/actions/events";
import { createResearchGrant } from "@/app/actions/grants";
import { createResearchTool } from "@/app/actions/researchTools";
import { createCourse } from "@/app/actions/courses";
import { createJournal } from "@/app/actions/journals";
import { createResult } from "@/app/actions/results";
import { createContribution } from "@/app/actions/contributions";
import { createSupervisor } from "@/app/actions/supervisors";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const AUTHOR = "u-author";
let mockCurrentUser: { id: string } | null = null;
let mockIsAdmin = false;

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => mockCurrentUser),
  requireCurrentUser: vi.fn(async () => {
    if (!mockCurrentUser) throw new Error("Not logged in");
    return mockCurrentUser;
  }),
  requireActiveUser: vi.fn(async () => {
    if (!mockCurrentUser) throw new Error("Not logged in");
    return mockCurrentUser;
  }),
  getActiveUser: vi.fn(async () => {
    if (!mockCurrentUser) throw new Error("Not logged in");
    return { user: mockCurrentUser, frozen: false, message: "" };
  }),
  isAuthorizedOrAdmin: vi.fn(async () => true),
  isUserAdmin: vi.fn(async () => mockIsAdmin),
}));

vi.mock("@/lib/tri-split/modules/registry", () => ({
  revalidateContent: vi.fn(),
  loadContentPage: vi.fn(async () => []),
}));
vi.mock("@/lib/tri-split/modules/survey", () => ({ revalidateSurvey: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  enforceRateLimit: vi.fn(async () => {}),
  RATE_LIMIT_ERROR: "Rate limit exceeded",
}));
vi.mock("@/lib/cloudinary", () => ({
  deleteCloudinaryAsset: vi.fn(async () => {}),
  promoteDraftCloudinaryAsset: vi.fn(async () => null),
  extractCloudinaryPublicId: vi.fn(() => null),
}));
vi.mock("@/lib/qstash", () => ({ queueNotification: vi.fn(async () => {}) }));
vi.mock("@/lib/notifications", () => ({
  notifyFollowersOfActivity: vi.fn(async () => {}),
  notifyMentionedUsers: vi.fn(async () => {}),
  notifyUserById: vi.fn(async () => {}),
  resolveMentionedUsers: vi.fn(async () => []),
}));

/** Valid external URL — the URL guards reject bare strings. */
const URL_FIELD = { value: "https://example.org/apply" };

const SPECS = [
  {
    name: "SocialPost (feed)",
    model: "socialPost",
    create: createSocialPost,
    fields: { content: "Hello world" },
    expectRow: { content: "Hello world" },
  },
  {
    name: "Article (blog)",
    model: "article",
    create: createArticle,
    fields: { title: "Research blog", content: "<p>Body</p>" },
    expectRow: { title: "Research blog" },
  },
  {
    name: "Publication",
    model: "publication",
    create: createPublication,
    fields: {
      title: "Paper title",
      publicationType: "JOURNAL_ARTICLE",
      // Publications require at least one LINKED ScholarBase author, so this
      // one needs `authorIds` naming the seeded user.
      authorIds: AUTHOR,
    },
    expectRow: { title: "Paper title" },
  },
  {
    name: "HelpPost",
    model: "helpPost",
    create: createHelpPost,
    fields: {
      title: "Help needed",
      subject: "Question",
      category: "GENERAL",
      message: "<p>Details</p>",
    },
    expectRow: { title: "Help needed" },
  },
  {
    name: "JobVacancy",
    model: "jobVacancy",
    create: createJobVacancy,
    fields: {
      title: "Postdoc open",
      institution: "Oxford",
      description: "<p>Role</p>",
      deadline: "2030-01-01",
      notificationLink: URL_FIELD.value,
      applyLink: URL_FIELD.value,
    },
    expectRow: { title: "Postdoc open" },
  },
  {
    name: "PhdAdmission",
    model: "phdAdmission",
    create: createPhdAdmission,
    fields: {
      university: "Oxford",
      program: "PhD",
      description: "<p>Program</p>",
      deadline: "2030-01-01",
      notificationLink: URL_FIELD.value,
      applyLink: URL_FIELD.value,
    },
    expectRow: { university: "Oxford" },
  },
  {
    name: "ResearchEvent",
    model: "researchEvent",
    create: createResearchEvent,
    fields: {
      title: "AI Conf",
      description: "<p>Event</p>",
      startDate: "2030-01-01",
      notificationLink: URL_FIELD.value,
      applyLink: URL_FIELD.value,
    },
    expectRow: { title: "AI Conf" },
  },
  {
    name: "ResearchGrant",
    model: "researchGrant",
    create: createResearchGrant,
    fields: {
      title: "ERC Grant",
      description: "<p>Grant</p>",
      applyLink: URL_FIELD.value,
    },
    expectRow: { title: "ERC Grant" },
  },
  {
    name: "ResearchTool",
    model: "researchTool",
    create: createResearchTool,
    fields: {
      name: "LabTool",
      website: URL_FIELD.value,
      description: "<p>Tool</p>",
    },
    expectRow: { name: "LabTool" },
  },
  {
    name: "Course",
    model: "course",
    create: createCourse,
    fields: {
      title: "Quantum 101",
      provider: "MIT",
      description: "<p>Course</p>",
    },
    expectRow: { title: "Quantum 101" },
  },
  {
    name: "Journal",
    model: "journal",
    create: createJournal,
    fields: { title: "Nature", description: "<p>Journal</p>" },
    expectRow: { title: "Nature" },
  },
  {
    name: "Result",
    model: "result",
    create: createResult,
    fields: {
      title: "Key result",
      description: "<p>Result</p>",
      type: "OTHER",
    },
    expectRow: { title: "Key result" },
  },
  {
    name: "Contribution",
    model: "contribution",
    create: createContribution,
    fields: { title: "Contribution", message: "<p>Body</p>" },
    expectRow: { title: "Contribution" },
  },
  {
    name: "Supervisor",
    model: "supervisor",
    create: createSupervisor,
    fields: {
      name: "Dr Ada",
      university: "Oxford",
      department: "CS",
      about: "<p>Bio</p>",
    },
    expectRow: { name: "Dr Ada" },
  },
] as const;

const formOf = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.append(key, value);
  return fd;
};

/**
 * Narrows an action result to its `data` payload.
 *
 * Every create action returns a union (success | failure), so `data` is only
 * present on the success branch. Asserting first means a failure surfaces as a
 * readable message instead of a downstream `undefined` type error — and it
 * keeps each test's real assertion (`data` is the row) explicit.
 */
const created = (result: { success: boolean; data?: unknown }) => {
  expect(result.success).toBe(true);
  expect(result.data).toBeDefined();
  return result.data as Record<string, unknown>;
};

describe("RULE 1: create actions return the complete new object", () => {
  beforeEach(() => {
    resetFakeDb();
    mockCurrentUser = { id: AUTHOR };
    mockIsAdmin = false;
    fakeDb.seed("user", [
      {
        id: AUTHOR,
        reputation: 0,
        // `resolvePublicationPeople` filters authors by `isDeleted: false`, so
        // the fixture has to be explicit rather than relying on a default.
        isDeleted: false,
        name: "Author",
        handle: "author",
      },
    ]);
  });

  for (const spec of SPECS) {
    describe(spec.name, () => {
      it("returns success:true with the created row as `data`", async () => {
        const result = await spec.create(formOf(spec.fields));

        // The whole point of RULE 1: `data` must be present and must be the
        // row, not a bare id or a void.
        const data = created(result);
        expect(typeof data).toBe("object");
        expect(data).not.toBeNull();
      });

      it("returns an `id` that matches the row it actually wrote", async () => {
        const data = created(await spec.create(formOf(spec.fields)));

        const rows = fakeDb.rows(spec.model);
        expect(rows).toHaveLength(1);
        expect(data.id).toBe(rows[0].id);
        // A returned id that is not in the database would make the client's
        // optimistic insert point at a row that does not exist.
        expect(String(data.id).length).toBeGreaterThan(0);
      });

      it("returns the fields the caller just submitted", async () => {
        const data = created(await spec.create(formOf(spec.fields)));

        for (const [key, value] of Object.entries(spec.expectRow)) {
          expect(data[key]).toBe(value);
        }
      });

      it("attributes the new row to the session user, not a client argument", async () => {
        await spec.create(formOf(spec.fields));
        const [row] = fakeDb.rows(spec.model);
        expect(row.authorId).toBe(AUTHOR);
      });

      it("grants no reputation for merely creating content", async () => {
        // RULE 3: reputation comes only from community votes. If creation ever
        // starts granting a bonus, the reversal maths in
        // `deletion-reversal.test.ts` silently becomes wrong.
        await spec.create(formOf(spec.fields));
        const author = fakeDb.rows("user").find((u) => u.id === AUTHOR)!;
        expect(author.reputation).toBe(0);
      });

      it("rejects an anonymous caller instead of creating a row", async () => {
        mockCurrentUser = null;
        await expect(spec.create(formOf(spec.fields))).rejects.toThrow();
        expect(fakeDb.rows(spec.model)).toHaveLength(0);
      });
    });
  }
});
