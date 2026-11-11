/**
 * Anonymity parity for Supervisor and Journal.
 *
 * Recommendation and JournalReview already hide their author, skip the
 * author's materialized profile counter, and stay out of the activity log
 * while anonymous. Supervisor and Journal must behave the same way at create,
 * edit (including flipping the flag either direction), and delete — otherwise
 * an anonymous row leaks into the profile Content tab or leaves a stale
 * `PUBLISHED` activity entry behind.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";

import {
  createJournal,
  deleteJournal,
  updateJournal,
} from "@/app/actions/journals";
import {
  createSupervisor,
  deleteSupervisor,
  updateSupervisor,
} from "@/app/actions/supervisors";
import { notifyFollowersOfActivity } from "@/lib/notifications";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const AUTHOR = "u-author";

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => ({ id: AUTHOR })),
  requireCurrentUser: vi.fn(async () => ({ id: AUTHOR })),
  getActiveUser: vi.fn(async () => ({
    user: { id: AUTHOR, email: "ada@example.org" },
    frozen: false,
    message: "",
  })),
  isAuthorizedOrAdmin: vi.fn(async () => true),
  isUserAdmin: vi.fn(async () => false),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  enforceRateLimit: vi.fn(async () => {}),
  RATE_LIMIT_ERROR: "Rate limit exceeded",
}));

vi.mock("@/lib/tri-split/modules/registry", () => ({
  revalidateContent: vi.fn(),
  loadContentPage: vi.fn(async () => []),
}));

vi.mock("@/lib/notifications", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    notifyFollowersOfActivity: vi.fn(async () => {}),
  };
});

function form(fields: Record<string, string>, anonymous = false): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  if (anonymous) data.append("isAnonymous", "on");
  return data;
}

const supervisorFields = { name: "Prof Ada", university: "Oxford" };
const journalFields = { title: "Nature Fake" };

beforeEach(() => {
  resetFakeDb();
  vi.clearAllMocks();
  fakeDb.seed("user", {
    id: AUTHOR,
    email: "ada@example.org",
    supervisorCount: 0,
    journalCount: 0,
  });
});

describe("supervisor anonymity", () => {
  it("a new anonymous supervisor skips the profile counter and activity log", async () => {
    const result = await createSupervisor(form(supervisorFields, true));

    expect(result.success).toBe(true);
    expect(fakeDb.rows("supervisor")[0].isAnonymous).toBe(true);
    expect(fakeDb.rows("user")[0].supervisorCount).toBe(0);
    expect(fakeDb.rows("userActivity")).toHaveLength(0);
    expect(notifyFollowersOfActivity).not.toHaveBeenCalled();
  });

  it("a new public supervisor increments the counter, writes activity and notifies followers", async () => {
    await createSupervisor(form(supervisorFields));

    expect(fakeDb.rows("supervisor")[0].isAnonymous).toBe(false);
    expect(fakeDb.rows("user")[0].supervisorCount).toBe(1);
    expect(fakeDb.rows("userActivity")).toHaveLength(1);
    expect(fakeDb.rows("userActivity")[0].moduleType).toBe("SUPERVISOR");
    expect(notifyFollowersOfActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: "Supervisor",
        targetId: fakeDb.rows("supervisor")[0].id,
        body: "Prof Ada at Oxford",
      }),
    );
  });

  it("flipping to anonymous reverses the counter and removes the activity row", async () => {
    fakeDb.seed("supervisor", {
      id: "s1",
      authorId: AUTHOR,
      name: "Prof Ada",
      isAnonymous: false,
    });
    fakeDb.seed("userActivity", {
      id: "a1",
      userId: AUTHOR,
      action: "PUBLISHED",
      moduleType: "SUPERVISOR",
      entityId: "s1",
      entityTitle: "Prof Ada",
      createdAt: new Date(),
    });
    fakeDb.rows("user")[0].supervisorCount = 1;

    const result = await updateSupervisor(
      form({ ...supervisorFields }, true),
      "s1",
    );

    expect(result.success).toBe(true);
    expect(fakeDb.rows("supervisor")[0].isAnonymous).toBe(true);
    expect(fakeDb.rows("user")[0].supervisorCount).toBe(0);
    expect(fakeDb.rows("userActivity")).toHaveLength(0);
  });

  it("flipping back to public restores the counter, activity and notifies followers", async () => {
    fakeDb.seed("supervisor", {
      id: "s1",
      authorId: AUTHOR,
      name: "Prof Ada",
      isAnonymous: true,
    });

    const result = await updateSupervisor(form(supervisorFields), "s1");

    expect(result.success).toBe(true);
    expect(fakeDb.rows("supervisor")[0].isAnonymous).toBe(false);
    expect(fakeDb.rows("user")[0].supervisorCount).toBe(1);
    expect(fakeDb.rows("userActivity")).toHaveLength(1);
    expect(fakeDb.rows("userActivity")[0].entityId).toBe("s1");
    expect(notifyFollowersOfActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: "Supervisor",
        targetId: "s1",
        body: "Prof Ada at Oxford",
      }),
    );
  });

  it("deleting an anonymous supervisor leaves the counter untouched", async () => {
    fakeDb.seed("supervisor", {
      id: "s1",
      authorId: AUTHOR,
      name: "Prof Ada",
      isAnonymous: true,
      totalVotes: 0,
      totalComments: 0,
      recommendationCount: 0,
    });
    fakeDb.rows("user")[0].supervisorCount = 3;

    await deleteSupervisor("s1");

    expect(fakeDb.rows("supervisor")[0].isDeleted).toBe(true);
    expect(fakeDb.rows("user")[0].supervisorCount).toBe(3);
  });
});

describe("journal anonymity", () => {
  it("a new anonymous journal skips the counter, activity log and follower notification", async () => {
    const result = await createJournal(form(journalFields, true));

    expect(result.success).toBe(true);
    expect(fakeDb.rows("journal")[0].isAnonymous).toBe(true);
    expect(fakeDb.rows("user")[0].journalCount).toBe(0);
    expect(fakeDb.rows("userActivity")).toHaveLength(0);
    expect(notifyFollowersOfActivity).not.toHaveBeenCalled();
  });

  it("a new public journal increments, writes activity and notifies followers", async () => {
    await createJournal(form(journalFields));

    expect(fakeDb.rows("journal")[0].isAnonymous).toBe(false);
    expect(fakeDb.rows("user")[0].journalCount).toBe(1);
    expect(fakeDb.rows("userActivity")).toHaveLength(1);
    expect(fakeDb.rows("userActivity")[0].moduleType).toBe("JOURNAL");
    expect(notifyFollowersOfActivity).toHaveBeenCalledTimes(1);
  });

  it("flipping to anonymous reverses the counter and removes the activity row", async () => {
    fakeDb.seed("journal", {
      id: "j1",
      authorId: AUTHOR,
      title: "Nature Fake",
      isAnonymous: false,
    });
    fakeDb.seed("userActivity", {
      id: "a1",
      userId: AUTHOR,
      action: "PUBLISHED",
      moduleType: "JOURNAL",
      entityId: "j1",
      entityTitle: "Nature Fake",
      createdAt: new Date(),
    });
    fakeDb.rows("user")[0].journalCount = 1;

    const result = await updateJournal(form(journalFields, true), "j1");

    expect(result.success).toBe(true);
    expect(fakeDb.rows("journal")[0].isAnonymous).toBe(true);
    expect(fakeDb.rows("user")[0].journalCount).toBe(0);
    expect(fakeDb.rows("userActivity")).toHaveLength(0);
  });

  it("flipping back to public restores the counter, activity and notifies followers", async () => {
    fakeDb.seed("journal", {
      id: "j1",
      authorId: AUTHOR,
      title: "Nature Fake",
      isAnonymous: true,
    });

    const result = await updateJournal(form(journalFields), "j1");

    expect(result.success).toBe(true);
    expect(fakeDb.rows("journal")[0].isAnonymous).toBe(false);
    expect(fakeDb.rows("user")[0].journalCount).toBe(1);
    expect(fakeDb.rows("userActivity")).toHaveLength(1);
    expect(fakeDb.rows("userActivity")[0].entityId).toBe("j1");
    expect(notifyFollowersOfActivity).toHaveBeenCalledTimes(1);
  });

  it("deleting an anonymous journal leaves the counter untouched", async () => {
    fakeDb.seed("journal", {
      id: "j1",
      authorId: AUTHOR,
      title: "Nature Fake",
      isAnonymous: true,
      totalVotes: 0,
      totalComments: 0,
      reviewCount: 0,
    });
    fakeDb.rows("user")[0].journalCount = 4;

    await deleteJournal("j1");

    expect(fakeDb.rows("journal")[0].isDeleted).toBe(true);
    expect(fakeDb.rows("user")[0].journalCount).toBe(4);
  });
});
