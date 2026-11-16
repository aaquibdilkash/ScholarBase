/**
 * Course fields added for the Learning Zone fixes.
 *
 * Three properties matter here:
 *   1. Free/Paid is stored independently of the amount (the form asks for both),
 *      so a FREE row keeps whatever price was entered and a PAID row may omit it.
 *   2. Price and duration accept decimals and are capped at 6 characters, and
 *      the server enforces that itself — the form's truncation is not trusted.
 *   3. Language is a closed list; anything else is rejected at the boundary.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";
import { createCourse, updateCourse } from "@/app/actions/courses";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const AUTHOR = "u-author";
const LINK = "https://example.org/course";

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

vi.mock("@/lib/activity", () => ({
  hideContentActivity: vi.fn(async () => {}),
}));

const formOf = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.append(key, value);
  return fd;
};

const baseFields = (overrides: Record<string, string> = {}) => ({
  title: "Research Methodology",
  link: LINK,
  description: "<p>Learn methods</p>",
  pricing: "FREE",
  ...overrides,
});

describe("course fields", () => {
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
        courseCount: 0,
      },
    ]);
  });

  it("stores Free/Paid independently of the amount", async () => {
    const result = await createCourse(
      formOf(baseFields({ pricing: "FREE", price: "499" })),
    );
    expect(result.success).toBe(true);

    const [row] = fakeDb.rows("course");
    expect(row.pricing).toBe("FREE");
    expect(row.price).toBe(499);
    expect(row.language).toBeNull();
  });

  it("stores a paid course with decimal price and duration", async () => {
    await createCourse(
      formOf(
        baseFields({
          pricing: "PAID",
          price: "9.99",
          durationValue: "1.5",
          durationUnit: "hours",
          language: "English",
        }),
      ),
    );

    const [row] = fakeDb.rows("course");
    expect(row.pricing).toBe("PAID");
    expect(row.price).toBe(9.99);
    expect(row.durationValue).toBe(1.5);
    expect(row.durationUnit).toBe("hours");
    expect(row.language).toBe("English");
  });

  it("rejects a missing or unknown pricing choice", async () => {
    const missing = await createCourse(
      formOf(baseFields({ pricing: "" })),
    );
    expect(missing.success).toBe(false);

    const unknown = await createCourse(
      formOf(baseFields({ pricing: "paid" })),
    );
    expect(unknown.success).toBe(false);

    expect(fakeDb.rows("course")).toHaveLength(0);
  });

  it("rejects a price or duration longer than six characters", async () => {
    const price = await createCourse(
      formOf(baseFields({ price: "1234.56" })),
    );
    expect(price.success).toBe(false);

    const duration = await createCourse(
      formOf(
        baseFields({ durationValue: "1234.56", durationUnit: "hours" }),
      ),
    );
    expect(duration.success).toBe(false);

    expect(fakeDb.rows("course")).toHaveLength(0);
  });

  it("rejects a language outside the dropdown list", async () => {
    const result = await createCourse(
      formOf(baseFields({ language: "Klingon" })),
    );
    expect(result.success).toBe(false);
    expect(fakeDb.rows("course")).toHaveLength(0);
  });

  it("lets an edit change the classification without touching the amount", async () => {
    fakeDb.seed("course", [
      {
        id: "course-1",
        authorId: AUTHOR,
        title: "Old",
        pricing: "PAID",
        price: 499,
        currency: "INR",
        link: LINK,
        description: "<p>Old</p>",
      },
    ]);

    const result = await updateCourse(
      formOf(
        baseFields({
          pricing: "FREE",
          price: "499",
          language: "Hindi",
        }),
      ),
      "course-1",
    );
    expect(result.success).toBe(true);

    const [row] = fakeDb.rows("course");
    expect(row.pricing).toBe("FREE");
    expect(row.price).toBe(499);
    expect(row.language).toBe("Hindi");
  });
});
