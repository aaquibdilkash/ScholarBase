/**
 * Group-conversation moderation is deliberately freeze-only.
 *
 * A group has no `authorId`, no `isDeleted` column and no cached public list,
 * so it cannot use the generic DELETE/RECOVER matrix. These tests pin that:
 * freeze/unfreeze work, the creator is notified with a link to the thread, and
 * delete/recover are refused instead of throwing a Prisma column error.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";

import { moderateContent } from "@/app/actions/reports";
import { getMyContentFreezeContext } from "@/app/actions/content-freeze-context";
import { queueNotification } from "@/lib/qstash";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

let isAdmin = true;
let mockUser: { id: string } | null = { id: "u-admin" };

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => mockUser),
  requireCurrentUser: vi.fn(async () => {
    if (!mockUser) throw new Error("Not logged in");
    return mockUser;
  }),
  getActiveUser: vi.fn(async () => {
    if (!mockUser) throw new Error("Not logged in");
    return { user: mockUser, frozen: false, message: "" };
  }),
  isUserAdmin: vi.fn(async () => isAdmin),
}));

vi.mock("@/lib/qstash", () => ({ queueNotification: vi.fn(async () => {}) }));
vi.mock("@/lib/tri-split/modules/registry", () => ({
  revalidateContent: vi.fn(),
}));

const ids = {
  admin: "u-admin",
  owner: "u-owner",
  conversation: "c-group",
};

const seedConversation = (extra: Record<string, unknown> = {}) =>
  fakeDb.seed("conversation", {
    id: ids.conversation,
    type: "GROUP",
    title: "Reading circle",
    createdById: ids.owner,
    isFrozen: false,
    hasActiveAppeal: false,
    reportCount: 2,
    ...extra,
  });

beforeEach(() => {
  resetFakeDb();
  isAdmin = true;
  mockUser = { id: ids.admin };
  vi.mocked(queueNotification).mockClear();
});

describe("moderateContent for group conversations", () => {
  it("freezes the group and notifies its creator", async () => {
    seedConversation();

    const result = await moderateContent("FREEZE", "MESSAGES", ids.conversation);

    expect(result.success).toBe(true);
    expect(fakeDb.rows("conversation")[0].isFrozen).toBe(true);
    expect(queueNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: ids.owner,
        actorId: ids.admin,
        targetType: "conversation",
        targetId: ids.conversation,
      }),
    );
  });

  it("unfreezes and closes pending appeals", async () => {
    seedConversation({ isFrozen: true, hasActiveAppeal: true });
    fakeDb.seed("appeal", {
      id: "a-1",
      entityId: ids.conversation,
      status: "PENDING",
    });

    const result = await moderateContent(
      "UNFREEZE",
      "MESSAGES",
      ids.conversation,
    );

    expect(result.success).toBe(true);
    expect(fakeDb.rows("conversation")[0].isFrozen).toBe(false);
    expect(fakeDb.rows("appeal")[0].status).toBe("ACTIONED");
  });

  it("dismisses reports and resets the materialized counter", async () => {
    seedConversation();
    fakeDb.seed("report", [
      {
        id: "r-1",
        entityId: ids.conversation,
        module: "MESSAGES",
        status: "PENDING",
      },
      {
        id: "r-2",
        entityId: ids.conversation,
        module: "MESSAGES",
        status: "PENDING",
      },
    ]);

    const result = await moderateContent(
      "DISMISS_REPORTS",
      "MESSAGES",
      ids.conversation,
    );

    expect(result).toEqual({
      action: "DISMISS_REPORTS",
      success: true,
      data: { id: ids.conversation },
    });
    expect(fakeDb.rows("conversation")[0].reportCount).toBe(0);
    expect(fakeDb.rows("report").every((row) => row.status === "DISMISSED")).toBe(
      true,
    );
  });

  it("refuses DELETE instead of touching the conversation", async () => {
    seedConversation();

    const result = await moderateContent("DELETE", "MESSAGES", ids.conversation);

    expect(result).toEqual({
      success: false,
      message:
        "Group conversations cannot be deleted or recovered. Freeze the group instead.",
    });
    expect(fakeDb.rows("conversation")[0].isFrozen).toBe(false);
  });

  it("refuses RECOVER", async () => {
    seedConversation({ isFrozen: true });

    const result = await moderateContent("RECOVER", "MESSAGES", ids.conversation);

    expect(result.success).toBe(false);
    expect(fakeDb.rows("conversation")[0].isFrozen).toBe(true);
  });

  it("is still admin-only", async () => {
    seedConversation();
    isAdmin = false;

    await expect(
      moderateContent("FREEZE", "MESSAGES", ids.conversation),
    ).rejects.toThrow(/Not authorized/i);
  });
});

describe("getMyContentFreezeContext for a group", () => {
  it("resolves the creator as the owner", async () => {
    mockUser = { id: ids.owner };
    seedConversation({ isFrozen: true });
    fakeDb.seed("report", {
      id: "r-1",
      entityId: ids.conversation,
      status: "PENDING",
      category: "ABUSE",
      details: "slurs in the group",
    });

    const context = await getMyContentFreezeContext(
      ids.conversation,
      "MESSAGES",
    );

    expect(context.isOwner).toBe(true);
    expect(context.isFrozen).toBe(true);
    expect(context.reportCount).toBe(2);
    expect(context.reports[0]).toMatchObject({ category: "ABUSE", count: 1 });
  });

  it("does not let a stranger read the report excerpts", async () => {
    mockUser = { id: "u-stranger" };
    isAdmin = false;
    seedConversation({ isFrozen: true });

    await expect(
      getMyContentFreezeContext(ids.conversation, "MESSAGES"),
    ).rejects.toThrow(/Not authorized/i);
  });
});
