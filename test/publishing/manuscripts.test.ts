/**
 * Author-initiated conference → journal transfer.
 *
 * Four paths are pinned here:
 *   - `inviteAuthorToJournalAction` only invites; it must never create the
 *     journal row;
 *   - `createManuscriptSubmissionAction` records a journal row only after the
 *     uploaded object is re-verified, and refuses a duplicate clone;
 *   - `declineTransferInvitationAction` appends `TRANSFER_DECLINED` and leaves
 *     the original invitation untouched;
 *   - `publishManuscriptAction` is the only write that sets `PUBLISHED`, so it
 *     must enforce the transition, the EiC role, and the citation locator
 *     before a paper becomes public.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  manuscriptFindUnique: vi.fn(),
  manuscriptFindFirst: vi.fn(),
  manuscriptCreate: vi.fn(),
  manuscriptUpdateMany: vi.fn(),
  venueFindUnique: vi.fn(),
  roleFindMany: vi.fn(),
  roleFindFirst: vi.fn(),
  manuscriptRecusalFindUnique: vi.fn(),
  eventFindUnique: vi.fn(),
  eventFindFirst: vi.fn(),
  eventCreate: vi.fn(),
  fileFindFirst: vi.fn(),
  transaction: vi.fn(),
  getActiveUser: vi.fn(),
  isUserAdmin: vi.fn(),
  enforceRateLimit: vi.fn(),
  notifyUserById: vi.fn(),
  revalidatePath: vi.fn(),
  createUploadTicket: vi.fn(),
  verifyObject: vi.fn(),
  deleteObject: vi.fn(),
  pathBelongsToUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  default: {
    manuscript: {
      findUnique: mocks.manuscriptFindUnique,
      findFirst: mocks.manuscriptFindFirst,
      create: mocks.manuscriptCreate,
      updateMany: mocks.manuscriptUpdateMany,
    },
    venue: { findUnique: mocks.venueFindUnique },
    editorialRole: {
      findMany: mocks.roleFindMany,
      findFirst: mocks.roleFindFirst,
    },
    manuscriptRecusal: { findUnique: mocks.manuscriptRecusalFindUnique },
    manuscriptEvent: {
      findUnique: mocks.eventFindUnique,
      findFirst: mocks.eventFindFirst,
      create: mocks.eventCreate,
    },
    manuscriptFile: { findFirst: mocks.fileFindFirst },
    $transaction: mocks.transaction,
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

vi.mock("@/lib/manuscript-storage", () => ({
  createManuscriptUploadTicket: mocks.createUploadTicket,
  verifyManuscriptObject: mocks.verifyObject,
  deleteManuscriptObject: mocks.deleteObject,
  isManuscriptObjectPathForUser: mocks.pathBelongsToUser,
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  createDirectSubmissionAction,
  createManuscriptSubmissionAction,
  createManuscriptUploadUrlAction,
  declineTransferInvitationAction,
  inviteAuthorToJournalAction,
  publishManuscriptAction,
  withdrawManuscriptAction,
  type ManuscriptActionResult,
  type ManuscriptSubmitResult,
} from "@/app/actions/manuscripts";

const EMPTY: ManuscriptActionResult = { success: false, message: "" };
const EMPTY_SUBMIT: ManuscriptSubmitResult = { success: false, message: "" };
const SHA = "a".repeat(64);
const UPLOAD_PATH = `users/u-author/manuscripts/8f14e45f-ceea-467a-9f0e-${"b".repeat(12)}.pdf`;

const MANUSCRIPT = {
  id: "ms-conference",
  title: "Low-cost optics for rural clinics",
  status: "ACCEPTED_PROCEDINGS",
  authorId: "u-author",
  venueId: "venue-conference",
  venue: { name: "National Optics Conference", type: "CONFERENCE" },
};

const JOURNAL = {
  id: "venue-journal",
  name: "Indian Journal of Optics",
  slug: "indian-journal-of-optics",
  type: "JOURNAL",
  isPublished: true,
};

const SOURCE_ROLE = {
  venueId: "venue-conference",
  roleTitle: "TRACK_CHAIR" as const,
  userId: "u-editor",
};

/** An accepted journal paper, ready for the publication form. */
const PUBLISHABLE = {
  id: "ms-accepted",
  title: "Extended optics for rural clinics",
  status: "ACCEPTED_JOURNAL",
  authorId: "u-author",
  venueId: "venue-journal",
  venue: {
    name: "Indian Journal of Optics",
    slug: "indian-journal-of-optics",
    type: "JOURNAL",
  },
  files: [
    { kind: "CAMERA_READY" },
    { kind: "PRODUCTION_SOURCE" },
  ],
};

const INVITATION_EVENT = {
  id: "event-invite",
  type: "TRANSFER_INVITED",
  createdAt: new Date("2026-11-17T10:00:00Z"),
  actorId: "u-editor",
  targetVenueId: "venue-journal",
  manuscript: {
    id: "ms-conference",
    title: MANUSCRIPT.title,
    abstract: "Conference abstract",
    keywords: "optics, clinics",
    coAuthors: null,
    status: "ACCEPTED_PROCEDINGS",
    authorId: "u-author",
    venue: { id: "venue-conference", name: "National Optics Conference", type: "CONFERENCE" },
  },
  targetVenue: {
    id: "venue-journal",
    name: "Indian Journal of Optics",
    type: "JOURNAL",
    isPublished: true,
  },
};

function formWith(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

const validForm = () =>
  formWith({ manuscriptId: "ms-conference", targetVenueId: "venue-journal" });

const submissionForm = (overrides: Record<string, string> = {}) =>
  formWith({
    invitationId: "event-invite",
    title: "Extended optics for rural clinics",
    abstract: "A substantially extended abstract.",
    keywords: "optics, clinics",
    filePath: UPLOAD_PATH,
    fileName: "extended-paper.pdf",
    fileSize: "1024",
    sha256: SHA,
    ...overrides,
  });

const publishForm = (overrides: Record<string, string> = {}) =>
  formWith({
    manuscriptId: PUBLISHABLE.id,
    volume: "2",
    issue: "1",
    firstPage: "9",
    lastPage: "24",
    ...overrides,
  });

beforeEach(() => {
  vi.resetAllMocks();

  mocks.getActiveUser.mockResolvedValue({
    frozen: false,
    user: { id: "u-editor" },
  });
  mocks.isUserAdmin.mockResolvedValue(false);
  mocks.enforceRateLimit.mockResolvedValue({ allowed: true });
  mocks.manuscriptFindUnique.mockResolvedValue(MANUSCRIPT);
  mocks.venueFindUnique.mockResolvedValue(JOURNAL);
  mocks.roleFindMany.mockResolvedValue([SOURCE_ROLE]);
  mocks.eventFindFirst.mockResolvedValue(null);
  mocks.manuscriptRecusalFindUnique.mockResolvedValue(null);
  mocks.manuscriptFindFirst.mockResolvedValue(null);
  mocks.eventCreate.mockResolvedValue({ id: "event-1" });

  mocks.eventFindUnique.mockResolvedValue(INVITATION_EVENT);
  mocks.fileFindFirst.mockResolvedValue(null);
  mocks.pathBelongsToUser.mockReturnValue(true);
  mocks.verifyObject.mockResolvedValue({
    ok: true,
    sizeBytes: 1024,
    sha256: SHA,
  });
  mocks.createUploadTicket.mockResolvedValue({
    path: UPLOAD_PATH,
    token: "upload-token",
  });
  mocks.manuscriptCreate.mockResolvedValue({ id: "ms-journal" });
  mocks.transaction.mockImplementation(
    async (callback: (tx: unknown) => unknown) =>
      callback({
        manuscript: {
          findFirst: mocks.manuscriptFindFirst,
          create: mocks.manuscriptCreate,
          updateMany: mocks.manuscriptUpdateMany,
        },
        manuscriptEvent: { create: mocks.eventCreate },
      }),
  );
});

describe("inviteAuthorToJournalAction", () => {
  it("returns the frozen message without touching the database", async () => {
    mocks.getActiveUser.mockResolvedValue({
      frozen: true,
      message: "Your account is frozen.",
    });

    const result = await inviteAuthorToJournalAction(EMPTY, validForm());

    expect(result).toEqual({ success: false, message: "Your account is frozen." });
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.manuscriptFindUnique).not.toHaveBeenCalled();
  });

  it("returns a rate-limit denial to the caller", async () => {
    mocks.enforceRateLimit.mockResolvedValue({
      allowed: false,
      error: "Too many requests. Please slow down.",
    });

    const result = await inviteAuthorToJournalAction(EMPTY, validForm());

    expect(result).toEqual({
      success: false,
      message: "Too many requests. Please slow down.",
    });
    expect(mocks.manuscriptFindUnique).not.toHaveBeenCalled();
  });

  it("requires both a paper and a target journal", async () => {
    const result = await inviteAuthorToJournalAction(
      EMPTY,
      formWith({ manuscriptId: "ms-conference" }),
    );

    expect(result.success).toBe(false);
    expect(mocks.manuscriptFindUnique).not.toHaveBeenCalled();
  });

  it("rejects a missing manuscript", async () => {
    mocks.manuscriptFindUnique.mockResolvedValue(null);

    const result = await inviteAuthorToJournalAction(EMPTY, validForm());

    expect(result.message).toMatch(/no longer exists/i);
  });

  it("rejects a journal source", async () => {
    mocks.manuscriptFindUnique.mockResolvedValue({
      ...MANUSCRIPT,
      venue: { name: "A Journal", type: "JOURNAL" },
    });

    const result = await inviteAuthorToJournalAction(EMPTY, validForm());

    expect(result.message).toMatch(/only conference papers/i);
  });

  it("rejects a source that is not accepted to proceedings", async () => {
    mocks.manuscriptFindUnique.mockResolvedValue({
      ...MANUSCRIPT,
      status: "UNDER_REVIEW",
    });

    const result = await inviteAuthorToJournalAction(EMPTY, validForm());

    expect(result.message).toMatch(/accepted to the conference proceedings/i);
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });

  it("rejects a target that is not a journal", async () => {
    mocks.venueFindUnique.mockResolvedValue({
      ...JOURNAL,
      type: "CONFERENCE",
    });

    const result = await inviteAuthorToJournalAction(EMPTY, validForm());

    expect(result.message).toMatch(/choose a journal/i);
  });

  it("rejects an unpublished target journal", async () => {
    mocks.venueFindUnique.mockResolvedValue({
      ...JOURNAL,
      isPublished: false,
    });

    const result = await inviteAuthorToJournalAction(EMPTY, validForm());

    expect(result.message).toMatch(/not published yet/i);
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });

  it("rejects an actor with no seat at the source conference", async () => {
    mocks.roleFindMany.mockResolvedValue([]);

    const result = await inviteAuthorToJournalAction(EMPTY, validForm());

    expect(result.message).toMatch(/editor-in-chief or track chair/i);
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });

  it("rejects an associate editor, who cannot originate a transfer", async () => {
    mocks.roleFindMany.mockResolvedValue([
      { venueId: "venue-conference", roleTitle: "ASSOC_EDITOR" },
    ]);

    const result = await inviteAuthorToJournalAction(EMPTY, validForm());

    expect(result.success).toBe(false);
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });

  it("blocks the actor who also holds a seat at the target journal", async () => {
    mocks.roleFindMany.mockResolvedValue([
      SOURCE_ROLE,
      { venueId: "venue-journal", roleTitle: "ASSOC_EDITOR" },
    ]);

    const result = await inviteAuthorToJournalAction(EMPTY, validForm());

    expect(result.message).toMatch(/hold a role at/i);
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });

  it("blocks a self-invitation", async () => {
    mocks.manuscriptFindUnique.mockResolvedValue({
      ...MANUSCRIPT,
      authorId: "u-editor",
    });

    const result = await inviteAuthorToJournalAction(EMPTY, validForm());

    expect(result.message).toMatch(/cannot invite yourself/i);
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });

  it("blocks a duplicate open invitation", async () => {
    mocks.eventFindFirst.mockResolvedValue({ type: "TRANSFER_INVITED" });

    const result = await inviteAuthorToJournalAction(EMPTY, validForm());

    expect(result.message).toMatch(/already has an open invitation/i);
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });

  it("allows a fresh invitation after the author declined", async () => {
    mocks.eventFindFirst.mockResolvedValue({ type: "TRANSFER_DECLINED" });

    const result = await inviteAuthorToJournalAction(EMPTY, validForm());

    expect(result.success).toBe(true);
    expect(mocks.eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "TRANSFER_INVITED" }) }),
    );
  });

  it("blocks a paper that already has an extended submission", async () => {
    mocks.manuscriptFindFirst.mockResolvedValue({ id: "clone-1" });

    const result = await inviteAuthorToJournalAction(EMPTY, validForm());

    expect(result.message).toMatch(/already with/i);
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });

  it("records the invitation and notifies the author, without creating a manuscript", async () => {
    const result = await inviteAuthorToJournalAction(EMPTY, validForm());

    expect(result.success).toBe(true);
    expect(mocks.eventCreate).toHaveBeenCalledWith({
      data: {
        manuscriptId: "ms-conference",
        type: "TRANSFER_INVITED",
        actorId: "u-editor",
        fromStatus: "ACCEPTED_PROCEDINGS",
        targetVenueId: "venue-journal",
        note: "Invited to submit an extended version to Indian Journal of Optics.",
      },
    });
    expect(mocks.manuscriptCreate).not.toHaveBeenCalled();
    expect(mocks.notifyUserById).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "u-author",
        actorId: "u-editor",
        targetType: "manuscript",
        targetId: "ms-conference",
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/workspace/submissions");
  });

  it("lets a platform administrator originate an invitation", async () => {
    mocks.isUserAdmin.mockResolvedValue(true);
    mocks.roleFindMany.mockResolvedValue([]);

    const result = await inviteAuthorToJournalAction(EMPTY, validForm());

    expect(result.success).toBe(true);
    expect(mocks.eventCreate).toHaveBeenCalled();
  });
});

describe("createManuscriptUploadUrlAction", () => {
  it("returns the frozen message without issuing a ticket", async () => {
    mocks.getActiveUser.mockResolvedValue({
      frozen: true,
      message: "Your account is frozen.",
    });

    const result = await createManuscriptUploadUrlAction();

    expect(result).toEqual({ success: false, message: "Your account is frozen." });
    expect(mocks.createUploadTicket).not.toHaveBeenCalled();
  });

  it("returns a rate-limit denial", async () => {
    mocks.enforceRateLimit.mockResolvedValue({
      allowed: false,
      error: "Too many requests. Please slow down.",
    });

    const result = await createManuscriptUploadUrlAction();

    expect(result.success).toBe(false);
    expect(mocks.createUploadTicket).not.toHaveBeenCalled();
  });

  it("reports an unconfigured bucket instead of a stack trace", async () => {
    mocks.createUploadTicket.mockResolvedValue(null);

    const result = await createManuscriptUploadUrlAction();

    expect(result.success).toBe(false);
    if (!result.success) expect(result.message).toMatch(/not configured/i);
  });

  it("returns the server-issued path and token", async () => {
    const result = await createManuscriptUploadUrlAction();

    expect(result).toEqual({
      success: true,
      message: "Upload ready.",
      data: { path: UPLOAD_PATH, token: "upload-token" },
    });
    expect(mocks.createUploadTicket).toHaveBeenCalledWith("u-editor");
  });
});

describe("createManuscriptSubmissionAction", () => {
  beforeEach(() => {
    mocks.getActiveUser.mockResolvedValue({
      frozen: false,
      user: { id: "u-author" },
    });
    // The invitation itself is the latest event for its pair.
    mocks.eventFindFirst.mockResolvedValue({ id: "event-invite" });
  });

  it("returns the frozen message without reading the invitation", async () => {
    mocks.getActiveUser.mockResolvedValue({
      frozen: true,
      message: "Your account is frozen.",
    });

    const result = await createManuscriptSubmissionAction(
      EMPTY_SUBMIT,
      submissionForm(),
    );

    expect(result).toEqual({ success: false, message: "Your account is frozen." });
    expect(mocks.eventFindUnique).not.toHaveBeenCalled();
  });

  it("returns a rate-limit denial", async () => {
    mocks.enforceRateLimit.mockResolvedValue({
      allowed: false,
      error: "Too many requests. Please slow down.",
    });

    const result = await createManuscriptSubmissionAction(
      EMPTY_SUBMIT,
      submissionForm(),
    );

    expect(result.success).toBe(false);
    expect(mocks.eventFindUnique).not.toHaveBeenCalled();
  });

  it("rejects a missing title", async () => {
    const result = await createManuscriptSubmissionAction(
      EMPTY_SUBMIT,
      submissionForm({ title: "" }),
    );

    expect(result.success).toBe(false);
    expect(mocks.manuscriptCreate).not.toHaveBeenCalled();
  });

  it("rejects an abstract over the limit", async () => {
    const result = await createManuscriptSubmissionAction(
      EMPTY_SUBMIT,
      submissionForm({ abstract: "x".repeat(4000) }),
    );

    expect(result.success).toBe(false);
    expect(mocks.manuscriptCreate).not.toHaveBeenCalled();
  });

  it("rejects too many keywords", async () => {
    const result = await createManuscriptSubmissionAction(
      EMPTY_SUBMIT,
      submissionForm({
        keywords: "a, b, c, d, e, f, g, h, i",
      }),
    );

    expect(result.success).toBe(false);
    expect(mocks.manuscriptCreate).not.toHaveBeenCalled();
  });

  it("rejects an upload path outside the author's prefix", async () => {
    mocks.pathBelongsToUser.mockReturnValue(false);

    const result = await createManuscriptSubmissionAction(
      EMPTY_SUBMIT,
      submissionForm({ filePath: "users/u-someone-else/manuscripts/x.pdf" }),
    );

    expect(result.success).toBe(false);
    expect(mocks.verifyObject).not.toHaveBeenCalled();
  });

  it("rejects a file above the 25 MB ceiling before verification", async () => {
    const result = await createManuscriptSubmissionAction(
      EMPTY_SUBMIT,
      submissionForm({ fileSize: String(26 * 1024 * 1024) }),
    );

    expect(result.success).toBe(false);
    expect(mocks.verifyObject).not.toHaveBeenCalled();
  });

  it("refuses a declined or already-used invitation", async () => {
    mocks.eventFindUnique.mockResolvedValue(null);

    const result = await createManuscriptSubmissionAction(
      EMPTY_SUBMIT,
      submissionForm(),
    );

    expect(result.success).toBe(false);
    if (!result.success) expect(result.message).toMatch(/no longer open/i);
    expect(mocks.manuscriptCreate).not.toHaveBeenCalled();
  });

  it("refuses an invitation whose latest event is a decline", async () => {
    mocks.eventFindFirst.mockResolvedValue({ id: "event-declined" });

    const result = await createManuscriptSubmissionAction(
      EMPTY_SUBMIT,
      submissionForm(),
    );

    expect(result.success).toBe(false);
    expect(mocks.verifyObject).not.toHaveBeenCalled();
  });

  it("still accepts an invitation whose conference paper is now PUBLISHED", async () => {
    mocks.eventFindUnique.mockResolvedValue({
      ...INVITATION_EVENT,
      manuscript: { ...INVITATION_EVENT.manuscript, status: "PUBLISHED" },
    });

    const result = await createManuscriptSubmissionAction(
      EMPTY_SUBMIT,
      submissionForm(),
    );

    expect(result.success).toBe(true);
  });

  it("deletes an unreferenced upload when verification fails", async () => {
    mocks.verifyObject.mockResolvedValue({
      ok: false,
      message: "The uploaded file is not a PDF.",
    });

    const result = await createManuscriptSubmissionAction(
      EMPTY_SUBMIT,
      submissionForm(),
    );

    expect(result.success).toBe(false);
    expect(mocks.deleteObject).toHaveBeenCalledWith(UPLOAD_PATH);
    expect(mocks.manuscriptCreate).not.toHaveBeenCalled();
  });

  it("keeps an upload that a manuscript file already references", async () => {
    mocks.verifyObject.mockResolvedValue({
      ok: false,
      message: "The uploaded file is not a PDF.",
    });
    mocks.fileFindFirst.mockResolvedValue({ id: "file-1" });

    await createManuscriptSubmissionAction(EMPTY_SUBMIT, submissionForm());

    expect(mocks.deleteObject).not.toHaveBeenCalled();
  });

  it("creates the journal manuscript, file, and provenance events", async () => {
    const result = await createManuscriptSubmissionAction(
      EMPTY_SUBMIT,
      submissionForm(),
    );

    expect(result).toEqual({
      success: true,
      message: "Submitted to Indian Journal of Optics.",
      data: { id: "ms-journal" },
    });

    expect(mocks.manuscriptCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "Extended optics for rural clinics",
        status: "SUBMITTED",
        round: 0,
        venueId: "venue-journal",
        authorId: "u-author",
        originalManuscriptId: "ms-conference",
      }),
      select: { id: true },
    });

    const created = mocks.manuscriptCreate.mock.calls[0][0].data;
    expect(created.files.create).toEqual({
      round: 0,
      kind: "MANUSCRIPT",
      filePath: UPLOAD_PATH,
      fileName: "extended-paper.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      sha256: SHA,
    });
    expect(created.events.create).toEqual(
      expect.objectContaining({ type: "SUBMITTED", actorId: "u-author" }),
    );

    expect(mocks.eventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        manuscriptId: "ms-conference",
        type: "TRANSFERRED",
        actorId: "u-author",
        targetVenueId: "venue-journal",
      }),
    });
    expect(mocks.notifyUserById).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "u-editor",
        type: "manuscript-transfer-accepted",
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/workspace/editorial");
  });

  it("stores the co-authors the form carried over from the conference paper", async () => {
    await createManuscriptSubmissionAction(
      EMPTY_SUBMIT,
      submissionForm({
        coAuthors: JSON.stringify([
          { name: "Asha Rao", affiliation: "IISc" },
        ]),
      }),
    );

    const created = mocks.manuscriptCreate.mock.calls[0][0].data;
    expect(created.coAuthors).toEqual([
      { name: "Asha Rao", affiliation: "IISc" },
    ]);
  });

  it("omits coAuthors when the author removed every row", async () => {
    await createManuscriptSubmissionAction(
      EMPTY_SUBMIT,
      submissionForm({ coAuthors: "[]" }),
    );

    const created = mocks.manuscriptCreate.mock.calls[0][0].data;
    expect(created).not.toHaveProperty("coAuthors");
  });

  it("notifies the target journal's desk as well as the inviter", async () => {
    mocks.roleFindMany.mockResolvedValue([{ userId: "u-journal-eic" }]);

    await createManuscriptSubmissionAction(EMPTY_SUBMIT, submissionForm());

    expect(mocks.notifyUserById).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "u-journal-eic",
        type: "manuscript-submitted",
        targetType: "editorial",
        targetId: "ms-journal",
      }),
    );
    expect(mocks.notifyUserById).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "u-editor",
        type: "manuscript-transfer-accepted",
      }),
    );
    expect(mocks.notifyUserById).toHaveBeenCalledTimes(2);
  });

  it("does not send the inviter a second notification when they also edit the target journal", async () => {
    mocks.roleFindMany.mockResolvedValue([{ userId: "u-editor" }]);

    await createManuscriptSubmissionAction(EMPTY_SUBMIT, submissionForm());

    expect(mocks.notifyUserById).toHaveBeenCalledTimes(1);
    expect(mocks.notifyUserById).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "u-editor",
        type: "manuscript-transfer-accepted",
      }),
    );
  });

  it("refuses a second submission for the same invitation", async () => {
    // First call is the clone check inside findOpenInvitationForAuthor;
    // second is the re-check inside the Serializable transaction.
    mocks.manuscriptFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "clone-existing" });

    const result = await createManuscriptSubmissionAction(
      EMPTY_SUBMIT,
      submissionForm(),
    );

    expect(result.success).toBe(false);
    if (!result.success) expect(result.message).toMatch(/already with/i);
    expect(mocks.manuscriptCreate).not.toHaveBeenCalled();
  });

  it("maps a Serializable write conflict to the duplicate message", async () => {
    mocks.manuscriptFindFirst.mockResolvedValue(null);
    mocks.manuscriptCreate.mockRejectedValue(
      Object.assign(new Error("write conflict"), { code: "P2034" }),
    );

    const result = await createManuscriptSubmissionAction(
      EMPTY_SUBMIT,
      submissionForm(),
    );

    expect(result.success).toBe(false);
    if (!result.success) expect(result.message).toMatch(/already with/i);
  });
});

describe("createDirectSubmissionAction", () => {
  const directForm = (overrides: Record<string, string> = {}) =>
    formWith({
      venueSlug: JOURNAL.slug,
      title: "A new optics paper",
      abstract: "A new abstract for a new submission.",
      keywords: "optics, clinics",
      coAuthors: "[]",
      filePath: UPLOAD_PATH,
      fileName: "paper.pdf",
      fileSize: "1024",
      sha256: SHA,
      ...overrides,
    });

  beforeEach(() => {
    mocks.getActiveUser.mockResolvedValue({
      frozen: false,
      user: { id: "u-author" },
    });
    mocks.venueFindUnique.mockResolvedValue({ ...JOURNAL, isDemo: false });
    mocks.roleFindFirst.mockResolvedValue(null);
    mocks.roleFindMany.mockResolvedValue([
      { userId: "u-eic" },
      { userId: "u-eic" },
      { userId: "u-chair" },
    ]);
  });

  it("returns the frozen message without reading the venue", async () => {
    mocks.getActiveUser.mockResolvedValue({
      frozen: true,
      message: "Your account is frozen.",
    });

    const result = await createDirectSubmissionAction(
      EMPTY_SUBMIT,
      directForm(),
    );

    expect(result).toEqual({ success: false, message: "Your account is frozen." });
    expect(mocks.venueFindUnique).not.toHaveBeenCalled();
  });

  it("returns a rate-limit denial", async () => {
    mocks.enforceRateLimit.mockResolvedValue({
      allowed: false,
      error: "Too many requests. Please slow down.",
    });

    const result = await createDirectSubmissionAction(
      EMPTY_SUBMIT,
      directForm(),
    );

    expect(result.success).toBe(false);
    expect(mocks.venueFindUnique).not.toHaveBeenCalled();
  });

  it("requires a venue slug", async () => {
    const result = await createDirectSubmissionAction(
      EMPTY_SUBMIT,
      directForm({ venueSlug: "" }),
    );

    expect(result.success).toBe(false);
    expect(mocks.venueFindUnique).not.toHaveBeenCalled();
  });

  it("refuses a venue that does not exist", async () => {
    mocks.venueFindUnique.mockResolvedValue(null);

    const result = await createDirectSubmissionAction(
      EMPTY_SUBMIT,
      directForm(),
    );

    expect(result.success).toBe(false);
    if (!result.success) expect(result.message).toMatch(/not accepting/i);
    expect(mocks.manuscriptCreate).not.toHaveBeenCalled();
  });

  it("refuses an unpublished venue", async () => {
    mocks.venueFindUnique.mockResolvedValue({
      ...JOURNAL,
      isPublished: false,
      isDemo: false,
    });

    const result = await createDirectSubmissionAction(
      EMPTY_SUBMIT,
      directForm(),
    );

    expect(result.success).toBe(false);
    expect(mocks.manuscriptCreate).not.toHaveBeenCalled();
  });

  it("refuses a demo venue", async () => {
    mocks.venueFindUnique.mockResolvedValue({ ...JOURNAL, isDemo: true });

    const result = await createDirectSubmissionAction(
      EMPTY_SUBMIT,
      directForm(),
    );

    expect(result.success).toBe(false);
    expect(mocks.manuscriptCreate).not.toHaveBeenCalled();
  });

  it("refuses an author who holds an editorial seat at the venue", async () => {
    mocks.roleFindFirst.mockResolvedValue({ id: "role-eic" });

    const result = await createDirectSubmissionAction(
      EMPTY_SUBMIT,
      directForm(),
    );

    expect(result.success).toBe(false);
    if (!result.success) expect(result.message).toMatch(/editorial seat/i);
    expect(mocks.verifyObject).not.toHaveBeenCalled();
    expect(mocks.manuscriptCreate).not.toHaveBeenCalled();
  });

  it("rejects malformed co-authors before verification", async () => {
    const result = await createDirectSubmissionAction(
      EMPTY_SUBMIT,
      directForm({ coAuthors: JSON.stringify([{ affiliation: "IISc" }]) }),
    );

    expect(result.success).toBe(false);
    if (!result.success) expect(result.message).toMatch(/needs a name/i);
    expect(mocks.verifyObject).not.toHaveBeenCalled();
    expect(mocks.manuscriptCreate).not.toHaveBeenCalled();
  });

  it("requires the PDF to be re-verified before creating the row", async () => {
    mocks.verifyObject.mockResolvedValue({
      ok: false,
      message: "The uploaded file is not a PDF.",
    });

    const result = await createDirectSubmissionAction(
      EMPTY_SUBMIT,
      directForm(),
    );

    expect(result.success).toBe(false);
    expect(mocks.deleteObject).toHaveBeenCalledWith(UPLOAD_PATH);
    expect(mocks.manuscriptCreate).not.toHaveBeenCalled();
  });

  it("creates the manuscript, stores co-authors, and notifies the desk once per editor", async () => {
    const coAuthors = [
      { name: "Asha Rao", affiliation: "IISc Bengaluru" },
      { name: "Vikram Shah" },
    ];

    const result = await createDirectSubmissionAction(
      EMPTY_SUBMIT,
      directForm({ coAuthors: JSON.stringify(coAuthors) }),
    );

    expect(result).toEqual({
      success: true,
      message: `Submitted to ${JOURNAL.name}.`,
      data: { id: "ms-journal" },
    });
    expect(mocks.manuscriptCreate).toHaveBeenCalledTimes(1);

    const createArgs = mocks.manuscriptCreate.mock.calls[0][0];
    expect(createArgs.data).toMatchObject({
      title: "A new optics paper",
      status: "SUBMITTED",
      round: 0,
      venueId: JOURNAL.id,
      authorId: "u-author",
      keywords: "optics, clinics",
      coAuthors,
    });
    expect(createArgs.data.files.create).toMatchObject({
      kind: "MANUSCRIPT",
      filePath: UPLOAD_PATH,
      sizeBytes: 1024,
      sha256: SHA,
    });
    expect(createArgs.data.events.create).toMatchObject({
      type: "SUBMITTED",
      toStatus: "SUBMITTED",
    });

    expect(mocks.notifyUserById).toHaveBeenCalledTimes(2);
    expect(mocks.notifyUserById).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "u-eic",
        actorId: "u-author",
        type: "manuscript-submitted",
        targetId: "ms-journal",
      }),
    );
    expect(mocks.notifyUserById).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: "u-chair" }),
    );

    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/workspace/submissions",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/workspace/editorial");
  });

  it("omits coAuthors entirely when the author lists none", async () => {
    await createDirectSubmissionAction(EMPTY_SUBMIT, directForm());

    const createArgs = mocks.manuscriptCreate.mock.calls[0][0];
    expect(createArgs.data).not.toHaveProperty("coAuthors");
  });
});

describe("declineTransferInvitationAction", () => {
  beforeEach(() => {
    mocks.getActiveUser.mockResolvedValue({
      frozen: false,
      user: { id: "u-author" },
    });
    mocks.eventFindFirst.mockResolvedValue({ id: "event-invite" });
  });

  it("returns the frozen message without writing an event", async () => {
    mocks.getActiveUser.mockResolvedValue({
      frozen: true,
      message: "Your account is frozen.",
    });

    const result = await declineTransferInvitationAction(
      EMPTY,
      formWith({ invitationId: "event-invite" }),
    );

    expect(result).toEqual({ success: false, message: "Your account is frozen." });
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });

  it("returns a rate-limit denial", async () => {
    mocks.enforceRateLimit.mockResolvedValue({
      allowed: false,
      error: "Too many requests. Please slow down.",
    });

    const result = await declineTransferInvitationAction(
      EMPTY,
      formWith({ invitationId: "event-invite" }),
    );

    expect(result.success).toBe(false);
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });

  it("requires an invitation id", async () => {
    const result = await declineTransferInvitationAction(EMPTY, formWith({}));

    expect(result.success).toBe(false);
    expect(mocks.eventFindUnique).not.toHaveBeenCalled();
  });

  it("refuses an invitation that is not open", async () => {
    mocks.eventFindUnique.mockResolvedValue(null);

    const result = await declineTransferInvitationAction(
      EMPTY,
      formWith({ invitationId: "event-invite" }),
    );

    expect(result.success).toBe(false);
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });

  it("appends TRANSFER_DECLINED and notifies the inviter", async () => {
    const result = await declineTransferInvitationAction(
      EMPTY,
      formWith({ invitationId: "event-invite" }),
    );

    expect(result.success).toBe(true);
    expect(mocks.eventCreate).toHaveBeenCalledWith({
      data: {
        manuscriptId: "ms-conference",
        type: "TRANSFER_DECLINED",
        actorId: "u-author",
        targetVenueId: "venue-journal",
        note: "Declined the invitation to submit to Indian Journal of Optics.",
      },
    });
    expect(mocks.notifyUserById).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "u-editor",
        type: "manuscript-transfer-declined",
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/workspace/submissions");
  });
});

describe("publishManuscriptAction", () => {
  beforeEach(() => {
    mocks.manuscriptFindUnique.mockResolvedValue(PUBLISHABLE);
    mocks.roleFindFirst.mockResolvedValue({ roleTitle: "EDITOR_IN_CHIEF" });
    mocks.manuscriptUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("returns the frozen message without touching the database", async () => {
    mocks.getActiveUser.mockResolvedValue({
      frozen: true,
      message: "Your account is frozen.",
    });

    const result = await publishManuscriptAction(EMPTY, publishForm());

    expect(result).toEqual({ success: false, message: "Your account is frozen." });
    expect(mocks.manuscriptFindUnique).not.toHaveBeenCalled();
  });

  it("returns a rate-limit denial", async () => {
    mocks.enforceRateLimit.mockResolvedValue({
      allowed: false,
      error: "Too many requests. Please slow down.",
    });

    const result = await publishManuscriptAction(EMPTY, publishForm());

    expect(result.success).toBe(false);
    expect(mocks.manuscriptFindUnique).not.toHaveBeenCalled();
  });

  it("requires a manuscript id", async () => {
    const result = await publishManuscriptAction(EMPTY, formWith({ volume: "2" }));

    expect(result.success).toBe(false);
    expect(mocks.manuscriptFindUnique).not.toHaveBeenCalled();
  });

  it("rejects a missing manuscript", async () => {
    mocks.manuscriptFindUnique.mockResolvedValue(null);

    const result = await publishManuscriptAction(EMPTY, publishForm());

    expect(result.message).toMatch(/no longer exists/i);
    expect(mocks.manuscriptUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects a manuscript that has not been accepted", async () => {
    mocks.manuscriptFindUnique.mockResolvedValue({
      ...PUBLISHABLE,
      status: "UNDER_REVIEW",
    });

    const result = await publishManuscriptAction(EMPTY, publishForm());

    expect(result.message).toMatch(/only an accepted manuscript can be published/i);
    expect(mocks.manuscriptUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects an associate editor", async () => {
    mocks.roleFindFirst.mockResolvedValue({ roleTitle: "ASSOC_EDITOR" });

    const result = await publishManuscriptAction(EMPTY, publishForm());

    expect(result.message).toMatch(/editor-in-chief/i);
    expect(mocks.manuscriptUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects an actor with no seat at the venue", async () => {
    mocks.roleFindFirst.mockResolvedValue(null);

    const result = await publishManuscriptAction(EMPTY, publishForm());

    expect(result.success).toBe(false);
    expect(mocks.manuscriptUpdateMany).not.toHaveBeenCalled();
  });

  it("lets a platform administrator publish", async () => {
    mocks.isUserAdmin.mockResolvedValue(true);
    mocks.roleFindFirst.mockResolvedValue(null);

    const result = await publishManuscriptAction(EMPTY, publishForm());

    expect(result.success).toBe(true);
    expect(mocks.manuscriptUpdateMany).toHaveBeenCalled();
  });

  it("requires a volume", async () => {
    const result = await publishManuscriptAction(EMPTY, publishForm({ volume: "" }));

    expect(result.message).toMatch(/volume number/i);
    expect(mocks.manuscriptUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects a non-integer issue", async () => {
    const result = await publishManuscriptAction(EMPTY, publishForm({ issue: "1.5" }));

    expect(result.message).toMatch(/whole number/i);
    expect(mocks.manuscriptUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects a page locator with unsupported characters", async () => {
    const result = await publishManuscriptAction(
      EMPTY,
      publishForm({ firstPage: "9-12" }),
    );

    expect(result.message).toMatch(/letters or digits/i);
    expect(mocks.manuscriptUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects a publication date in the future", async () => {
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const result = await publishManuscriptAction(
      EMPTY,
      publishForm({ publishedAt: future }),
    );

    expect(result.message).toMatch(/cannot be in the future/i);
    expect(mocks.manuscriptUpdateMany).not.toHaveBeenCalled();
  });

  it("refuses an ISBN on a journal article", async () => {
    const result = await publishManuscriptAction(
      EMPTY,
      publishForm({ isbn: "9783161484100" }),
    );

    expect(result.message).toMatch(/ISBN applies to proceedings/i);
    expect(mocks.manuscriptUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects an ISBN-13 with a bad check digit", async () => {
    mocks.manuscriptFindUnique.mockResolvedValue({
      ...PUBLISHABLE,
      status: "ACCEPTED_PROCEDINGS",
      venue: { name: "National Optics Conference", slug: "national-optics", type: "CONFERENCE" },
    });

    const result = await publishManuscriptAction(
      EMPTY,
      publishForm({ isbn: "9783161484101" }),
    );

    expect(result.message).toMatch(/ISBN-13 is not valid/i);
    expect(mocks.manuscriptUpdateMany).not.toHaveBeenCalled();
  });

  it("publishes the paper, records the locator, and writes one PUBLISHED event", async () => {
    const result = await publishManuscriptAction(
      EMPTY,
      publishForm({ publishedAt: "2026-03-05" }),
    );

    expect(result.success).toBe(true);
    expect(result.message).toMatch(/now published/i);

    expect(mocks.manuscriptUpdateMany).toHaveBeenCalledWith({
      where: { id: PUBLISHABLE.id, status: "ACCEPTED_JOURNAL" },
      data: {
        status: "PUBLISHED",
        volume: 2,
        issue: 1,
        firstPage: "9",
        lastPage: "24",
        publishedAt: new Date("2026-03-05T00:00:00Z"),
        isbn: null,
      },
    });

    expect(mocks.eventCreate).toHaveBeenCalledTimes(1);
    expect(mocks.eventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        manuscriptId: PUBLISHABLE.id,
        type: "PUBLISHED",
        actorId: "u-editor",
        fromStatus: "ACCEPTED_JOURNAL",
        toStatus: "PUBLISHED",
        note: "Published in Indian Journal of Optics 2(1), pp. 9–24.",
      }),
    });

    expect(mocks.notifyUserById).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "u-author",
        actorId: "u-editor",
        type: "manuscript-published",
        targetType: "manuscript",
        targetId: PUBLISHABLE.id,
        title: "Published in Indian Journal of Optics",
      }),
    );

    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/sbj/indian-journal-of-optics",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/sbj/indian-journal-of-optics/archive",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      `/sbj/indian-journal-of-optics/article/${PUBLISHABLE.id}`,
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/workspace/editorial");
    // A journal paper has no proceedings volume to purge.
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith(
      expect.stringContaining("/proceedings/"),
    );
  });

  it("normalises and stores a valid volume ISBN for a conference paper", async () => {
    mocks.manuscriptFindUnique.mockResolvedValue({
      ...PUBLISHABLE,
      status: "ACCEPTED_PROCEDINGS",
      venue: { name: "National Optics Conference", slug: "national-optics", type: "CONFERENCE" },
    });

    const result = await publishManuscriptAction(
      EMPTY,
      publishForm({ isbn: "978-3-16-148410-0" }),
    );

    expect(result.success).toBe(true);
    expect(mocks.manuscriptUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isbn: "9783161484100" }),
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/sbc/national-optics/proceedings/2",
    );
  });

  it("reports a conflict when another session already published the paper", async () => {
    mocks.manuscriptUpdateMany.mockResolvedValue({ count: 0 });

    const result = await publishManuscriptAction(EMPTY, publishForm());

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/published from another session/i);
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });
});


describe("withdrawManuscriptAction", () => {
  const WITHDRAWABLE = {
    id: "ms-review",
    title: "Low-cost optics for rural clinics",
    status: "UNDER_REVIEW",
    authorId: "u-author",
    venueId: "venue-journal",
    venue: { name: "Indian Journal of Optics" },
  };

  beforeEach(() => {
    mocks.getActiveUser.mockResolvedValue({
      frozen: false,
      user: { id: "u-author" },
    });
    mocks.manuscriptFindUnique.mockResolvedValue(WITHDRAWABLE);
    mocks.roleFindMany.mockResolvedValue([{ userId: "u-editor" }]);
  });

  it("refuses a viewer who is not the author", async () => {
    mocks.getActiveUser.mockResolvedValue({
      frozen: false,
      user: { id: "u-stranger" },
    });

    const result = await withdrawManuscriptAction(
      EMPTY,
      formWith({ manuscriptId: WITHDRAWABLE.id }),
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/only the author/i);
    expect(mocks.manuscriptUpdateMany).not.toHaveBeenCalled();
  });

  it("refuses to withdraw a published article", async () => {
    mocks.manuscriptFindUnique.mockResolvedValue({
      ...WITHDRAWABLE,
      status: "PUBLISHED",
    });

    const result = await withdrawManuscriptAction(
      EMPTY,
      formWith({ manuscriptId: WITHDRAWABLE.id }),
    );

    expect(result.message).toMatch(/published article/i);
    expect(mocks.manuscriptUpdateMany).not.toHaveBeenCalled();
  });

  it("refuses once the paper has been accepted", async () => {
    mocks.manuscriptFindUnique.mockResolvedValue({
      ...WITHDRAWABLE,
      status: "ACCEPTED_JOURNAL",
    });

    const result = await withdrawManuscriptAction(
      EMPTY,
      formWith({ manuscriptId: WITHDRAWABLE.id }),
    );

    expect(result.message).toMatch(/already been decided/i);
    expect(mocks.manuscriptUpdateMany).not.toHaveBeenCalled();
  });

  it("records the withdrawal and tells the desk", async () => {
    mocks.manuscriptUpdateMany.mockResolvedValue({ count: 1 });

    const result = await withdrawManuscriptAction(
      EMPTY,
      formWith({ manuscriptId: WITHDRAWABLE.id }),
    );

    expect(result.success).toBe(true);
    expect(mocks.manuscriptUpdateMany).toHaveBeenCalledWith({
      where: { id: WITHDRAWABLE.id, status: "UNDER_REVIEW" },
      data: { status: "WITHDRAWN" },
    });
    expect(mocks.eventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "WITHDRAWN",
        fromStatus: "UNDER_REVIEW",
        toStatus: "WITHDRAWN",
        actorId: "u-author",
      }),
    });
    expect(mocks.notifyUserById).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "u-editor",
        type: "manuscript-withdrawn",
        targetType: "editorialManuscript",
      }),
    );
  });

  it("reports a lost race instead of withdrawing twice", async () => {
    mocks.manuscriptUpdateMany.mockResolvedValue({ count: 0 });

    const result = await withdrawManuscriptAction(
      EMPTY,
      formWith({ manuscriptId: WITHDRAWABLE.id }),
    );

    expect(result.message).toMatch(/another session/i);
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });
});
