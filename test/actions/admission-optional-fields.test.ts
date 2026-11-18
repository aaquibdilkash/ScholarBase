/**
 * Optional admission fields.
 *
 * Department/faculty and the institution location are optional. The form
 * omits them, but a form can be bypassed, so the server must store an empty
 * value as `NULL` (never `""`) and must still enforce the declared max length.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";
import { createAdmission, updateAdmission } from "@/app/actions/admissions";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const AUTHOR = "u-author";
const URL_FIELD = "https://example.org/apply";

let mockCurrentUser: { id: string } | null = null;

vi.mock("@/lib/auth", () => ({
  getActiveUser: vi.fn(async () => {
    if (!mockCurrentUser) throw new Error("Not logged in");
    return { frozen: false, user: mockCurrentUser, message: "" };
  }),
  requireCurrentUser: vi.fn(async () => {
    if (!mockCurrentUser) throw new Error("Not logged in");
    return mockCurrentUser;
  }),
  isAuthorizedOrAdmin: vi.fn(
    async (ownerId: string, userId: string) => ownerId === userId,
  ),
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(async () => ({ allowed: true })),
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    limited: false,
    degraded: false,
  })),
}));

vi.mock("@/lib/tri-split/modules/registry", () => ({
  revalidateContent: vi.fn(),
  loadContentPage: vi.fn(async () => []),
}));

vi.mock("@/lib/tri-split/modules/profile-tab", () => ({
  revalidateBookmarkersForDeletedContent: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  notifyFollowersOfActivity: vi.fn(async () => {}),
  deleteAllNotificationsForContent: vi.fn(async () => {}),
}));

vi.mock("@/lib/qstash", () => ({ queueNotification: vi.fn(async () => {}) }));

// Storage is not part of this contract: keep the row-promotion step local and
// deterministic.
vi.mock("@/lib/content-images", () => ({
  promoteContentImages: vi.fn(
    async ({ html }: { html: string }) => ({
      ok: true as const,
      coverUrl: null,
      publishedHtml: html,
    }),
  ),
  findRemovedImagePaths: vi.fn(() => []),
}));

vi.mock("@/lib/supabase-storage", () => ({
  extractCoverImagePath: vi.fn(() => null),
  deleteContentImagePaths: vi.fn(async () => {}),
}));

const formOf = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.append(key, value);
  return fd;
};

const baseFields = (overrides: Record<string, string> = {}) => ({
  university: "Oxford",
  level: "PHD",
  deadline: "2030-01-01",
  description: "<p>Program</p>",
  notificationLink: URL_FIELD,
  applyLink: URL_FIELD,
  ...overrides,
});

describe("admission optional fields", () => {
  beforeEach(() => {
    resetFakeDb();
    mockCurrentUser = { id: AUTHOR };
    fakeDb.seed("user", [
      {
        id: AUTHOR,
        isDeleted: false,
        name: "Author",
        handle: "author",
        reputation: 0,
      },
    ]);
  });

  it("stores a missing department and location as null, not empty strings", async () => {
    const result = await createAdmission(formOf(baseFields()));
    expect(result.success).toBe(true);

    const [row] = fakeDb.rows("admission");
    expect(row.department).toBeNull();
    expect(row.location).toBeNull();
  });

  it("accepts university and department names up to 128 characters", async () => {
    const result = await createAdmission(
      formOf(
        baseFields({
          university: "U".repeat(128),
          department: "D".repeat(128),
        }),
      ),
    );

    expect(result.success).toBe(true);
    const [row] = fakeDb.rows("admission");
    expect(row.university).toHaveLength(128);
    expect(row.department).toHaveLength(128);
  });

  it("allows rolling admissions without a fixed deadline", async () => {
    const result = await createAdmission(
      formOf(baseFields({ deadline: "", isRolling: "on" })),
    );

    expect(result.success).toBe(true);
    const [row] = fakeDb.rows("admission");
    expect(row.deadline).toBeNull();
    expect(row.isRolling).toBe(true);
  });

  it("still requires a deadline for non-rolling admissions", async () => {
    await expect(
      createAdmission(formOf(baseFields({ deadline: "" }))),
    ).rejects.toThrow(/required unless applications are rolling/);
    expect(fakeDb.rows("admission")).toHaveLength(0);
  });

  it("trims the optional values that were supplied", async () => {
    await createAdmission(
      formOf(
        baseFields({ department: "  Computer Science  ", location: "  New Delhi  " }),
      ),
    );

    const [row] = fakeDb.rows("admission");
    expect(row.department).toBe("Computer Science");
    expect(row.location).toBe("New Delhi");
  });

  it("rejects a location past the declared limit", async () => {
    await expect(
      createAdmission(formOf(baseFields({ location: "x".repeat(65) }))),
    ).rejects.toThrow(/Location is too long/);
    expect(fakeDb.rows("admission")).toHaveLength(0);
  });

  it("persists location on edit and can clear department back to null", async () => {
    fakeDb.seed("admission", [
      {
        id: "adm-1",
        authorId: AUTHOR,
        department: "Physics",
        location: null,
        imageUrl: null,
        description: "<p>Old</p>",
      },
    ]);

    const result = await updateAdmission(
      formOf(baseFields({ department: "", location: "New Delhi" })),
      "adm-1",
    );
    expect(result.success).toBe(true);

    const [row] = fakeDb.rows("admission");
    expect(row.department).toBeNull();
    expect(row.location).toBe("New Delhi");
  });
});
