import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { fakeDb, resetFakeDb } from "../fake-prisma";
import { submitReport } from "@/app/actions/reports";
import type { ReportEntityType, ReportModule } from "@/types/reports";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

vi.mock("@/lib/auth", () => ({
  getActiveUser: vi.fn(async () => ({
    user: { id: "u-viewer" },
    frozen: false,
  })),
}));

const ENTITY_ID = "e-1";

function p2002() {
  return new Prisma.PrismaClientKnownRequestError(
    "Unique constraint violation on field(s)",
    { code: "P2002", clientVersion: "7.10.0" },
  );
}

beforeEach(() => {
  resetFakeDb();
  vi.resetAllMocks();
});

describe("submitReport duplicate-report wording", () => {
  it("says 'content' when a post is re-reported", async () => {
    fakeDb.seed("socialPost", { id: ENTITY_ID, isDeleted: false, isFrozen: false });
    vi.spyOn(fakeDb.client.report, "create").mockRejectedValue(p2002());

    const result = await submitReport(
      ENTITY_ID,
      "POST" as ReportEntityType,
      "SOCIAL_FEED" as ReportModule,
      "SPAM",
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe("You have already reported this content.");
  });

  it("says 'user' when a scholar profile is re-reported", async () => {
    fakeDb.seed("user", { id: ENTITY_ID, isDeleted: false, isFrozen: false });
    vi.spyOn(fakeDb.client.report, "create").mockRejectedValue(p2002());

    const result = await submitReport(
      ENTITY_ID,
      "POST" as ReportEntityType,
      "SCHOLAR_PROFILE" as ReportModule,
      "SPAM",
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe("You have already reported this user.");
  });

  it("says 'comment' when a comment is re-reported", async () => {
    fakeDb.seed("socialComment", {
      id: ENTITY_ID,
      isDeleted: false,
      isFrozen: false,
    });
    vi.spyOn(fakeDb.client.report, "create").mockRejectedValue(p2002());

    const result = await submitReport(
      ENTITY_ID,
      "COMMENT" as ReportEntityType,
      "SOCIAL_COMMENT" as ReportModule,
      "SPAM",
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe("You have already reported this comment.");
  });

  it("says 'conversation' when a group is re-reported", async () => {
    // Conversations have no `isDeleted` column; selecting it would make Prisma
    // reject the report instead of returning the duplicate wording.
    fakeDb.seed("conversation", {
      id: ENTITY_ID,
      type: "GROUP",
      isFrozen: false,
      reportCount: 0,
    });
    vi.spyOn(fakeDb.client.report, "create").mockRejectedValue(p2002());

    const result = await submitReport(
      ENTITY_ID,
      "POST" as ReportEntityType,
      "MESSAGES" as ReportModule,
      "SPAM",
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe("You have already reported this conversation.");
  });
});

describe("submitReport for a group conversation", () => {
  it("persists the report and bumps the conversation report count", async () => {
    fakeDb.seed("conversation", {
      id: ENTITY_ID,
      type: "GROUP",
      isFrozen: false,
      reportCount: 0,
    });

    const result = await submitReport(
      ENTITY_ID,
      "POST" as ReportEntityType,
      "MESSAGES" as ReportModule,
      "HARASSMENT",
      "Repeated slurs in the group",
    );

    expect(result.success).toBe(true);
    expect(fakeDb.rows("report")[0]).toMatchObject({
      entityId: ENTITY_ID,
      module: "MESSAGES",
      category: "HARASSMENT",
    });
    expect(fakeDb.rows("conversation")[0].reportCount).toBe(1);
  });

  it("refuses a second report while the group is frozen", async () => {
    fakeDb.seed("conversation", {
      id: ENTITY_ID,
      type: "GROUP",
      isFrozen: true,
      reportCount: 1,
    });

    const result = await submitReport(
      ENTITY_ID,
      "POST" as ReportEntityType,
      "MESSAGES" as ReportModule,
      "SPAM",
    );

    expect(result).toEqual({
      success: false,
      error: "Reporting is disabled for frozen or deleted content.",
      message: "Reporting is disabled for frozen or deleted content.",
    });
  });
});
