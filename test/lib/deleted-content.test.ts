import { describe, expect, it, vi, beforeEach } from "vitest";
import { getModeratorDeletedContent } from "@/lib/deleted-content";

const rows = vi.hoisted(() => ({
  socialPost: [] as Array<{ id: string; authorId: string | null; isDeleted: boolean; deletedByType: string | null; hasActiveAppeal: boolean }>,
  article: [] as Array<{ id: string; authorId: string | null; isDeleted: boolean; deletedByType: string | null; hasActiveAppeal: boolean }>,
  journal: [] as Array<{ id: string; authorId: string | null; isDeleted: boolean; deletedByType: string | null; hasActiveAppeal: boolean }>,
  researchEvent: [] as Array<{ id: string; authorId: string | null; isDeleted: boolean; deletedByType: string | null; hasActiveAppeal: boolean }>,
  researchGrant: [] as Array<{ id: string; authorId: string | null; isDeleted: boolean; deletedByType: string | null; hasActiveAppeal: boolean }>,
  helpPost: [] as Array<{ id: string; authorId: string | null; isDeleted: boolean; deletedByType: string | null; hasActiveAppeal: boolean }>,
  result: [] as Array<{ id: string; authorId: string | null; isDeleted: boolean; deletedByType: string | null; hasActiveAppeal: boolean }>,
  jobVacancy: [] as Array<{ id: string; authorId: string | null; isDeleted: boolean; deletedByType: string | null; hasActiveAppeal: boolean }>,
  phdAdmission: [] as Array<{ id: string; authorId: string | null; isDeleted: boolean; deletedByType: string | null; hasActiveAppeal: boolean }>,
  contribution: [] as Array<{ id: string; authorId: string | null; isDeleted: boolean; deletedByType: string | null; hasActiveAppeal: boolean }>,
  course: [] as Array<{ id: string; authorId: string | null; isDeleted: boolean; deletedByType: string | null; hasActiveAppeal: boolean }>,
  researchTool: [] as Array<{ id: string; authorId: string | null; isDeleted: boolean; deletedByType: string | null; hasActiveAppeal: boolean }>,
  supervisor: [] as Array<{ id: string; authorId: string | null; isDeleted: boolean; deletedByType: string | null; hasActiveAppeal: boolean }>,
  recommendation: [] as Array<{ id: string; authorId: string | null; isDeleted: boolean; deletedByType: string | null; hasActiveAppeal: boolean }>,
  researchSurvey: [] as Array<{ id: string; authorId: string | null; isDeleted: boolean; deletedByType: string | null; hasActiveAppeal: boolean }>,
  journalReview: [] as Array<{ id: string; authorId: string | null; isDeleted: boolean; deletedByType: string | null; hasActiveAppeal: boolean }>,
  publication: [] as Array<{ id: string; authorId: string | null; isDeleted: boolean; deletedByType: string | null; hasActiveAppeal: boolean }>,
}));

vi.mock("@/lib/db", () => {
  const makeFindUnique = (model: keyof typeof rows) => vi.fn(async (args: { where: Record<string, unknown>; select: Record<string, boolean> }) => {
    const { where } = args;
    const row = rows[model].find((r) => {
      if (where.id !== undefined && r.id !== where.id) return false;
      if (where.slug !== undefined && r.id !== where.slug) return false;
      if (where.isDeleted !== undefined && r.isDeleted !== where.isDeleted) return false;
      if (where.deletedByType !== undefined && r.deletedByType !== where.deletedByType) return false;
      return true;
    });
    if (!row) return null;
    return { id: row.id, authorId: row.authorId, isDeleted: row.isDeleted, deletedByType: row.deletedByType, hasActiveAppeal: row.hasActiveAppeal };
  });
  const obj: Record<string, { findUnique: ReturnType<typeof vi.fn> }> = {};
  for (const model of Object.keys(rows)) {
    obj[model] = { findUnique: makeFindUnique(model as keyof typeof rows) };
  }
  return { default: obj };
});

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
  isUserAdmin: vi.fn(),
}));

import prisma from "@/lib/db";
import { getCurrentUser, isUserAdmin } from "@/lib/auth";

const mockPrisma = prisma as unknown as Record<string, { findUnique: ReturnType<typeof vi.fn> }>;

function seed(model: keyof typeof rows, row: (typeof rows)[keyof typeof rows][number]) {
  rows[model].push(row);
}

describe("getModeratorDeletedContent access matrix", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    for (const model of Object.keys(rows) as (keyof typeof rows)[]) rows[model] = [];
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (isUserAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(false);
  });

  it("returns null for anonymous viewers (404 for everyone)", async () => {
    seed("socialPost", { id: "p-1", authorId: "author-1", isDeleted: true, deletedByType: "ADMIN", hasActiveAppeal: true });
    const result = await getModeratorDeletedContent("feed", { id: "p-1" });
    expect(result).toBeNull();
  });

  it("returns null for author-deleted content even for the author", async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "author-1" });
    seed("socialPost", { id: "p-1", authorId: "author-1", isDeleted: true, deletedByType: "AUTHOR", hasActiveAppeal: false });
    const result = await getModeratorDeletedContent("feed", { id: "p-1" });
    expect(result).toBeNull();
  });

  it("returns null for non-admin, non-author on moderator-deleted content", async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "viewer-2" });
    seed("socialPost", { id: "p-1", authorId: "author-1", isDeleted: true, deletedByType: "ADMIN", hasActiveAppeal: true });
    const result = await getModeratorDeletedContent("feed", { id: "p-1" });
    expect(result).toBeNull();
  });

  it("returns the row for the author of moderator-deleted content", async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "author-1" });
    seed("socialPost", { id: "p-1", authorId: "author-1", isDeleted: true, deletedByType: "ADMIN", hasActiveAppeal: true });
    const result = await getModeratorDeletedContent("feed", { id: "p-1" });
    expect(result).toEqual({ id: "p-1", authorId: "author-1", hasActiveAppeal: true });
  });

  it("returns the row for an admin on moderator-deleted content", async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "admin-1" });
    (isUserAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    seed("socialPost", { id: "p-1", authorId: "author-1", isDeleted: true, deletedByType: "ADMIN", hasActiveAppeal: false });
    const result = await getModeratorDeletedContent("feed", { id: "p-1" });
    expect(result).toEqual({ id: "p-1", authorId: "author-1", hasActiveAppeal: false });
  });

  it("returns null when the row is not deleted", async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "author-1" });
    seed("socialPost", { id: "p-1", authorId: "author-1", isDeleted: false, deletedByType: null, hasActiveAppeal: false });
    const result = await getModeratorDeletedContent("feed", { id: "p-1" });
    expect(result).toBeNull();
  });

  it("returns null when the row does not exist", async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "author-1" });
    const result = await getModeratorDeletedContent("feed", { id: "p-1" });
    expect(result).toBeNull();
  });

  it("uses the slug lookup for articles", async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "author-1" });
    seed("article", { id: "my-article", authorId: "author-1", isDeleted: true, deletedByType: "ADMIN", hasActiveAppeal: false });
    const result = await getModeratorDeletedContent("blog", { slug: "my-article" });
    expect(mockPrisma.article.findUnique).toHaveBeenCalledWith({
      where: { slug: "my-article", isDeleted: true, deletedByType: "ADMIN" },
      select: expect.any(Object),
    });
    expect(result).toEqual({ id: "my-article", authorId: "author-1", hasActiveAppeal: false });
  });

  it("returns null for unknown content types", async () => {
    const result = await getModeratorDeletedContent("nonexistent", { id: "x" });
    expect(result).toBeNull();
  });
});
