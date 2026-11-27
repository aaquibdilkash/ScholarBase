/**
 * `GET /api/surveys/[id]/export` — the export trigger endpoint.
 *
 * The endpoint no longer streams a file. It validates access, creates an
 * ExportJob, enqueues it on QStash, and returns 202 + { jobId }. The file is
 * produced asynchronously by the job worker and downloaded via a signed URL.
 *
 * The workbook builders and the anonymisation logic are covered elsewhere
 * (export-xlsx.test.ts, export-analysis.test.ts, redact-identity.test.ts). What
 * is untested-able-but-critical here is the GATE in front of the queue:
 *
 *   - an unauthenticated request must never reach the database,
 *   - a non-owner may download ONLY when the author enabled `shareData`,
 *   - rate-limit and not-found handling.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";

const OWNER = "u-owner";
const STRANGER = "u-stranger";
const ADMIN = "u-admin";
const SURVEY = "survey-1";

let sessionUser: { id: string } | null = null;
let isAdmin = false;
let rateLimitAllowed = true;

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});
vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: sessionUser } }) },
  }),
}));
vi.mock("@/lib/auth", () => ({
  isUserAdmin: vi.fn(async () => isAdmin),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({
    allowed: rateLimitAllowed,
    degraded: false,
  })),
  RATE_LIMIT_ERROR: "Too many requests. Please slow down.",
  RATE_LIMIT_DEGRADED_ERROR: "Service temporarily unavailable.",
}));
vi.mock("@/lib/exports/qstash", () => ({
  queueExportJob: vi.fn(async () => {}),
}));

/** A survey with two questions and two responses, one of them anonymous. */
function seedSurvey(overrides: Record<string, unknown> = {}) {
  fakeDb.seed("researchSurvey", {
    id: SURVEY,
    authorId: OWNER,
    title: "Researcher workload survey",
    privacy: "HYBRID",
    shareData: false,
    isDeleted: false,
    questions: [
      {
        id: "q_field",
        type: "MULTIPLE_CHOICE",
        title: "Which field?",
        required: true,
        order: 0,
        minValue: null,
        maxValue: null,
        archivedAt: null,
        shuffleOptions: false,
        skipLogic: null,
        columnLabels: null,
        options: [
          { id: "o1", value: "cs", label: "Computer Science", order: 0 },
          { id: "o2", value: "bio", label: "Biology", order: 1 },
        ],
      },
    ],
    ...overrides,
  });

  for (const respondent of [
    { id: OWNER, handle: "owner" },
    { id: STRANGER, handle: "stranger" },
  ]) {
    fakeDb.seed("user", {
      id: respondent.id,
      name: respondent.id,
      handle: respondent.handle,
      isDeleted: false,
      isFrozen: false,
      isAdmin: respondent.id === ADMIN,
    });
  }

  fakeDb.seed("surveyResponse", [
    {
      id: "r1",
      surveyId: SURVEY,
      respondentId: OWNER,
      isAnonymous: false,
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
      editedAt: null,
      startedAt: new Date("2026-03-01T09:55:00.000Z"),
      completedAt: new Date("2026-03-01T10:00:00.000Z"),
      consentedAt: null,
      randomizationSeed: null,
      respondent: { name: "Owner", handle: "owner" },
      answers: [{ questionId: "q_field", value: "cs" }],
    },
    {
      id: "r2",
      surveyId: SURVEY,
      respondentId: STRANGER,
      isAnonymous: true,
      createdAt: new Date("2026-03-02T10:00:00.000Z"),
      editedAt: null,
      startedAt: new Date("2026-03-02T09:55:00.000Z"),
      completedAt: new Date("2026-03-02T10:00:00.000Z"),
      consentedAt: null,
      randomizationSeed: null,
      respondent: { name: "Stranger", handle: "stranger" },
      answers: [{ questionId: "q_field", value: "bio" }],
    },
  ]);
}

const download = (format?: string, id = SURVEY) => {
  const query = format ? `?format=${format}` : "";
  return import("@/app/api/surveys/[id]/export/route").then(({ GET }) =>
    GET(
      new Request(`https://sb.test/api/surveys/${id}/export${query}`),
      { params: Promise.resolve({ id }) },
    ),
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  resetFakeDb();
  sessionUser = { id: OWNER };
  isAdmin = false;
  rateLimitAllowed = true;
  seedSurvey();
});

describe("access control", () => {
  it("refuses an unauthenticated request", async () => {
    sessionUser = null;
    const response = await download();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("never queries the survey table for an anonymous caller", async () => {
    sessionUser = null;
    resetFakeDb();
    seedSurvey();
    await download();
    const surveyCalls = fakeDb.calls().filter((call) => call.model === "researchSurvey");
    expect(surveyCalls).toEqual([]);
  });

  it("404s for a survey that does not exist", async () => {
    const response = await download(undefined, "missing-survey");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });

  it("403s a non-owner when the author has not enabled sharing", async () => {
    sessionUser = { id: STRANGER };
    const response = await download();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });

  it("allows the owner regardless of shareData", async () => {
    const response = await download();
    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.status).toBe("queued");
    expect(typeof body.jobId).toBe("string");
  });

  it("allows an admin regardless of shareData", async () => {
    sessionUser = { id: ADMIN };
    isAdmin = true;
    const response = await download();
    expect(response.status).toBe(202);
  });

  it("allows a non-owner once the author enables sharing", async () => {
    sessionUser = { id: STRANGER };
    fakeDb.rows("researchSurvey")[0].shareData = true;
    const response = await download();
    expect(response.status).toBe(202);
  });

  it("rejects an invalid format", async () => {
    const response = await download("pdf");
    expect(response.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    rateLimitAllowed = false;
    const response = await download();
    expect(response.status).toBe(429);
  });

  it("returns 503 when degraded", async () => {
    // override mock to degraded
    const { checkRateLimit } = await import("@/lib/rate-limit");
    (checkRateLimit as unknown as { mockResolvedValueOnce: (v: unknown) => unknown }).mockResolvedValueOnce({
      allowed: false,
      degraded: true,
    });
    const response = await download();
    expect(response.status).toBe(503);
  });
});
