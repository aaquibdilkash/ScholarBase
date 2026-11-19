/**
 * Kind-aware result/exam writes.
 *
 * `kind` decides what a row is; `type` describes the outcome subject for a
 * result notification and is always `EXAM` for an exam notification. These
 * tests pin the create/edit resolution rules so the form and the Server Actions
 * cannot drift apart.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";

import { createResult, updateResult } from "@/app/actions/results";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const AUTHOR = "u-author";
let mockCurrentUser: { id: string } | null = { id: AUTHOR };

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => mockCurrentUser),
  requireCurrentUser: vi.fn(async () => {
    if (!mockCurrentUser) throw new Error("Not logged in");
    return mockCurrentUser;
  }),
  getActiveUser: vi.fn(async () => {
    if (!mockCurrentUser) throw new Error("Not logged in");
    return { user: mockCurrentUser, frozen: false, message: "" };
  }),
  isAuthorizedOrAdmin: vi.fn(async () => true),
}));

vi.mock("@/lib/tri-split/modules/registry", () => ({
  revalidateContent: vi.fn(),
  loadContentPage: vi.fn(async () => []),
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(async () => ({ allowed: true })),
}));

vi.mock("@/lib/notifications", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    notifyFollowersOfActivity: vi.fn(async () => {}),
  };
});

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.append(key, value);
  return fd;
};

const baseFields = {
  title: "UGC NET June 2026",
  description: "<p>Details</p>",
};

beforeEach(() => {
  resetFakeDb();
  mockCurrentUser = { id: AUTHOR };
  fakeDb.seed("user", [
    {
      id: AUTHOR,
      reputation: 0,
      resultCount: 0,
      name: "Author",
      handle: "author",
    },
  ]);
});

describe("createResult kind/type resolution", () => {
  it("stores a result notification with its chosen outcome type", async () => {
    const response = await createResult(
      form({ ...baseFields, kind: "RESULT_NOTIFICATION", type: "ADMISSION" }),
    );

    expect(response.success).toBe(true);
    const row = fakeDb.rows("examsAndResults")[0];
    expect(row.kind).toBe("RESULT_NOTIFICATION");
    expect(row.type).toBe("ADMISSION");
  });

  it("forces an exam notification to type EXAM", async () => {
    const response = await createResult(
      form({ ...baseFields, kind: "EXAM_NOTIFICATION", type: "VACANCY" }),
    );

    expect(response.success).toBe(true);
    const row = fakeDb.rows("examsAndResults")[0];
    expect(row.kind).toBe("EXAM_NOTIFICATION");
    expect(row.type).toBe("EXAM");
  });

  it("defaults an omitted kind to a result notification", async () => {
    const response = await createResult(form({ ...baseFields, type: "EXAM" }));

    expect(response.success).toBe(true);
    expect(fakeDb.rows("examsAndResults")[0].kind).toBe("RESULT_NOTIFICATION");
  });

  it("rejects an unknown kind", async () => {
    const response = await createResult(
      form({ ...baseFields, kind: "ANNOUNCEMENT", type: "EXAM" }),
    );

    expect(response).toMatchObject({
      success: false,
      message: "Choose a valid post kind.",
    });
    expect(fakeDb.rows("examsAndResults")).toHaveLength(0);
  });

  it("requires a valid outcome type for a result notification", async () => {
    const response = await createResult(
      form({ ...baseFields, kind: "RESULT_NOTIFICATION" }),
    );

    expect(response).toMatchObject({
      success: false,
      message: "Choose a valid outcome type.",
    });
    expect(fakeDb.rows("examsAndResults")).toHaveLength(0);
  });
});

describe("updateResult kind/type resolution", () => {
  const seedResult = (kind: string, type: string) => {
    fakeDb.seed("examsAndResults", [
      {
        id: "r-1",
        authorId: AUTHOR,
        kind,
        type,
        totalVotes: 0,
        totalComments: 0,
        isDeleted: false,
      },
    ]);
  };

  it("keeps the stored kind and type when the form omits both", async () => {
    seedResult("RESULT_NOTIFICATION", "ADMISSION");

    const response = await updateResult(form(baseFields), "r-1");

    expect(response.success).toBe(true);
    const row = fakeDb.rows("examsAndResults")[0];
    expect(row.kind).toBe("RESULT_NOTIFICATION");
    expect(row.type).toBe("ADMISSION");
  });

  it("switching to an exam notification forces type EXAM", async () => {
    seedResult("RESULT_NOTIFICATION", "ADMISSION");

    const response = await updateResult(
      form({ ...baseFields, kind: "EXAM_NOTIFICATION" }),
      "r-1",
    );

    expect(response.success).toBe(true);
    const row = fakeDb.rows("examsAndResults")[0];
    expect(row.kind).toBe("EXAM_NOTIFICATION");
    expect(row.type).toBe("EXAM");
  });

  it("rejects switching to a result notification without an outcome type", async () => {
    seedResult("EXAM_NOTIFICATION", "EXAM");

    const response = await updateResult(
      form({ ...baseFields, kind: "RESULT_NOTIFICATION" }),
      "r-1",
    );

    expect(response).toMatchObject({
      success: false,
      message: "Choose a valid outcome type.",
    });
    const row = fakeDb.rows("examsAndResults")[0];
    expect(row.kind).toBe("EXAM_NOTIFICATION");
    expect(row.type).toBe("EXAM");
  });

  it("accepts a new outcome type when keeping a result notification", async () => {
    seedResult("RESULT_NOTIFICATION", "ADMISSION");

    const response = await updateResult(
      form({ ...baseFields, kind: "RESULT_NOTIFICATION", type: "VACANCY" }),
      "r-1",
    );

    expect(response.success).toBe(true);
    const row = fakeDb.rows("examsAndResults")[0];
    expect(row.kind).toBe("RESULT_NOTIFICATION");
    expect(row.type).toBe("VACANCY");
  });
});
