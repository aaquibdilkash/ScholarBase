/**
 * DOI minting action.
 *
 * Zenodo will happily create a second deposit, so these tests are mostly about
 * what the action refuses to do: mint twice, claim a page that already has a
 * DOI, or leave a PENDING row pointing at nothing. The HTTP client itself is
 * covered in `zenodo.test.ts`; here it is mocked so the orchestration and the
 * database writes are the subject.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  manuscriptFindUnique: vi.fn(),
  manuscriptUpdate: vi.fn(),
  manuscriptUpdateMany: vi.fn(),
  roleFindMany: vi.fn(),
  taskFindUnique: vi.fn(),
  getActiveUser: vi.fn(),
  isUserAdmin: vi.fn(),
  enforceRateLimit: vi.fn(),
  revalidatePath: vi.fn(),
  notifyUserById: vi.fn(),
  download: vi.fn(),
  isZenodoConfigured: vi.fn(),
  createDeposit: vi.fn(),
  getDeposit: vi.fn(),
  setMetadata: vi.fn(),
  uploadFile: vi.fn(),
  publishDeposit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  default: {
    manuscript: {
      findUnique: mocks.manuscriptFindUnique,
      update: mocks.manuscriptUpdate,
      updateMany: mocks.manuscriptUpdateMany,
    },
    editorialRole: { findMany: mocks.roleFindMany },
    reviewTask: { findUnique: mocks.taskFindUnique },
  },
}));

vi.mock("@/lib/auth", () => ({
  getActiveUser: mocks.getActiveUser,
  isUserAdmin: mocks.isUserAdmin,
}));
vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));
vi.mock("@/lib/notifications", () => ({
  notifyUserById: mocks.notifyUserById,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/url", () => ({
  getBaseUrl: async () => "https://scholarbase.app",
}));
vi.mock("@/utils/supabase/service", () => ({
  createServiceClient: () => ({
    storage: {
      from: () => ({ download: mocks.download }),
    },
  }),
}));
vi.mock("@/lib/publishing/zenodo", async () => {
  const actual = await vi.importActual<typeof import("@/lib/publishing/zenodo")>(
    "@/lib/publishing/zenodo",
  );
  return {
    ...actual,
    isZenodoConfigured: mocks.isZenodoConfigured,
    createZenodoDeposit: mocks.createDeposit,
    getZenodoDeposit: mocks.getDeposit,
    setZenodoMetadata: mocks.setMetadata,
    uploadZenodoFile: mocks.uploadFile,
    publishZenodoDeposit: mocks.publishDeposit,
  };
});

import { mintDoiAction, type DoiActionResult } from "@/app/actions/doi";
import { ZenodoError, type ZenodoDeposit } from "@/lib/publishing/zenodo";

const EMPTY: DoiActionResult = { success: false, message: "" };

function formWith(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

const MANUSCRIPT = {
  id: "manuscript-1",
  title: "Phase retrieval for sparse apertures",
  abstract: "We recover phase from undersampled data.",
  keywords: "optics, phase retrieval",
  coAuthors: {
    correspondingAuthor: {
      name: "Ada Lovelace",
      affiliation: "Analytical Engine Lab",
      orcid: "0000-0002-1825-0097",
    },
    coAuthors: [],
  },
  status: "PUBLISHED" as const,
  round: 0,
  authorId: "author-1",
  venueId: "venue-1",
  doi: null as string | null,
  doiStatus: "NONE" as const,
  zenodoDepositId: null as string | null,
  publishedAt: new Date("2026-03-04T00:00:00.000Z"),
  volume: 3,
  issue: 2,
  firstPage: "101",
  lastPage: "118",
  isbn: null,
  author: { name: "Ada Lovelace", orcidUrl: "0000-0002-1825-0097" },
  venue: {
    name: "Journal of Computing",
    slug: "jcs",
    type: "JOURNAL" as const,
    issn: "1234-567X",
    eissn: null,
    publisherName: "ScholarBase Press",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  },
  files: [{ filePath: "users/author-1/manuscripts/paper.pdf", fileName: "paper.pdf" }],
};

const IN_PROGRESS: ZenodoDeposit = {
  id: "dep-1",
  state: "inprogress",
  submitted: false,
  doi: null,
  doiUrl: null,
  recordUrl: null,
  bucketUrl: "https://zenodo.org/api/files/bucket",
  fileNames: [],
};

const PUBLISHED: ZenodoDeposit = {
  ...IN_PROGRESS,
  state: "done",
  submitted: true,
  doi: "10.5281/zenodo.42",
  doiUrl: "https://doi.org/10.5281/zenodo.42",
  recordUrl: "https://zenodo.org/records/42",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getActiveUser.mockResolvedValue({
    frozen: false,
    user: { id: "editor-1", email: "editor@university.edu" },
  });
  mocks.isUserAdmin.mockResolvedValue(false);
  mocks.enforceRateLimit.mockResolvedValue({ allowed: true });
  mocks.manuscriptFindUnique.mockResolvedValue(MANUSCRIPT);
  mocks.manuscriptUpdate.mockResolvedValue({});
  mocks.manuscriptUpdateMany.mockResolvedValue({ count: 1 });
  mocks.roleFindMany.mockResolvedValue([{ roleTitle: "EDITOR_IN_CHIEF" }]);
  mocks.taskFindUnique.mockResolvedValue(null);
  mocks.download.mockResolvedValue({
    data: { arrayBuffer: async () => new ArrayBuffer(16) },
    error: null,
  });
  mocks.isZenodoConfigured.mockReturnValue(true);
  mocks.createDeposit.mockResolvedValue(IN_PROGRESS);
  mocks.getDeposit.mockResolvedValue(IN_PROGRESS);
  mocks.setMetadata.mockResolvedValue(IN_PROGRESS);
  mocks.uploadFile.mockResolvedValue(undefined);
  mocks.publishDeposit.mockResolvedValue(PUBLISHED);
});

describe("mintDoiAction", () => {
  it("mints once and records the bare DOI", async () => {
    const result = await mintDoiAction(
      EMPTY,
      formWith({ manuscriptId: "manuscript-1" }),
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain("10.5281/zenodo.42");

    expect(mocks.createDeposit).toHaveBeenCalledTimes(1);
    expect(mocks.uploadFile).toHaveBeenCalledWith(
      "https://zenodo.org/api/files/bucket",
      "paper.pdf",
      expect.any(ArrayBuffer),
    );
    expect(mocks.publishDeposit).toHaveBeenCalledWith("dep-1");
    expect(mocks.manuscriptUpdate).toHaveBeenLastCalledWith({
      where: { id: "manuscript-1" },
      data: {
        doi: "10.5281/zenodo.42",
        doiStatus: "MINTED",
        zenodoDepositId: "dep-1",
      },
    });
    expect(mocks.notifyUserById).toHaveBeenCalledWith(
      expect.objectContaining({ type: "manuscript-doi", recipientId: "author-1" }),
    );
  });

  it("does not create a second deposit when the DOI is already recorded", async () => {
    mocks.manuscriptFindUnique.mockResolvedValue({
      ...MANUSCRIPT,
      doi: "10.5281/zenodo.1",
      doiStatus: "MINTED",
    });

    const result = await mintDoiAction(
      EMPTY,
      formWith({ manuscriptId: "manuscript-1" }),
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain("already has DOI");
    expect(mocks.createDeposit).not.toHaveBeenCalled();
    expect(mocks.publishDeposit).not.toHaveBeenCalled();
  });

  it("resumes a deposit that Zenodo already published", async () => {
    mocks.manuscriptFindUnique.mockResolvedValue({
      ...MANUSCRIPT,
      doiStatus: "FAILED",
      zenodoDepositId: "dep-1",
    });
    mocks.getDeposit.mockResolvedValue(PUBLISHED);

    const result = await mintDoiAction(
      EMPTY,
      formWith({ manuscriptId: "manuscript-1" }),
    );

    expect(result.success).toBe(true);
    expect(mocks.createDeposit).not.toHaveBeenCalled();
    expect(mocks.uploadFile).not.toHaveBeenCalled();
    expect(mocks.publishDeposit).not.toHaveBeenCalled();
    expect(mocks.manuscriptUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ doiStatus: "MINTED" }),
      }),
    );
  });

  it("marks the attempt FAILED when publish throws", async () => {
    mocks.publishDeposit.mockRejectedValue(new ZenodoError("quota exceeded"));

    const result = await mintDoiAction(
      EMPTY,
      formWith({ manuscriptId: "manuscript-1" }),
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("quota exceeded");
    expect(mocks.manuscriptUpdateMany).toHaveBeenCalledWith({
      where: { id: "manuscript-1", doiStatus: "PENDING" },
      data: { doiStatus: "FAILED" },
    });
  });

  it("refuses a paper that is not published", async () => {
    mocks.manuscriptFindUnique.mockResolvedValue({
      ...MANUSCRIPT,
      status: "ACCEPTED_JOURNAL",
    });

    const result = await mintDoiAction(
      EMPTY,
      formWith({ manuscriptId: "manuscript-1" }),
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("Only a published article");
    expect(mocks.createDeposit).not.toHaveBeenCalled();
  });

  it("refuses a seat that cannot publish", async () => {
    mocks.roleFindMany.mockResolvedValue([{ roleTitle: "ASSOC_EDITOR" }]);

    const result = await mintDoiAction(
      EMPTY,
      formWith({ manuscriptId: "manuscript-1" }),
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("Editor-in-Chief");
    expect(mocks.createDeposit).not.toHaveBeenCalled();
  });

  it("degrades honestly when Zenodo is not configured", async () => {
    mocks.isZenodoConfigured.mockReturnValue(false);

    const result = await mintDoiAction(
      EMPTY,
      formWith({ manuscriptId: "manuscript-1" }),
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("ZENODO_TOKEN");
    expect(mocks.manuscriptUpdateMany).not.toHaveBeenCalled();
    expect(mocks.createDeposit).not.toHaveBeenCalled();
  });

  it("refuses to mint from a paper with no PDF", async () => {
    mocks.manuscriptFindUnique.mockResolvedValue({ ...MANUSCRIPT, files: [] });

    const result = await mintDoiAction(
      EMPTY,
      formWith({ manuscriptId: "manuscript-1" }),
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("PDF");
    expect(mocks.manuscriptUpdateMany).not.toHaveBeenCalled();
  });

  it("does not start a second mint while another is in flight", async () => {
    mocks.manuscriptUpdateMany.mockResolvedValueOnce({ count: 0 });
    mocks.manuscriptFindUnique
      .mockResolvedValueOnce(MANUSCRIPT)
      .mockResolvedValueOnce({ doi: null });

    const result = await mintDoiAction(
      EMPTY,
      formWith({ manuscriptId: "manuscript-1" }),
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("already in progress");
    expect(mocks.createDeposit).not.toHaveBeenCalled();
  });
});
