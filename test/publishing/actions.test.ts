/**
 * Venue provisioning guards.
 *
 * The publish gate is the point of this suite: `isPublished` is what puts a
 * venue into the sitemap, and an empty venue that a crawler indexes is thin
 * content that is very hard to remove later. The tests pin that publishing is
 * refused until the editor, aims, and board exist — and that a rate-limit
 * denial is returned to the caller rather than swallowed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  venueFindUnique: vi.fn(),
  venueCreate: vi.fn(),
  venueUpdate: vi.fn(),
  venueDelete: vi.fn(),
  boardFindMany: vi.fn(),
  manuscriptFindFirst: vi.fn(),
  userFindUnique: vi.fn(),
  roleUpsert: vi.fn(),
  roleFindFirst: vi.fn(),
  roleDeleteMany: vi.fn(),
  boardDeleteMany: vi.fn(),
  boardCreateMany: vi.fn(),
  transaction: vi.fn(),
  revalidatePath: vi.fn(),
  requireAdmin: vi.fn(),
  requireCurrentUser: vi.fn(),
  getActiveUser: vi.fn(),
  isUserAdmin: vi.fn(),
  enforceRateLimit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  default: {
    venue: {
      findUnique: mocks.venueFindUnique,
      create: mocks.venueCreate,
      update: mocks.venueUpdate,
      delete: mocks.venueDelete,
    },
    editorialBoardMember: {
      findMany: mocks.boardFindMany,
      deleteMany: mocks.boardDeleteMany,
      createMany: mocks.boardCreateMany,
    },
    manuscript: { findFirst: mocks.manuscriptFindFirst },
    user: { findUnique: mocks.userFindUnique },
    editorialRole: {
      upsert: mocks.roleUpsert,
      findFirst: mocks.roleFindFirst,
      deleteMany: mocks.roleDeleteMany,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: mocks.requireAdmin,
  requireCurrentUser: mocks.requireCurrentUser,
  getActiveUser: mocks.getActiveUser,
  isUserAdmin: mocks.isUserAdmin,
}));
vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  createVenueAction,
  deleteVenueAction,
  grantEditorialRoleAction,
  revokeEditorialRoleAction,
  setVenuePublishedAction,
  type VenueActionResult,
} from "@/app/actions/publishing";

const EMPTY: VenueActionResult = { success: false, message: "" };

function formWith(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

const READY_VENUE = {
  id: "venue-1",
  name: "Indian Journal of Optics",
  slug: "indian-journal-of-optics",
  isPublished: false,
  editorName: "Dr A. Editor",
  aimsAndScope: "Optics, photonics, and applied spectroscopy.",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
  mocks.requireCurrentUser.mockResolvedValue({ id: "editor-1" });
  mocks.getActiveUser.mockResolvedValue({ frozen: false, user: { id: "editor-1" } });
  mocks.isUserAdmin.mockResolvedValue(false);
  mocks.enforceRateLimit.mockResolvedValue({ allowed: true });
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<void>) =>
    callback({
      venue: { update: mocks.venueUpdate, delete: mocks.venueDelete },
      editorialBoardMember: { deleteMany: mocks.boardDeleteMany, createMany: mocks.boardCreateMany },
      editorialRole: { deleteMany: mocks.roleDeleteMany },
    }),
  );
});

describe("createVenueAction", () => {
  it("rejects a name outside the length bounds", async () => {
    const result = await createVenueAction(
      EMPTY,
      formWith({ name: "AB", slug: "ab-venue", type: "JOURNAL" }),
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/name/i);
    expect(mocks.venueCreate).not.toHaveBeenCalled();
  });

  it("rejects a slug that normalizes to nothing usable", async () => {
    const result = await createVenueAction(
      EMPTY,
      formWith({ name: "Indian Journal", slug: "!!!", type: "JOURNAL" }),
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/slug/i);
    expect(mocks.venueCreate).not.toHaveBeenCalled();
  });

  it("normalizes a pasted title into a slug", async () => {
    mocks.venueFindUnique.mockResolvedValue(null);
    mocks.venueCreate.mockResolvedValue({
      name: "Indian Journal",
      slug: "indian-journal",
    });

    const result = await createVenueAction(
      EMPTY,
      formWith({ name: "Indian Journal", slug: "Indian Journal", type: "JOURNAL" }),
    );

    expect(result.success).toBe(true);
    expect(mocks.venueCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: "indian-journal" }),
      }),
    );
  });

  it("rejects an unknown venue type", async () => {
    const result = await createVenueAction(
      EMPTY,
      formWith({ name: "Indian Journal", slug: "indian-journal", type: "BLOG" }),
    );

    expect(result.success).toBe(false);
    expect(mocks.venueCreate).not.toHaveBeenCalled();
  });

  it("rejects a duplicate slug", async () => {
    mocks.venueFindUnique.mockResolvedValue({ id: "existing" });

    const result = await createVenueAction(
      EMPTY,
      formWith({ name: "Indian Journal", slug: "indian-journal", type: "JOURNAL" }),
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/already used/i);
    expect(mocks.venueCreate).not.toHaveBeenCalled();
  });

  it("creates the venue unpublished", async () => {
    mocks.venueFindUnique.mockResolvedValue(null);
    mocks.venueCreate.mockResolvedValue({
      name: "Indian Journal of Optics",
      slug: "indian-journal-of-optics",
    });

    const result = await createVenueAction(
      EMPTY,
      formWith({
        name: "Indian Journal of Optics",
        slug: "indian-journal-of-optics",
        type: "JOURNAL",
      }),
    );

    expect(result.success).toBe(true);
    expect(mocks.venueCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: "indian-journal-of-optics",
          type: "JOURNAL",
          isPublished: false,
        }),
      }),
    );
  });

  it("returns the rate-limit denial instead of throwing", async () => {
    mocks.enforceRateLimit.mockResolvedValue({
      allowed: false,
      error: "Too many requests. Please slow down.",
    });

    const result = await createVenueAction(
      EMPTY,
      formWith({ name: "Indian Journal", slug: "indian-journal", type: "JOURNAL" }),
    );

    expect(result).toEqual({
      success: false,
      message: "Too many requests. Please slow down.",
    });
    expect(mocks.venueFindUnique).not.toHaveBeenCalled();
  });
});

describe("setVenuePublishedAction", () => {
  it("refuses to publish a venue with no editor, aims, or board", async () => {
    mocks.venueFindUnique.mockResolvedValue({
      ...READY_VENUE,
      editorName: null,
      aimsAndScope: null,
    });
    mocks.boardFindMany.mockResolvedValue([]);

    const result = await setVenuePublishedAction(
      EMPTY,
      formWith({ venueId: "venue-1", published: "true" }),
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/editor-in-chief/i);
    expect(result.message).toMatch(/aims/i);
    expect(result.message).toMatch(/board/i);
    expect(mocks.venueUpdate).not.toHaveBeenCalled();
  });

  it("publishes once the venue is ready", async () => {
    mocks.venueFindUnique.mockResolvedValue(READY_VENUE);
    mocks.boardFindMany.mockResolvedValue([{ id: "board-1" }]);

    const result = await setVenuePublishedAction(
      EMPTY,
      formWith({ venueId: "venue-1", published: "true" }),
    );

    expect(result.success).toBe(true);
    expect(mocks.venueUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "venue-1" },
        data: expect.objectContaining({ isPublished: true }),
      }),
    );
  });

  it("unpublishes without running the readiness checks", async () => {
    mocks.venueFindUnique.mockResolvedValue({
      ...READY_VENUE,
      isPublished: true,
      editorName: null,
      aimsAndScope: null,
    });

    const result = await setVenuePublishedAction(
      EMPTY,
      formWith({ venueId: "venue-1", published: "false" }),
    );

    expect(result.success).toBe(true);
    expect(mocks.boardFindMany).not.toHaveBeenCalled();
    expect(mocks.venueUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPublished: false, launchedAt: null }),
      }),
    );
  });

  it("reports a venue that no longer exists", async () => {
    mocks.venueFindUnique.mockResolvedValue(null);

    const result = await setVenuePublishedAction(
      EMPTY,
      formWith({ venueId: "gone", published: "true" }),
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/no longer exists/i);
  });
});

describe("deleteVenueAction", () => {
  it("deletes an empty unpublished venue and its roles/board", async () => {
    mocks.venueFindUnique.mockResolvedValue({
      id: "venue-1",
      name: "Draft Venue",
      slug: "draft-venue",
      type: "JOURNAL",
      isPublished: false,
    });
    mocks.manuscriptFindFirst.mockResolvedValue(null);

    const result = await deleteVenueAction(EMPTY, formWith({ venueId: "venue-1" }));

    expect(result.success).toBe(true);
    expect(mocks.roleDeleteMany).toHaveBeenCalledWith({ where: { venueId: "venue-1" } });
    expect(mocks.boardDeleteMany).toHaveBeenCalledWith({ where: { venueId: "venue-1" } });
    expect(mocks.venueDelete).toHaveBeenCalledWith({ where: { id: "venue-1" } });
  });

  it("protects published venues and venues with manuscript history", async () => {
    mocks.venueFindUnique.mockResolvedValue({
      id: "venue-1",
      name: "Published Venue",
      slug: "published-venue",
      type: "JOURNAL",
      isPublished: true,
    });
    let result = await deleteVenueAction(EMPTY, formWith({ venueId: "venue-1" }));
    expect(result.message).toMatch(/unpublish/i);

    mocks.venueFindUnique.mockResolvedValue({
      id: "venue-1",
      name: "Draft Venue",
      slug: "draft-venue",
      type: "JOURNAL",
      isPublished: false,
    });
    mocks.manuscriptFindFirst.mockResolvedValue({ id: "manuscript-1" });
    result = await deleteVenueAction(EMPTY, formWith({ venueId: "venue-1" }));
    expect(result.message).toMatch(/manuscript history/i);
  });
});

describe("updateVenueSettingsAction", () => {
  it("saves venue profile, policies, and the structured board for its editor-in-chief", async () => {
    mocks.venueFindUnique.mockResolvedValue({
      id: "venue-1",
      name: "Indian Journal of Optics",
      slug: "indian-journal-of-optics",
      type: "JOURNAL",
    });
    mocks.roleFindFirst.mockResolvedValue({ id: "seat-1" });

    const result = await (await import("@/app/actions/publishing")).updateVenueSettingsAction(
      EMPTY,
      formWith({
        venueId: "venue-1",
        name: "Updated Journal of Optics",
        editorName: "Dr A. Editor",
        editorAffiliation: "Optics Institute",
        frequency: "Quarterly",
        contactEmail: "editor@example.com",
        aimsAndScope: "<p>Optics <script>alert(1)</script></p>",
        authorGuidelines: "<p>Submit a PDF.</p>",
        peerReviewPolicy: "<p>Double blind.</p>",
        ethicsPolicy: "<p>COPE principles.</p>",
        boardName: "Dr A. Editor",
        boardRoleTitle: "Editor-in-Chief",
        boardAffiliation: "Optics Institute",
        boardOrcid: "0000-0000-0000-0000",
      }),
    );

    expect(result.success).toBe(true);
    expect(mocks.transaction).toHaveBeenCalled();
    expect(mocks.venueUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "venue-1" },
        data: expect.objectContaining({
          name: "Updated Journal of Optics",
          aimsAndScope: "<p>Optics </p>",
          authorGuidelines: "<p>Submit a PDF.</p>",
        }),
      }),
    );
    expect(mocks.boardDeleteMany).toHaveBeenCalledWith({ where: { venueId: "venue-1" } });
    expect(mocks.boardCreateMany).toHaveBeenCalledWith({
      data: [{
        name: "Dr A. Editor",
        roleTitle: "Editor-in-Chief",
        affiliation: "Optics Institute",
        orcid: "0000-0000-0000-0000",
        venueId: "venue-1",
      }],
    });
  });

  it("rejects a settings update from a user without the venue editor seat", async () => {
    mocks.venueFindUnique.mockResolvedValue({ id: "venue-1", name: "Journal", slug: "journal", type: "JOURNAL" });
    mocks.roleFindFirst.mockResolvedValue(null);

    const result = await (await import("@/app/actions/publishing")).updateVenueSettingsAction(
      EMPTY,
      formWith({ venueId: "venue-1", editorName: "Someone" }),
    );

    expect(result).toEqual({
      success: false,
      message: "Only this venue's editor-in-chief can edit its settings.",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("grantEditorialRoleAction", () => {
  it("rejects a malformed email before touching the database", async () => {
    const result = await grantEditorialRoleAction(
      EMPTY,
      formWith({
        venueId: "venue-1",
        email: "not-an-email",
        roleTitle: "EDITOR_IN_CHIEF",
      }),
    );

    expect(result.success).toBe(false);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("rejects an unknown or deleted account", async () => {
    mocks.venueFindUnique.mockResolvedValue({ name: "Journal" });
    mocks.userFindUnique.mockResolvedValue(null);

    const result = await grantEditorialRoleAction(
      EMPTY,
      formWith({
        venueId: "venue-1",
        email: "editor@institution.ac.in",
        roleTitle: "EDITOR_IN_CHIEF",
      }),
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/no active ScholarBase account/i);
    expect(mocks.roleUpsert).not.toHaveBeenCalled();
  });

  it("grants the role idempotently", async () => {
    mocks.venueFindUnique.mockResolvedValue({ name: "Journal" });
    mocks.userFindUnique.mockResolvedValue({
      id: "user-1",
      name: "Dr Editor",
      isDeleted: false,
    });

    const result = await grantEditorialRoleAction(
      EMPTY,
      formWith({
        venueId: "venue-1",
        email: "Editor@Institution.ac.in",
        roleTitle: "ASSOC_EDITOR",
      }),
    );

    expect(result.success).toBe(true);
    expect(mocks.roleUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_venueId_roleTitle: {
            userId: "user-1",
            venueId: "venue-1",
            roleTitle: "ASSOC_EDITOR",
          },
        },
        update: {},
      }),
    );
  });
});

describe("revokeEditorialRoleAction", () => {
  it("treats an already-revoked role as a miss, not a crash", async () => {
    mocks.roleDeleteMany.mockResolvedValue({ count: 0 });

    const result = await revokeEditorialRoleAction(
      EMPTY,
      formWith({ roleId: "role-1" }),
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/no longer exists/i);
  });

  it("revokes an existing role", async () => {
    mocks.roleDeleteMany.mockResolvedValue({ count: 1 });

    const result = await revokeEditorialRoleAction(
      EMPTY,
      formWith({ roleId: "role-1" }),
    );

    expect(result.success).toBe(true);
    expect(mocks.roleDeleteMany).toHaveBeenCalledWith({
      where: { id: "role-1" },
    });
  });
});
