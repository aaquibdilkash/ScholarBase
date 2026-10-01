/**
 * The admin panel's access control.
 *
 * The existing admin tests (`test/transactions/admin-moderation.test.ts`) cover
 * the CONSEQUENCES of moderation — that DELETE reverses vote-derived reputation,
 * RECOVER restores it, nothing double-charges. Those are excellent and are not
 * touched here.
 *
 * What was entirely untested is the question in front of that one: CAN a
 * non-admin reach these functions at all. All ten `admin.ts` exports are server
 * actions, callable directly from the client without going through the admin UI,
 * so the UI hiding a button is not a defence. Each one re-checks `isUserAdmin`
 * itself, which is correct but unverified.
 *
 * Written as one data-driven matrix over every export, so adding an export
 * without a gate is a visible gap rather than a silent one.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";
import * as admin from "@/app/actions/admin";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const ADMIN = "u-admin";
const USER = "u-user";

let session: { id: string } | null = null;
let isAdmin = false;

vi.mock("@/lib/auth", () => ({
  requireCurrentUser: vi.fn(async () => {
    if (!session) throw new Error("Log in to access admin.");
    return session;
  }),
  requireActiveUser: vi.fn(async () => {
    if (!session) throw new Error("Log in to access admin.");
    return session;
  }),
  isUserAdmin: vi.fn(async () => isAdmin),
}));
vi.mock("@/lib/tri-split/modules/registry", () => ({
  revalidateContent: vi.fn(),
  loadContentPage: vi.fn(async () => []),
}));
vi.mock("@/lib/qstash", () => ({ queueNotification: vi.fn(async () => {}) }));
vi.mock("@/lib/notifications", () => ({
  notifyUserById: vi.fn(async () => {}),
}));

/** Every export of `admin.ts`, with plausible arguments. */
const CALLS: { name: string; invoke: () => Promise<unknown> }[] = [
  { name: "toggleContentFreeze", invoke: () => admin.toggleContentFreeze("article", "c1") },
  { name: "toggleAuthorFreeze", invoke: () => admin.toggleAuthorFreeze("u-author") },
  { name: "getAdminStats", invoke: () => admin.getAdminStats() },
  { name: "getAdminInstitutionDomainRequests", invoke: () => admin.getAdminInstitutionDomainRequests() },
  { name: "reviewInstitutionDomainRequest", invoke: () => admin.reviewInstitutionDomainRequest("r1", "APPROVED") },
  { name: "getAdminAppeals", invoke: () => admin.getAdminAppeals() },
  { name: "getAdminUsers", invoke: () => admin.getAdminUsers() },
  { name: "updateContributionStatus", invoke: () => admin.updateContributionStatus("k1", "APPROVED") },
  { name: "getAdminContent", invoke: () => admin.getAdminContent() },
  { name: "getReportsForEntity", invoke: () => admin.getReportsForEntity("article", "c1") },
];

beforeEach(() => {
  resetFakeDb();
  isAdmin = false;
  session = { id: USER };
  fakeDb.seed("user", [
    { id: ADMIN, isDeleted: false, reputation: 0 },
    { id: USER, isDeleted: false, reputation: 0 },
  ]);
});

describe("admin.ts access control", () => {
  it("covers every exported action", () => {
    // If a new export is added without a row here, this fails — which is the
    // point: an ungated admin action should be impossible to add silently.
    const exported = Object.keys(admin).filter((k) => typeof admin[k as keyof typeof admin] === "function");
    expect(CALLS.map((c) => c.name).sort()).toEqual(exported.sort());
  });

  describe.each(CALLS)("$name", ({ invoke }) => {
    it("refuses a non-admin", async () => {
      await expect(invoke()).rejects.toThrow(/Not authorized/i);
    });

    it("refuses an anonymous caller", async () => {
      session = null;
      await expect(invoke()).rejects.toThrow();
    });

    it("admits an admin (no authorization error)", async () => {
      isAdmin = true;
      session = { id: ADMIN };
      // Some read actions need seeded rows and may throw for other reasons; the
      // contract under test is only that the AUTHORIZATION gate lets them past.
      await invoke().catch((error: Error) => {
        expect(error.message).not.toMatch(/Not authorized/i);
      });
    });
  });

  it("never lets a non-admin flip a content freeze", async () => {
    // The concrete harm: freezing other people's content is a moderation power.
    await expect(admin.toggleContentFreeze("article", "c1")).rejects.toThrow(
      /Not authorized/i,
    );
  });

  it("never lets a non-admin approve an institution domain request", async () => {
    // Approving a domain adds it to the allowlist, which is what gates the
    // verified badge. This is the most valuable admin power in the app.
    await expect(
      admin.reviewInstitutionDomainRequest("r1", "APPROVED"),
    ).rejects.toThrow(/Not authorized/i);
  });

  it("never lets a non-admin freeze another author", async () => {
    await expect(admin.toggleAuthorFreeze("u-author")).rejects.toThrow(
      /Not authorized/i,
    );
  });

  it("never lets a non-admin approve a contribution", async () => {
    await expect(
      admin.updateContributionStatus("k1", "APPROVED"),
    ).rejects.toThrow(/Not authorized/i);
  });
});
