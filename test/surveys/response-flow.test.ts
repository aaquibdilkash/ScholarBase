/**
 * A respondent actually filling in and submitting a survey.
 *
 * `submitSurveyResponse` had no tests. It is the one action that turns a person
 * into a data point, and it carries more than storage: it re-validates skip logic
 * on the server (never trusting the hidden-question UI), refuses a response to a
 * survey that changed underneath the respondent, retains answers to archived
 * questions as historical data, and awards exactly one reputation point.
 *
 * That last part is a product rule, not an implementation detail: survey
 * participation is the ONLY non-vote grant of reputation, so it is also the one
 * place a bug would be farmable. Asserted here from both directions — granted
 * once on create, and NOT re-granted when the same respondent updates.
 *
 * The fake's relation registry is declared at module scope because
 * `submitSurveyResponse` writes `answers: { create: [...] }` on a
 * `surveyResponse`. Relations survive `resetFakeDb()` precisely so this wiring
 * can live here rather than in every `beforeEach`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";

fakeDb.link({
  parent: "surveyResponse",
  relation: "answers",
  child: "surveyAnswer",
  fk: "responseId",
});
fakeDb.link({
  parent: "surveyAnswer",
  relation: "question",
  child: "surveyQuestion",
  fk: "questionId",
});

const RESPONDENT = "u-respondent";
const AUTHOR = "u-author";

let session: { id: string } | null = null;
let rateLimitAllowed = true;
const notifyFollowersOfActivity = vi.fn(async () => undefined);
const revalidateContent = vi.fn();

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});
vi.mock("@/lib/auth", () => ({
  requireActiveUser: vi.fn(async () => {
    if (!session) throw new Error("Not logged in");
    return session;
  }),
  getCurrentUser: vi.fn(async () => session),
  isUserAdmin: vi.fn(async () => false),
  isAuthorizedOrAdmin: vi.fn(async () => false),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: rateLimitAllowed, degraded: false })),
  enforceRateLimit: vi.fn(async () => undefined),
  RATE_LIMIT_ERROR: "Too many requests. Please slow down.",
}));
vi.mock("@/lib/notifications", () => ({
  notifyFollowersOfActivity: (...args: unknown[]) =>
    notifyFollowersOfActivity(...(args as [])),
}));
vi.mock("@/lib/tri-split/modules/registry", () => ({
  revalidateContent: (...args: unknown[]) => revalidateContent(...(args as [])),
  loadContentPage: vi.fn(async () => ({ items: [], nextCursor: null })),
}));

/** One active question, plus the survey row that owns it. */
type Seeded = { id: string; order: number; skipLogic?: unknown; required?: boolean };

function seedSurvey(
  questions: Seeded[],
  overrides: Record<string, unknown> = {},
) {
  const surveyId = "survey-1";
  fakeDb.seed("researchSurvey", {
    id: surveyId,
    authorId: AUTHOR,
    title: "Research survey",
    privacy: "HYBRID",
    shareData: false,
    consentRequired: false,
    consentText: null,
    totalResponses: 0,
    isDeleted: false,
    // The validation read selects `questions`, and the fake serves nested reads
    // from the array materialised here rather than resolving the relation.
    questions: questions.map((q) => ({
      id: q.id,
      order: q.order,
      skipLogic: q.skipLogic ?? null,
    })),
    ...overrides,
  });

  for (const q of questions) {
    fakeDb.seed("surveyQuestion", {
      id: q.id,
      surveyId,
      order: q.order,
      required: q.required ?? false,
      archivedAt: null,
      totalAnswers: 0,
      skipLogic: q.skipLogic ?? null,
    });
  }

  fakeDb.seed("user", {
    id: RESPONDENT,
    name: "Respon D",
    handle: "respon",
    email: "respon@uni.edu",
    reputation: 0,
    surveyParticipationCount: 0,
    isDeleted: false,
    isFrozen: false,
    isAdmin: false,
  });
  return surveyId;
}

/** FormData shaped the way `SurveyResponseForm` builds it. */
function responseForm(
  answers: Array<{ questionId: string; value: unknown }>,
  extra: Record<string, string> = {},
) {
  const fd = new FormData();
  fd.set("answers", JSON.stringify(answers));
  fd.set("isAnonymous", "false");
  fd.set("startedAt", new Date(Date.now() - 60_000).toISOString());
  fd.set("seed", "12345");
  for (const [key, value] of Object.entries(extra)) fd.set(key, value);
  return fd;
}

const submit = async (fd: FormData) => {
  const { submitSurveyResponse } = await import("@/app/actions/surveys");
  return submitSurveyResponse(fd, "survey-1");
};

const answerRows = () => fakeDb.rows("surveyAnswer");
const surveyRow = () => fakeDb.rows("researchSurvey")[0];
const userRow = () => fakeDb.rows("user")[0];

beforeEach(() => {
  resetFakeDb();
  session = { id: RESPONDENT };
  rateLimitAllowed = true;
  notifyFollowersOfActivity.mockClear();
  revalidateContent.mockClear();
});

describe("submitSurveyResponse — gating", () => {
  it("refuses an anonymous caller and stores nothing", async () => {
    seedSurvey([{ id: "q1", order: 0 }]);
    session = null;

    const result = await submit(responseForm([{ questionId: "q1", value: "x" }]));

    expect(result).toEqual({ error: "UNAUTHORIZED" });
    expect(answerRows()).toHaveLength(0);
  });

  it("rate limits a respondent before doing any work", async () => {
    seedSurvey([{ id: "q1", order: 0 }]);
    rateLimitAllowed = false;

    const result = await submit(responseForm([{ questionId: "q1", value: "x" }]));

    expect(result).toMatchObject({ error: "Too many requests. Please slow down." });
    expect(answerRows()).toHaveLength(0);
  });

  it("refuses when the survey has been deleted since the page loaded", async () => {
    seedSurvey([{ id: "q1", order: 0 }]);
    fakeDb.rows("researchSurvey").splice(0, 1);

    const result = await submit(responseForm([{ questionId: "q1", value: "x" }]));

    expect(result).toEqual({ error: "This survey is no longer available." });
    expect(answerRows()).toHaveLength(0);
  });

  it("refuses a response to a question that was archived after the page loaded", async () => {
    // The stale-form guard: the author archived q2 while the respondent had the
    // page open. Storing the answer would attach data to a retired variable.
    seedSurvey([{ id: "q1", order: 0 }, { id: "q2", order: 1 }]);
    fakeDb.rows("surveyQuestion")[1].archivedAt = new Date();

    const result = await submit(
      responseForm([
        { questionId: "q1", value: "a" },
        { questionId: "q2", value: "b" },
      ]),
    );

    expect(result).toMatchObject({
      error: expect.stringContaining("changed before your response"),
    });
    expect(answerRows()).toHaveLength(0);
  });

  it("refuses a question that belongs to a different survey", async () => {
    seedSurvey([{ id: "q1", order: 0 }]);
    fakeDb.seed("surveyQuestion", {
      id: "q-other",
      surveyId: "survey-2",
      order: 0,
      archivedAt: null,
      totalAnswers: 0,
    });

    const result = await submit(
      responseForm([
        { questionId: "q1", value: "a" },
        { questionId: "q-other", value: "b" },
      ]),
    );

    expect(result).toMatchObject({
      error: expect.stringContaining("changed before your response"),
    });
  });
});

describe("submitSurveyResponse — consent gate", () => {
  it("refuses when the survey requires consent and none was given", async () => {
    seedSurvey([{ id: "q1", order: 0 }], { consentRequired: true });

    const result = await submit(responseForm([{ questionId: "q1", value: "a" }]));

    // Enforced server-side; the client toggle is never trusted.
    expect(result).toEqual({ error: "CONSENT_REQUIRED" });
    expect(answerRows()).toHaveLength(0);
  });

  it("stamps consentedAt when consent is given", async () => {
    seedSurvey([{ id: "q1", order: 0 }], { consentRequired: true });

    const result = await submit(
      responseForm([{ questionId: "q1", value: "a" }], { consented: "true" }),
    );

    expect(result).toMatchObject({ success: true });
    const response = fakeDb.rows("surveyResponse")[0];
    expect(response.consentedAt).toBeInstanceOf(Date);
  });

  it("ignores a consent flag on a survey that does not require it", async () => {
    seedSurvey([{ id: "q1", order: 0 }], { consentRequired: false });

    const result = await submit(
      responseForm([{ questionId: "q1", value: "a" }], { consented: "true" }),
    );

    expect(result).toMatchObject({ success: true });
    expect(fakeDb.rows("surveyResponse")[0].consentedAt).toBeUndefined();
  });
});

describe("submitSurveyResponse — answer payloads", () => {
  it("persists a plain text answer verbatim", async () => {
    seedSurvey([{ id: "q1", order: 0 }]);

    const result = await submit(responseForm([{ questionId: "q1", value: "I use R daily" }]));

    expect(result).toMatchObject({ success: true });
    expect(answerRows()[0].value).toBe("I use R daily");
  });

  it("stores a checkbox multi-select as a real JSON array, not a joined string", async () => {
    // The server JSON-parses stringified arrays so PostgreSQL holds a real array.
    // A regression that stored `'["a","b"]'` as text would make the export
    // resolve it to one opaque label instead of two countable selections.
    seedSurvey([{ id: "q1", order: 0 }]);

    await submit(
      responseForm([
        { questionId: "q1", value: JSON.stringify(["python", "r"]) },
      ]),
    );

    expect(answerRows()[0].value).toEqual(["python", "r"]);
  });

  it("stores a matrix answer as an object keyed by row value", async () => {
    seedSurvey([{ id: "q1", order: 0 }]);

    await submit(
      responseForm([
        { questionId: "q1", value: JSON.stringify({ row_teaching: 3 }) },
      ]),
    );

    expect(answerRows()[0].value).toEqual({ row_teaching: 3 });
  });

  it("keeps a numeric-looking text answer as text", async () => {
    seedSurvey([{ id: "q1", order: 0 }]);

    await submit(responseForm([{ questionId: "q1", value: "123" }]));

    expect(answerRows()[0].value).toBe("123");
  });

  it("stores every answer of a multi-question response", async () => {
    const seeded = seedSurvey([
      { id: "q1", order: 0 },
      { id: "q2", order: 1 },
      { id: "q3", order: 2 },
    ]);
    expect(seeded).toBe("survey-1");

    await submit(
      responseForm([
        { questionId: "q1", value: "a" },
        { questionId: "q2", value: "4" },
        { questionId: "q3", value: "2026-01-02" },
      ]),
    );

    const byQuestion = Object.fromEntries(
      answerRows().map((row) => [row.questionId, row.value]),
    );
    expect(byQuestion).toEqual({
      q1: "a",
      q2: "4",
      q3: "2026-01-02",
    });
  });

  it("throws rather than storing a half-built submission with no answers", async () => {
    seedSurvey([{ id: "q1", order: 0 }]);
    const fd = new FormData();
    fd.set("isAnonymous", "false");

    await expect(submit(fd)).rejects.toThrow(/Answers are required/);
    expect(answerRows()).toHaveLength(0);
  });
});

describe("submitSurveyResponse — response metadata", () => {
  it("records the randomization seed so the option order is reconstructible", async () => {
    seedSurvey([{ id: "q1", order: 0 }]);

    await submit(responseForm([{ questionId: "q1", value: "a" }]));

    expect(fakeDb.rows("surveyResponse")[0].randomizationSeed).toBe(12345);
  });

  it("stores no seed when the client sends a nonsensical one", async () => {
    seedSurvey([{ id: "q1", order: 0 }]);

    // An out-of-range seed must become null, never be persisted and later fed
    // to `seededShuffle` as if it were trustworthy.
    await submit(responseForm([{ questionId: "q1", value: "a" }], { seed: "-5" }));

    expect(fakeDb.rows("surveyResponse")[0].randomizationSeed).toBeNull();
  });

  it("derives a completion duration from startedAt", async () => {
    seedSurvey([{ id: "q1", order: 0 }]);

    await submit(
      responseForm([{ questionId: "q1", value: "a" }], {
        startedAt: new Date(Date.now() - 125_000).toISOString(),
      }),
    );

    const row = fakeDb.rows("surveyResponse")[0] as Record<string, Date>;
    const seconds = Math.round(
      (row.completedAt.getTime() - row.startedAt.getTime()) / 1000,
    );
    expect(seconds).toBeGreaterThanOrEqual(120);
    expect(seconds).toBeLessThanOrEqual(130);
  });

  it("clamps an absurd startedAt rather than recording a negative duration", async () => {
    // A client clock days behind would otherwise export a garbage
    // `duration_seconds`, which researchers do filter on.
    seedSurvey([{ id: "q1", order: 0 }]);

    await submit(
      responseForm([{ questionId: "q1", value: "a" }], {
        startedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    );

    const row = fakeDb.rows("surveyResponse")[0] as Record<string, Date>;
    expect(row.completedAt.getTime()).toBe(row.startedAt.getTime());
  });

  it("keeps the anonymity flag the respondent chose", async () => {
    seedSurvey([{ id: "q1", order: 0 }]);

    await submit(
      responseForm([{ questionId: "q1", value: "a" }], { isAnonymous: "true" }),
    );

    expect(fakeDb.rows("surveyResponse")[0].isAnonymous).toBe(true);
  });

  it("always links the response to the respondent, even when anonymous", async () => {
    // Anonymity is expressed by the flag, not by dropping the link: the
    // respondent must still be able to find and edit their own response.
    seedSurvey([{ id: "q1", order: 0 }]);

    await submit(
      responseForm([{ questionId: "q1", value: "a" }], { isAnonymous: "true" }),
    );

    expect(fakeDb.rows("surveyResponse")[0].respondentId).toBe(RESPONDENT);
  });
});

describe("submitSurveyResponse — server-side skip logic", () => {
  const trigger = { id: "q1", order: 0 };
  const hidden = { id: "q2", order: 1 };
  const destination = { id: "q3", order: 2 };

  it("prunes an answer the client should never have been able to submit", async () => {
    // The client hides skipped questions, but the server is the source of truth.
    // Without this, a crafted payload would keep a "not applicable" value in the
    // dataset, where it is indistinguishable from a real answer.
    seedSurvey([
      { ...trigger, skipLogic: [{ operator: "equals", value: "cs", skipToOrder: 2 }] },
      hidden,
      destination,
    ]);

    await submit(
      responseForm([
        { questionId: "q1", value: "cs" },
        { questionId: "q2", value: "I picked this anyway" },
        { questionId: "q3", value: "kept" },
      ]),
    );

    const questionIds = answerRows().map((row) => row.questionId).sort();
    expect(questionIds).toEqual(["q1", "q3"]);
  });

  it("keeps the answer when the trigger does not match", async () => {
    seedSurvey([
      { ...trigger, skipLogic: [{ operator: "equals", value: "cs", skipToOrder: 2 }] },
      hidden,
      destination,
    ]);

    await submit(
      responseForm([
        { questionId: "q1", value: "bio" },
        { questionId: "q2", value: "a real answer" },
      ]),
    );

    expect(answerRows().map((row) => row.questionId).sort()).toEqual(["q1", "q2"]);
  });

  it("keeps the answer when the trigger was left blank", async () => {
    seedSurvey([
      { ...trigger, skipLogic: [{ operator: "not_equals", value: "cs", skipToOrder: 2 }] },
      hidden,
      destination,
    ]);

    // `not_equals` on an unanswered trigger must not fire; otherwise merely
    // skipping the first question would silently discard a later answer.
    await submit(responseForm([{ questionId: "q2", value: "a real answer" }]));

    expect(answerRows().map((row) => row.questionId)).toEqual(["q2"]);
  });

  it("does not prune when the survey declares no skip logic anywhere", async () => {
    seedSurvey([trigger, hidden]);

    await submit(
      responseForm([
        { questionId: "q1", value: "cs" },
        { questionId: "q2", value: "value" },
      ]),
    );

    expect(answerRows()).toHaveLength(2);
  });
});

describe("submitSurveyResponse — updating an existing response", () => {
  function seedWithExistingResponse(
    questions: Seeded[],
    existingAnswers: Array<{ questionId: string; value: unknown }>,
  ) {
    const surveyId = seedSurvey(questions);
    fakeDb.seed("surveyResponse", {
      id: "response-1",
      surveyId,
      respondentId: RESPONDENT,
      isAnonymous: false,
      consentedAt: null,
      startedAt: new Date(),
      completedAt: new Date(),
      randomizationSeed: 999,
      // Materialised so `include`/relation filters can see them, mirroring how
      // the fake stores relations.
      answers: existingAnswers.map((answer, index) => ({
        id: `answer-${index + 1}`,
        responseId: "response-1",
        questionId: answer.questionId,
        value: answer.value,
      })),
    });
    for (const answer of existingAnswers) {
      fakeDb.seed("surveyAnswer", {
        id: `answer-${answer.questionId}`,
        responseId: "response-1",
        questionId: answer.questionId,
        value: answer.value,
        // Needed for the upsert's `question: { archivedAt: null }` filter.
        question: {
          id: answer.questionId,
          archivedAt: null,
        },
      });
    }
    return surveyId;
  }

  it("replaces the answers rather than creating a second response", async () => {
    seedWithExistingResponse(
      [{ id: "q1", order: 0 }],
      [{ questionId: "q1", value: "first answer" }],
    );

    const result = await submit(responseForm([{ questionId: "q1", value: "corrected" }]));

    expect(result).toMatchObject({ success: true });
    expect(fakeDb.rows("surveyResponse")).toHaveLength(1);
    expect(answerRows()).toHaveLength(1);
    expect(answerRows()[0].value).toBe("corrected");
  });

  it("does not inflate totalResponses when a response is updated", async () => {
    seedWithExistingResponse(
      [{ id: "q1", order: 0 }],
      [{ questionId: "q1", value: "first" }],
    );

    await submit(responseForm([{ questionId: "q1", value: "second" }]));

    // One respondent, one response. The counter must reflect respondents, not
    // submissions, or the response rate a researcher reports is wrong.
    expect(surveyRow().totalResponses).toBe(0);
  });

  it("does not re-award the participation reputation point on update", async () => {
    // THE farmable path. Survey participation is the only non-vote reputation
    // grant, so re-submitting must not pay out again.
    seedWithExistingResponse(
      [{ id: "q1", order: 0 }],
      [{ questionId: "q1", value: "first" }],
    );

    await submit(responseForm([{ questionId: "q1", value: "second" }]));

    expect(userRow().reputation).toBe(0);
    expect(userRow().surveyParticipationCount).toBe(0);
  });

  it("decrements the counter for a question the respondent stopped answering", async () => {
    seedWithExistingResponse(
      [{ id: "q1", order: 0 }, { id: "q2", order: 1 }],
      [
        { questionId: "q1", value: "kept" },
        { questionId: "q2", value: "removed" },
      ],
    );
    for (const row of fakeDb.rows("surveyQuestion")) row.totalAnswers = 1;

    await submit(responseForm([{ questionId: "q1", value: "kept" }]));

    const byId = Object.fromEntries(
      fakeDb.rows("surveyQuestion").map((q) => [q.id, q.totalAnswers]),
    );
    expect(byId).toEqual({ q1: 1, q2: 0 });
  });

  it("retains an answer to a question that has since been archived", async () => {
    // Historical data must survive an author archiving a question: the rows are
    // already collected and the codebook still describes them.
    seedWithExistingResponse(
      [{ id: "q1", order: 0 }, { id: "q2", order: 1 }],
      [
        { questionId: "q1", value: "kept" },
        { questionId: "q2", value: "historical" },
      ],
    );
    const archived = fakeDb
      .rows("surveyQuestion")
      .find((q) => q.id === "q2")!;
    archived.archivedAt = new Date();
    for (const row of answerRows()) {
      row.question = { id: row.questionId, archivedAt: row.questionId === "q2" ? new Date() : null };
    }

    await submit(responseForm([{ questionId: "q1", value: "kept" }]));

    const retained = answerRows().find((row) => row.questionId === "q2");
    expect(retained, "the archived answer must not be deleted").toBeDefined();
    expect(retained!.value).toBe("historical");
  });

  it("stamps consent on an update when the survey requires it", async () => {
    seedSurvey([{ id: "q1", order: 0 }], { consentRequired: true });
    fakeDb.seed("surveyResponse", {
      id: "response-1",
      surveyId: "survey-1",
      respondentId: RESPONDENT,
      isAnonymous: false,
      consentedAt: null,
      startedAt: new Date(),
      completedAt: new Date(),
      randomizationSeed: null,
      answers: [],
    });

    await submit(
      responseForm([{ questionId: "q1", value: "a" }], { consented: "true" }),
    );

    expect(fakeDb.rows("surveyResponse")[0].consentedAt).toBeInstanceOf(Date);
  });
});

describe("submitSurveyResponse — first submission", () => {
  it("awards exactly one reputation point for participating", async () => {
    // RULE 3: reputation is vote-derived, EXCEPT survey participation, which is
    // the single engagement incentive. Creating content grants nothing.
    seedSurvey([{ id: "q1", order: 0 }]);

    await submit(responseForm([{ questionId: "q1", value: "a" }]));

    expect(userRow().reputation).toBe(1);
    expect(userRow().surveyParticipationCount).toBe(1);
  });

  it("increments the survey's response counter", async () => {
    seedSurvey([{ id: "q1", order: 0 }]);

    await submit(responseForm([{ questionId: "q1", value: "a" }]));

    expect(surveyRow().totalResponses).toBe(1);
  });

  it("increments each answered question's counter, and only those", async () => {
    seedSurvey([
      { id: "q1", order: 0 },
      { id: "q2", order: 1 },
    ]);

    await submit(responseForm([{ questionId: "q1", value: "a" }]));

    const byId = Object.fromEntries(
      fakeDb.rows("surveyQuestion").map((q) => [q.id, q.totalAnswers]),
    );
    expect(byId).toEqual({ q1: 1, q2: 0 });
  });

  it("purges the author's cached survey pages so the count shows immediately", async () => {
    // `totalResponses` is rendered on the survey card AND in the author's own
    // profile Content tab, so the purge must name the author, not the respondent.
    seedSurvey([{ id: "q1", order: 0 }]);

    await submit(responseForm([{ questionId: "q1", value: "a" }]));

    expect(revalidateContent).toHaveBeenCalledWith("RESEARCH_SURVEY", AUTHOR);
  });

  it("does not award reputation when the write fails part-way", async () => {
    // RULE 3 atomicity: the response, the counters and the reputation grant must
    // all commit together. A partial commit would pay reputation for a response
    // that does not exist.
    seedSurvey([{ id: "q1", order: 0 }]);
    // A user row the update cannot find makes the transaction throw.
    fakeDb.rows("user").splice(0, 1);

    await expect(submit(responseForm([{ questionId: "q1", value: "a" }]))).rejects.toThrow();

    expect(answerRows()).toHaveLength(0);
    expect(surveyRow().totalResponses).toBe(0);
  });
});
