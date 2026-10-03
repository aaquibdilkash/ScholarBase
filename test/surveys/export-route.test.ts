/**
 * `GET /api/surveys/[id]/export` — the download endpoint itself.
 *
 * The workbook builders are covered elsewhere. What is untested here is the
 * GATE in front of them, and that gate is the part that can leak research data:
 *
 *   - an unauthenticated request must never reach the database,
 *   - a non-owner may download ONLY when the author enabled `shareData`, and
 *   - that shared copy must be force-anonymised, even though the export logic
 *     would happily include identity columns if asked to.
 *
 * So the assertions that matter most are the negative ones: 401, 403, 404, and
 * "200 but with the handles gone". A test that only checks a happy-path 200
 * would pass against an endpoint that handed the whole dataset to anyone.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";
import { NA_SKIPPED } from "@/lib/surveys/export";

const OWNER = "u-owner";
const STRANGER = "u-stranger";
const ADMIN = "u-admin";
const SURVEY = "survey-1";

let sessionUser: { id: string } | null = null;
let isAdmin = false;

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
      isAnonymous: false,
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

/** Every cell of every sheet, flattened — used to search for leaked identity. */
async function cellsOf(response: Response): Promise<string> {
  const buffer = new Uint8Array(await response.arrayBuffer());
  const { readWorkbook } = await import("@/lib/surveys/export-xlsx");
  const workbook = await readWorkbook(buffer.buffer as ArrayBuffer);
  const parts: string[] = [];
  workbook.eachSheet((sheet) => {
    sheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) =>
        parts.push(String(cell.value ?? "")),
      );
    });
  });
  return parts.join("|");
}

beforeEach(() => {
  resetFakeDb();
  sessionUser = { id: OWNER };
  isAdmin = false;
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
    // The refusal must happen before the data is read, not after.
    sessionUser = null;
    resetFakeDb();
    seedSurvey();

    await download();

    const surveyCalls = fakeDb
      .calls()
      .filter((call) => call.model === "researchSurvey");
    expect(surveyCalls).toEqual([]);
  });

  it("404s for a survey that does not exist", async () => {
    const response = await download(undefined, "missing-survey");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });

  it("404s for a soft-deleted survey", async () => {
    // Deleted is treated as absent: the id must not keep serving data.
    fakeDb.rows("researchSurvey")[0].isDeleted = true;

    const response = await download();

    expect(response.status).toBe(404);
  });

  it("403s a non-owner when the author has not enabled sharing", async () => {
    sessionUser = { id: STRANGER };

    const response = await download();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });

  it("allows the owner regardless of shareData", async () => {
    expect((await download()).status).toBe(200);
  });

  it("allows an admin regardless of shareData", async () => {
    sessionUser = { id: ADMIN };
    isAdmin = true;

    expect((await download()).status).toBe(200);
  });

  it("allows a non-owner once the author enables sharing", async () => {
    sessionUser = { id: STRANGER };
    fakeDb.rows("researchSurvey")[0].shareData = true;

    expect((await download()).status).toBe(200);
  });
});

describe("force-anonymisation of a shared download", () => {
  // The shareData path is the one that hands research data to a third party, so
  // it is asserted on the FILE rather than on the arguments passed to the builder.
  beforeEach(() => {
    sessionUser = { id: STRANGER };
    fakeDb.rows("researchSurvey")[0].shareData = true;
  });

  it("strips respondent handles from the shared workbook", async () => {
    const text = await cellsOf(await download());

    expect(text).not.toContain("stranger");
    expect(text).not.toContain("owner");
    expect(text).not.toContain("Stranger");
  });

  it("omits the identity columns entirely", async () => {
    const response = await download();
    const { readWorkbook } = await import("@/lib/surveys/export-xlsx");
    const workbook = await readWorkbook(
      (await response.arrayBuffer()) as ArrayBuffer,
    );
    const header = (
      workbook.getWorksheet("Raw Data")!.getRow(1).values as unknown[]
    )
      .slice(1)
      .map(String);

    // Absent, not merely blank: an empty column still implies a withheld name.
    expect(header).not.toContain("respondent_handle");
    expect(header).not.toContain("is_anonymous");
  });

  it("still returns the answers, because the point of sharing is the data", async () => {
    const text = await cellsOf(await download());

    expect(text).toContain("Computer Science");
    expect(text).toContain("Biology");
  });

  it("gives the owner the identified copy instead", async () => {
    sessionUser = { id: OWNER };

    const text = await cellsOf(await download());

    expect(text).toContain("owner");
  });
});

describe("response format", () => {
  it("serves a two-sheet XLSX by default", async () => {
    const response = await download();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes.byteLength).toBeGreaterThan(0);
    // XLSX is a zip container.
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("serves flat CSV when asked", async () => {
    const response = await download("csv");

    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    const text = await response.text();

    expect(text).toContain("response_id");
    expect(text).toContain("Computer Science");
  });

  it("treats an unknown format as the XLSX default rather than erroring", async () => {
    const response = await download("pdf");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("spreadsheetml");
  });

  it("derives a filename from the survey title", async () => {
    const response = await download();

    // Spaces become underscores and punctuation is dropped, so the file is
    // recognisable in a downloads list without needing quotes to survive.
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="Researcher_workload_survey_export.xlsx"',
    );
  });

  it("names the CSV file for its format", async () => {
    const response = await download("csv");

    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="Researcher_workload_survey_data.csv"',
    );
  });

  it("marks every download as uncacheable", async () => {
    // A cached export could be served to the next requester, which for a shared
    // download means serving one stranger's copy to another.
    for (const format of ["csv", undefined]) {
      expect((await download(format)).headers.get("Cache-Control")).toBe("no-store");
    }
  });

  it("produces a CSV that keeps NA_SKIPPED distinct from an empty cell", async () => {
    resetFakeDb();
    seedSurvey({
      privacy: "HYBRID",
      questions: [
        {
          id: "q_trigger",
          type: "DROPDOWN",
          title: "Branch",
          required: true,
          order: 0,
          minValue: null,
          maxValue: null,
          archivedAt: null,
          shuffleOptions: false,
          skipLogic: [{ operator: "equals", value: "other", skipToOrder: 2 }],
          columnLabels: null,
          options: [{ id: "o1", value: "other", label: "Other", order: 0 }],
        },
        {
          id: "q_follow",
          type: "SHORT_TEXT",
          title: "Please explain",
          required: false,
          order: 1,
          minValue: null,
          maxValue: null,
          archivedAt: null,
          shuffleOptions: false,
          skipLogic: null,
          columnLabels: null,
          options: [],
        },
      ],
    });

    // The two responses must answer the TRIGGER for the rule to fire; seeding an
    // answer to a question this survey no longer has would skip nothing.
    const rows = fakeDb.rows("surveyResponse");
    rows[0].answers = [{ questionId: "q_trigger", value: "other" }];
    rows[1].answers = [{ questionId: "q_trigger", value: "other" }];

    const text = await (await download("csv")).text();

    expect(text).toContain(NA_SKIPPED);
  });
});
