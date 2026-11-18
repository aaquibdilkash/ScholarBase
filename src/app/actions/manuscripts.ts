"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import prisma from "@/lib/db";
import { getActiveUser, isUserAdmin } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readFormValue } from "@/lib/form";
import {
  canEditorSetStatus,
  canTransferToJournal,
} from "@/lib/publishing/permissions";
import { canTransition, canAuthorWithdraw } from "@/lib/publishing/transitions";
import { isValidIsbn13, normalizeIsbn } from "@/lib/publishing/identifiers";
import {
  MAX_MANUSCRIPT_ABSTRACT,
  MAX_MANUSCRIPT_BYTES,
  MAX_MANUSCRIPT_KEYWORDS,
  MAX_MANUSCRIPT_TITLE,
  MANUSCRIPT_PDF_MIME,
  parseManuscriptKeywords,
  validateManuscriptKeywords,
} from "@/lib/publishing/constants";
import {
  buildStoredAuthorList,
  parseCoAuthorDraft,
  parseCorrespondingAuthorDraft,
  type CoAuthorDraft,
  type CorrespondingAuthorDraft,
} from "@/lib/publishing/coauthors";
import {
  findOpenInvitationForAuthor,
  INVITATION_EVENT_TYPES,
  type OpenTransferInvitation,
} from "@/lib/publishing/invitations";
import {
  createManuscriptUploadTicket,
  deleteManuscriptObject,
  isManuscriptObjectPathForUser,
  verifyManuscriptObject,
} from "@/lib/manuscript-storage";
import { notifyUserById } from "@/lib/notifications";

/**
 * Manuscript workflow actions.
 *
 * The conference → journal route is **author-initiated**: a conference editor
 * only invites the author to submit an extended version, and the author creates
 * the journal row themselves. Nothing is moved or cloned on the editor's
 * behalf, so there is no duplicate submission and no paper in a journal queue
 * that its author never agreed to.
 *
 * `inviteAuthorToJournalAction` writes exactly one event on the conference
 * manuscript. The `TRANSFER_INVITED` event, not a second table, is the
 * invitation record; `ManuscriptEvent.targetVenueId` says where it points.
 * `TRANSFER_DECLINED` appends the refusal, and `findOpenInvitationForAuthor`
 * decides "still open" from the latest event for the pair.
 *
 * Uploads never travel through this file: `createManuscriptUploadUrlAction`
 * issues a signed ticket and `createManuscriptSubmissionAction` only records
 * the result after re-reading the object with the service role.
 */

export type ManuscriptActionResult = {
  success: boolean;
  message: string;
};

export type ManuscriptUploadTicketResult =
  | { success: true; message: string; data: { path: string; token: string } }
  | { success: false; message: string };

export type ManuscriptSubmitResult =
  | { success: true; message: string; data: { id: string } }
  | { success: false; message: string };

export type CameraReadyResult = { success: boolean; message: string };

const TRANSFER_INVITE_WINDOW = "10 m";
const TRANSFER_INVITE_LIMIT = 20;
const TRANSFER_DECLINE_LIMIT = 20;
const UPLOAD_TICKET_LIMIT = 12;
const SUBMIT_LIMIT = 6;

function fail(message: string): ManuscriptActionResult {
  return { success: false, message };
}

function submitFail(message: string): ManuscriptSubmitResult {
  return { success: false, message };
}

function uploadFail(message: string): ManuscriptUploadTicketResult {
  return { success: false, message };
}

/**
 * `TRACK_CHAIR` or venue `EDITOR_IN_CHIEF` at the *source conference* proposes
 * that the author submit to a journal they hold no seat on.
 *
 * Two refusals matter more than the rest:
 *   - a role on the target journal (self-dealing: the same person could
 *     shepherd the paper through the receiving venue's gate);
 *   - a source that is not an accepted proceedings paper, or an author who is
 *     the inviter (an invitation to oneself is not consent).
 */
export async function inviteAuthorToJournalAction(
  _previous: ManuscriptActionResult,
  formData: FormData,
): Promise<ManuscriptActionResult> {
  const auth = await getActiveUser("Log in to invite an author to a journal.");
  if (auth.frozen) return fail(auth.message);

  const limit = await enforceRateLimit({
    namespace: "manuscript:transfer-invite",
    key: auth.user.id,
    limit: TRANSFER_INVITE_LIMIT,
    window: TRANSFER_INVITE_WINDOW,
  });
  if (!limit.allowed) return { success: false, message: limit.error };

  const manuscriptId = readFormValue(formData, "manuscriptId");
  const targetVenueId = readFormValue(formData, "targetVenueId");
  if (!manuscriptId || !targetVenueId) {
    return fail("Choose a paper and a target journal.");
  }

  const manuscript = await prisma.manuscript.findUnique({
    where: { id: manuscriptId },
    select: {
      id: true,
      title: true,
      status: true,
      authorId: true,
      venueId: true,
      venue: { select: { name: true, type: true } },
    },
  });
  if (!manuscript) return fail("That manuscript no longer exists.");

  const target = await prisma.venue.findUnique({
    where: { id: targetVenueId },
    select: { name: true, type: true, isPublished: true },
  });
  if (!target || target.type !== "JOURNAL") {
    return fail("Choose a journal to invite the author to.");
  }
  // An invitation to a draft venue cannot be acted on and leaks a title that is
  // not public yet. Publishing is a deliberate action for a reason.
  if (!target.isPublished) {
    return fail(`${target.name} is not published yet.`);
  }

  // Authorise before inspecting the source manuscript's status, so a caller
  // with no seat at the conference cannot probe whether an unpublished paper
  // exists or where it is in review.
  const roles = await prisma.editorialRole.findMany({
    where: {
      userId: auth.user.id,
      venueId: { in: [manuscript.venueId, targetVenueId] },
    },
    select: { venueId: true, roleTitle: true },
  });

  const isAdmin = await isUserAdmin(auth.user.id);
  const sourceRoles = roles
    .filter((role) => role.venueId === manuscript.venueId)
    .map((role) => role.roleTitle);
  if (!canTransferToJournal({ roles: sourceRoles, isAdmin })) {
    return fail(
      `You need an editor-in-chief or track chair role at ${manuscript.venue.name} to invite this author.`,
    );
  }

  // Hard conflict-of-interest block: never invite into a venue where the actor
  // also decides. Without this, a Track Chair who is also the journal's EiC can
  // originate a paper and then accept it through the receiving venue's gate.
  if (roles.some((role) => role.venueId === targetVenueId)) {
    return fail(
      `You hold a role at ${target.name}. Someone else at that journal must handle this transfer.`,
    );
  }

  if (manuscript.authorId === auth.user.id) {
    return fail("You cannot invite yourself to submit your own paper.");
  }

  if (manuscript.venue.type !== "CONFERENCE") {
    return fail("Only conference papers can be invited to a journal.");
  }
  if (manuscript.status !== "ACCEPTED_PROCEDINGS") {
    return fail(
      "Only a paper accepted to the conference proceedings can be invited to a journal.",
    );
  }

  const [latestInvitation, existingClone] = await Promise.all([
    prisma.manuscriptEvent.findFirst({
      where: {
        manuscriptId,
        targetVenueId,
        type: { in: [...INVITATION_EVENT_TYPES] },
      },
      orderBy: { createdAt: "desc" },
      select: { type: true },
    }),
    prisma.manuscript.findFirst({
      where: {
        originalManuscriptId: manuscriptId,
        venueId: targetVenueId,
        // A withdrawn clone was never assessed; the author may be invited
        // again. Anything else is already in (or past) the journal's queue.
        status: { not: "WITHDRAWN" },
      },
      select: { id: true },
    }),
  ]);

  if (existingClone) {
    return fail(`An extended version is already with ${target.name}.`);
  }
  // Only a still-open invitation blocks a new one. A declined invitation is
  // closed by its latest event, so the editor may invite again.
  if (latestInvitation?.type === "TRANSFER_INVITED") {
    return fail(`The author already has an open invitation to ${target.name}.`);
  }

  await prisma.manuscriptEvent.create({
    data: {
      manuscriptId,
      type: "TRANSFER_INVITED",
      actorId: auth.user.id,
      fromStatus: manuscript.status,
      targetVenueId,
      note: `Invited to submit an extended version to ${target.name}.`,
    },
  });

  await notifyUserById({
    recipientId: manuscript.authorId,
    actorId: auth.user.id,
    type: "manuscript-transfer-invited",
    targetType: "manuscript",
    targetId: manuscript.id,
    title: `${target.name} invited your paper`,
    body: `${manuscript.title} — ${manuscript.venue.name} invited you to submit an extended version.`,
  });

  revalidatePath("/workspace/submissions");
  revalidatePath("/workspace/editorial");
  revalidatePath("/workspace/editorial/board");

  return {
    success: true,
    message: `Invitation sent. The author decides whether to submit to ${target.name}.`,
  };
}

/**
 * Issues a one-object signed upload ticket for a private manuscript PDF.
 *
 * The action returns only a path under the caller's own prefix and a token;
 * the browser uploads directly to Supabase. Nothing is written to the database
 * here, so an upload abandoned before submission stays unreferenced. It is
 * never served (the bucket is private and only the submission path can create
 * a `ManuscriptFile`); a later sweep can collect it.
 */
export async function createManuscriptUploadUrlAction(): Promise<ManuscriptUploadTicketResult> {
  const auth = await getActiveUser("Log in to upload a manuscript.");
  if (auth.frozen) return uploadFail(auth.message);

  const limit = await enforceRateLimit({
    namespace: "manuscript:upload-ticket",
    key: auth.user.id,
    limit: UPLOAD_TICKET_LIMIT,
    window: TRANSFER_INVITE_WINDOW,
  });
  if (!limit.allowed) return { success: false, message: limit.error };

  const ticket = await createManuscriptUploadTicket(auth.user.id);
  if (!ticket) {
    return uploadFail(
      "Manuscript uploads are not configured yet. An administrator must create the private storage bucket.",
    );
  }

  return { success: true, message: "Upload ready.", data: ticket };
}

export async function submitCameraReadyAction(
  _previous: CameraReadyResult,
  formData: FormData,
): Promise<CameraReadyResult> {
  const auth = await getActiveUser("Log in to upload the camera-ready paper.");
  if (auth.frozen) return { success: false, message: auth.message };
  const manuscriptId = readFormValue(formData, "manuscriptId");
  const manuscript = await prisma.manuscript.findUnique({
    where: { id: manuscriptId },
    select: { id: true, authorId: true, status: true, round: true, venue: { select: { type: true } }, edition: { select: { cameraReadyAt: true } } },
  });
  if (!manuscript || manuscript.authorId !== auth.user.id) return { success: false, message: "That submission is not available." };
  if (manuscript.venue.type !== "CONFERENCE" || manuscript.status !== ("ACCEPTED_PROCEEDINGS" as typeof manuscript.status)) return { success: false, message: "Camera-ready files are only accepted for conference papers after acceptance." };
  if (manuscript.edition?.cameraReadyAt && manuscript.edition.cameraReadyAt.getTime() < Date.now()) return { success: false, message: "The camera-ready deadline has passed. Contact the conference editors." };
  const filePath = readFormValue(formData, "filePath");
  const fileName = safeManuscriptFileName(readFormValue(formData, "fileName"));
  const declaredBytes = Number(readFormValue(formData, "fileSize"));
  const sha256 = readFormValue(formData, "sha256");
  const check = await verifyManuscriptObject({ userId: auth.user.id, path: filePath, declaredBytes, expectedSha256: sha256 });
  if (!check.ok) {
    await deleteManuscriptObject(filePath);
    return { success: false, message: check.message };
  }
  await prisma.$transaction(async (tx) => {
    await tx.manuscriptFile.create({ data: { manuscriptId: manuscript.id, round: manuscript.round, kind: "CAMERA_READY", filePath, fileName, mimeType: MANUSCRIPT_PDF_MIME, sizeBytes: check.sizeBytes, sha256: check.sha256 } });
    await tx.manuscriptEvent.create({ data: { manuscriptId: manuscript.id, type: "REVISION_UPLOADED", actorId: auth.user.id, note: "Camera-ready PDF uploaded for editorial production." } });
  });
  revalidatePath(`/workspace/submissions/${manuscript.id}`);
  revalidatePath("/workspace/editorial");
  return { success: true, message: "Camera-ready PDF uploaded for editorial review." };
}

function safeManuscriptFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (cleaned || "manuscript.pdf").slice(0, 200);
}

const DUPLICATE_TRANSFER = "DUPLICATE_TRANSFER";

function isDuplicateTransferError(error: unknown): boolean {
  if (error instanceof Error && error.message === DUPLICATE_TRANSFER) return true;
  // P2034: the Serializable transaction was aborted by a write conflict. Two
  // submits for the same invitation raced; the loser must report, not retry.
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2034"
  );
}

/**
 * Accepts an invitation by creating the journal manuscript.
 *
 * The uploaded object is re-verified before anything is written. The insert
 * runs at Serializable isolation and re-checks for an existing clone inside the
 * transaction, so a double submit cannot create two journal rows even when the
 * client fires twice.
 */
export async function createManuscriptSubmissionAction(
  _previous: ManuscriptSubmitResult,
  formData: FormData,
): Promise<ManuscriptSubmitResult> {
  const auth = await getActiveUser("Log in to submit a manuscript.");
  if (auth.frozen) return submitFail(auth.message);

  const limit = await enforceRateLimit({
    namespace: "manuscript:submit",
    key: auth.user.id,
    limit: SUBMIT_LIMIT,
    window: "1 h",
  });
  if (!limit.allowed) return { success: false, message: limit.error };

  const invitationEventId = readFormValue(formData, "invitationId");
  const input = readSubmissionInput(formData);

  if (!invitationEventId) {
    return submitFail("This invitation is no longer available.");
  }
  const textProblem = validateSubmissionInput(input);
  if (textProblem) return submitFail(textProblem);

  const draftCoAuthors = parseCoAuthorDraft(input.coAuthorsRaw);
  if (!draftCoAuthors.ok) return submitFail(draftCoAuthors.message);

  const draftCorresponding = parseCorrespondingAuthorDraft(input.correspondingAuthorRaw);
  if (!draftCorresponding.ok) return submitFail(draftCorresponding.message);

  const invitation = await findOpenInvitationForAuthor({
    invitationEventId,
    authorId: auth.user.id,
  });
  if (!invitation) {
    return submitFail(
      "This invitation is no longer open. It may have been declined or already used.",
    );
  }

  const check = await verifySubmissionUpload(auth.user.id, input);
  if (!check.ok) return submitFail(check.message);

  const keywords = parseManuscriptKeywords(input.keywordsRaw).join(", ");
  // The form pre-fills the conference byline, so whatever it sends is the
  // author's final, edited author list.
  const coAuthors = authorsForStore(
    draftCorresponding.author,
    draftCoAuthors.authors,
  );

  let createdId: string;
  try {
    createdId = await createJournalManuscript({
      authorId: auth.user.id,
      invitation,
      title: input.title,
      abstract: input.abstract,
      keywords,
      coAuthors,
      filePath: input.filePath,
      fileName: safeManuscriptFileName(input.fileName),
      sizeBytes: check.sizeBytes,
      sha256: check.sha256,
    });
  } catch (error) {
    if (isDuplicateTransferError(error)) {
      return submitFail(
        `An extended version is already with ${invitation.targetVenue.name}.`,
      );
    }
    throw error;
  }

  // The journal's own desk must hear about the new row, not only the editor who
  // wrote the invitation: that editor may sit on the conference, not the
  // journal. One notification per recipient — the inviter gets the acceptance
  // wording, and is not sent a second "new submission" row.
  const desk = await prisma.editorialRole.findMany({
    where: {
      venueId: invitation.targetVenue.id,
      roleTitle: { in: ["EDITOR_IN_CHIEF", "TRACK_CHAIR"] },
    },
    select: { userId: true },
  });
  const deskRecipients = new Set(desk.map((editor) => editor.userId));

  await Promise.all([
    ...[...deskRecipients]
      .filter((recipientId) => recipientId !== invitation.invitedById)
      .map((recipientId) =>
        notifyUserById({
          recipientId,
          actorId: auth.user.id,
          type: "manuscript-submitted",
          targetType: "editorial",
          targetId: createdId,
          title: `New submission at ${invitation.targetVenue.name}`,
          body: `${input.title} — an extended conference paper was submitted.`,
        }),
      ),
    invitation.invitedById
      ? notifyUserById({
          recipientId: invitation.invitedById,
          actorId: auth.user.id,
          type: "manuscript-transfer-accepted",
          targetType: "editorial",
          targetId: createdId,
          title: `Extended version submitted to ${invitation.targetVenue.name}`,
          body: `${input.title} — the author accepted your invitation.`,
        })
      : Promise.resolve(),
  ]);

  revalidatePath("/workspace/submissions");
  revalidatePath("/workspace/editorial");
  revalidatePath("/workspace/editorial/board");

  return {
    success: true,
    message: `Submitted to ${invitation.targetVenue.name}.`,
    data: { id: createdId },
  };
}

type SubmissionInput = {
  title: string;
  abstract: string;
  keywordsRaw: string;
  correspondingAuthorRaw: string;
  coAuthorsRaw: string;
  filePath: string;
  fileName: string;
  declaredBytes: number;
  sha256: string;
};

function readSubmissionInput(formData: FormData): SubmissionInput {
  return {
    title: readFormValue(formData, "title"),
    abstract: readFormValue(formData, "abstract"),
    keywordsRaw: readFormValue(formData, "keywords"),
    correspondingAuthorRaw: readFormValue(formData, "correspondingAuthor"),
    coAuthorsRaw: readFormValue(formData, "coAuthors"),
    filePath: readFormValue(formData, "filePath"),
    fileName: readFormValue(formData, "fileName"),
    declaredBytes: Number(readFormValue(formData, "fileSize")),
    sha256: readFormValue(formData, "sha256"),
  };
}

/**
 * First user-facing problem with the text fields, or `null`.
 *
 * Shared by the invitation and the direct submission path so the two forms
 * cannot advertise different ceilings. The browser enforces the same limits,
 * but this is the enforcement point.
 */
function validateSubmissionInput(input: SubmissionInput): string | null {
  if (!input.title) return "Add a title for the manuscript.";
  if (input.title.length > MAX_MANUSCRIPT_TITLE) {
    return `The title must be ${MAX_MANUSCRIPT_TITLE} characters or fewer.`;
  }
  if (!input.abstract) return "Add an abstract for the manuscript.";
  if (input.abstract.length > MAX_MANUSCRIPT_ABSTRACT) {
    return `The abstract must be ${MAX_MANUSCRIPT_ABSTRACT} characters or fewer.`;
  }
  if (input.keywordsRaw.length > MAX_MANUSCRIPT_KEYWORDS) {
    return `Keywords must be ${MAX_MANUSCRIPT_KEYWORDS} characters or fewer.`;
  }
  return validateManuscriptKeywords(input.keywordsRaw);
}

type VerifiedUpload =
  | { ok: true; sizeBytes: number; sha256: string }
  | { ok: false; message: string };

/**
 * Re-reads the uploaded object and refuses it unless size, MIME, and digest
 * all match. An object nothing references is deleted on failure; a retry after
 * a failed insert legitimately re-uses the same path, so a referenced object is
 * left alone.
 */
async function verifySubmissionUpload(
  userId: string,
  input: SubmissionInput,
): Promise<VerifiedUpload> {
  if (!input.filePath || !input.sha256) {
    return { ok: false, message: "Upload the manuscript PDF before submitting." };
  }
  if (!isManuscriptObjectPathForUser(userId, input.filePath)) {
    return { ok: false, message: "That upload does not belong to your account." };
  }
  if (
    !Number.isFinite(input.declaredBytes) ||
    input.declaredBytes <= 0 ||
    input.declaredBytes > MAX_MANUSCRIPT_BYTES
  ) {
    return { ok: false, message: "The uploaded PDF is empty or larger than 25 MB." };
  }

  const check = await verifyManuscriptObject({
    userId,
    path: input.filePath,
    declaredBytes: input.declaredBytes,
    expectedSha256: input.sha256,
  });
  if (!check.ok) {
    const referenced = await prisma.manuscriptFile.findFirst({
      where: { filePath: input.filePath },
      select: { id: true },
    });
    if (!referenced) await deleteManuscriptObject(input.filePath);
    return { ok: false, message: check.message };
  }

  return { ok: true, sizeBytes: check.sizeBytes, sha256: check.sha256 };
}

function authorsForStore(
  correspondingAuthor: CorrespondingAuthorDraft | null,
  authors: readonly CoAuthorDraft[],
): { coAuthors?: Prisma.InputJsonValue } {
  const stored = buildStoredAuthorList(correspondingAuthor, authors);
  return stored ? { coAuthors: stored as unknown as Prisma.InputJsonValue } : {};
}

/**
 * Submits a manuscript directly to a published venue.
 *
 * Every venue page links here, so a journal does not depend on an invitation
 * chain to receive its first paper — which is exactly the state an ISSN
 * reviewer checks ("is this serial actually accepting and publishing work?").
 *
 * Three refusals carry the integrity rules:
 *   - an unpublished venue is not accepting submissions;
 *   - an author holding an editorial seat at the venue cannot submit to it
 *     (the same person must never both submit and decide);
 *   - the PDF is re-verified against the bucket before the row is created.
 */
export async function createDirectSubmissionAction(
  _previous: ManuscriptSubmitResult,
  formData: FormData,
): Promise<ManuscriptSubmitResult> {
  const auth = await getActiveUser("Log in to submit a manuscript.");
  if (auth.frozen) return submitFail(auth.message);

  const limit = await enforceRateLimit({
    namespace: "manuscript:submit",
    key: auth.user.id,
    limit: SUBMIT_LIMIT,
    window: "1 h",
  });
  if (!limit.allowed) return { success: false, message: limit.error };

  const venueSlug = readFormValue(formData, "venueSlug");
  if (!venueSlug) return submitFail("Choose a venue to submit to.");

  const venue = await prisma.venue.findUnique({
    where: { slug: venueSlug },
    select: { id: true, name: true, type: true, isPublished: true, isDemo: true },
  });
  if (!venue || !venue.isPublished || venue.isDemo) {
    return submitFail("That venue is not accepting submissions.");
  }

  const seat = await prisma.editorialRole.findFirst({
    where: { userId: auth.user.id, venueId: venue.id },
    select: { id: true },
  });
  if (seat) {
    return submitFail(
      `You hold an editorial seat at ${venue.name}. Another editor must handle your submission.`,
    );
  }

  const editionId = readFormValue(formData, "editionId");
  let edition: { id: string; label: string } | null = null;
  if (venue.type === "CONFERENCE") {
    if (!editionId) return submitFail("Choose the conference edition receiving this paper.");
    edition = await prisma.conferenceEdition.findFirst({
      where: { id: editionId, venueId: venue.id, isPublished: true, status: { in: ["CFP_OPEN", "REVIEW"] } },
      select: { id: true, label: true },
    });
    if (!edition) return submitFail("That conference edition is not accepting submissions.");
  }

  const input = readSubmissionInput(formData);
  const textProblem = validateSubmissionInput(input);
  if (textProblem) return submitFail(textProblem);

  const draftCoAuthors = parseCoAuthorDraft(input.coAuthorsRaw);
  if (!draftCoAuthors.ok) return submitFail(draftCoAuthors.message);

  const draftCorresponding = parseCorrespondingAuthorDraft(input.correspondingAuthorRaw);
  if (!draftCorresponding.ok) return submitFail(draftCorresponding.message);

  const check = await verifySubmissionUpload(auth.user.id, input);
  if (!check.ok) return submitFail(check.message);

  const keywords = parseManuscriptKeywords(input.keywordsRaw).join(", ");

  const created = await prisma.manuscript.create({
    data: {
      title: input.title,
      abstract: input.abstract,
      keywords: keywords || null,
      status: "SUBMITTED",
      round: 0,
      venueId: venue.id,
      editionId: edition?.id ?? null,
      authorId: auth.user.id,
      ...authorsForStore(draftCorresponding.author, draftCoAuthors.authors),
      files: {
        create: {
          round: 0,
          kind: "MANUSCRIPT",
          filePath: input.filePath,
          fileName: safeManuscriptFileName(input.fileName),
          mimeType: MANUSCRIPT_PDF_MIME,
          sizeBytes: check.sizeBytes,
          sha256: check.sha256,
        },
      },
      events: {
        create: {
          type: "SUBMITTED",
          actorId: auth.user.id,
          toStatus: "SUBMITTED",
          note: `Submitted to ${venue.name}.`,
        },
      },
    },
    select: { id: true },
  });

  // Tell the venue's desk. `notifyUserById` queues delivery and swallows its
  // own failures, so a notification outage never turns an accepted submission
  // into an error the author would retry.
  const editors = await prisma.editorialRole.findMany({
    where: {
      venueId: venue.id,
      roleTitle: { in: ["EDITOR_IN_CHIEF", "TRACK_CHAIR"] },
    },
    select: { userId: true },
  });
  await Promise.all(
    [...new Set(editors.map((editor) => editor.userId))].map((recipientId) =>
      notifyUserById({
        recipientId,
        actorId: auth.user.id,
        type: "manuscript-submitted",
        targetType: "editorial",
        targetId: created.id,
        title: `New submission at ${venue.name}`,
        body: `${input.title} was submitted.`,
      }),
    ),
  );

  revalidatePath("/workspace/submissions");
  revalidatePath("/workspace/editorial");
  revalidatePath("/workspace/editorial/board");

  return {
    success: true,
    message: `Submitted to ${venue.name}.`,
    data: { id: created.id },
  };
}

async function createJournalManuscript(params: {
  authorId: string;
  invitation: OpenTransferInvitation;
  title: string;
  abstract: string;
  keywords: string;
  coAuthors: { coAuthors?: Prisma.InputJsonValue };
  filePath: string;
  fileName: string;
  sizeBytes: number;
  sha256: string;
}): Promise<string> {
  return prisma.$transaction(
    async (tx) => {
      // Re-check inside the transaction. Serializable isolation turns two
      // simultaneous submissions into one winner and one P2034 conflict.
      const existing = await tx.manuscript.findFirst({
        where: {
          originalManuscriptId: params.invitation.manuscript.id,
          venueId: params.invitation.targetVenue.id,
          status: { not: "WITHDRAWN" },
        },
        select: { id: true },
      });
      if (existing) {
        throw new Error(DUPLICATE_TRANSFER);
      }

      const manuscript = await tx.manuscript.create({
        data: {
          title: params.title,
          abstract: params.abstract,
          keywords: params.keywords || null,
          status: "SUBMITTED",
          round: 0,
          venueId: params.invitation.targetVenue.id,
          authorId: params.authorId,
          originalManuscriptId: params.invitation.manuscript.id,
          ...params.coAuthors,
          files: {
            create: {
              round: 0,
              kind: "MANUSCRIPT",
              filePath: params.filePath,
              fileName: params.fileName,
              mimeType: MANUSCRIPT_PDF_MIME,
              sizeBytes: params.sizeBytes,
              sha256: params.sha256,
            },
          },
          events: {
            create: {
              type: "SUBMITTED",
              actorId: params.authorId,
              toStatus: "SUBMITTED",
              note: `Extended version of "${params.invitation.manuscript.title}" submitted to ${params.invitation.targetVenue.name}.`,
            },
          },
        },
        select: { id: true },
      });

      // The conference paper's timeline records where the extended version
      // went. The conference row itself is never mutated.
      await tx.manuscriptEvent.create({
        data: {
          manuscriptId: params.invitation.manuscript.id,
          type: "TRANSFERRED",
          actorId: params.authorId,
          targetVenueId: params.invitation.targetVenue.id,
          note: `Extended version submitted to ${params.invitation.targetVenue.name}.`,
        },
      });

      return manuscript.id;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

/**
 * Author declines a journal invitation.
 *
 * Appends `TRANSFER_DECLINED`; the invitation event itself is untouched. A
 * later invitation to the same journal is possible because the editor's
 * duplicate check is released by refusal, not by a mutation.
 */
export async function declineTransferInvitationAction(
  _previous: ManuscriptActionResult,
  formData: FormData,
): Promise<ManuscriptActionResult> {
  const auth = await getActiveUser("Log in to manage your invitations.");
  if (auth.frozen) return fail(auth.message);

  const limit = await enforceRateLimit({
    namespace: "manuscript:transfer-decline",
    key: auth.user.id,
    limit: TRANSFER_DECLINE_LIMIT,
    window: TRANSFER_INVITE_WINDOW,
  });
  if (!limit.allowed) return { success: false, message: limit.error };

  const invitationEventId = readFormValue(formData, "invitationId");
  if (!invitationEventId) return fail("That invitation is no longer available.");

  const invitation = await findOpenInvitationForAuthor({
    invitationEventId,
    authorId: auth.user.id,
  });
  if (!invitation) return fail("This invitation is no longer open.");

  await prisma.manuscriptEvent.create({
    data: {
      manuscriptId: invitation.manuscript.id,
      type: "TRANSFER_DECLINED",
      actorId: auth.user.id,
      targetVenueId: invitation.targetVenue.id,
      note: `Declined the invitation to submit to ${invitation.targetVenue.name}.`,
    },
  });

  if (invitation.invitedById) {
    await notifyUserById({
      recipientId: invitation.invitedById,
      actorId: auth.user.id,
      type: "manuscript-transfer-declined",
      targetType: "editorial",
      targetId: invitation.manuscript.id,
      title: `Invitation to ${invitation.targetVenue.name} declined`,
      body: `${invitation.manuscript.title} — the author declined to submit an extended version.`,
    });
  }

  revalidatePath("/workspace/submissions");
  revalidatePath("/workspace/editorial");
  revalidatePath("/workspace/editorial/board");

  return {
    success: true,
    message: `You declined the invitation to ${invitation.targetVenue.name}.`,
  };
}

/**
 * Publishes an accepted manuscript as a citable article.
 *
 * This is the only path that sets `status: PUBLISHED`, and it is deliberately
 * narrow: an Editor-in-Chief of the manuscript's own venue fills in the
 * citation locator (volume, issue, pages), and the row plus its event are
 * written in one transaction. Everything the public page renders — the archive,
 * the PDF link, the Highwire tags — keys off that status, so a paper cannot
 * appear half-published.
 *
 * Volume is required: an article that cannot be located in an issue cannot be
 * cited, and ISSN reviewers read the archive as evidence that the serial is
 * actually publishing. `issue` stays optional so a volume with continuous
 * pagination is representable.
 */
export async function publishManuscriptAction(
  _previous: ManuscriptActionResult,
  formData: FormData,
): Promise<ManuscriptActionResult> {
  const auth = await getActiveUser();
  if (auth.frozen) return fail(auth.message);

  const limit = await enforceRateLimit({
    namespace: "manuscript:publish",
    key: auth.user.id,
    limit: 30,
    window: "10 m",
  });
  if (!limit.allowed) return { success: false, message: limit.error };

  const manuscriptId = readFormValue(formData, "manuscriptId");
  if (!manuscriptId) return fail("Select a manuscript to publish.");

  const manuscript = await prisma.manuscript.findUnique({
    where: { id: manuscriptId },
    select: {
      id: true,
      title: true,
      status: true,
      authorId: true,
      venueId: true,
      venue: { select: { name: true, slug: true, type: true } },
      editionId: true,
      edition: { select: { id: true, slug: true, label: true, volume: true, isbn: true, isPublished: true, status: true } },
      journalIssueId: true,
      journalIssue: { select: { id: true, volume: true, number: true, isPublished: true, status: true } },
    },
  });
  if (!manuscript) return fail("That manuscript no longer exists.");

  // Resolve authorisation before any write. `isUserAdmin` hits the global
  // client, so it must never be called inside the transaction below.
  const [isAdmin, role] = await Promise.all([
    isUserAdmin(auth.user.id),
    prisma.editorialRole.findFirst({
      where: { userId: auth.user.id, venueId: manuscript.venueId },
      select: { roleTitle: true },
    }),
  ]);

  const actor = { roles: role ? [role.roleTitle] : [], isAdmin };
  if (!canTransition(manuscript.status, "PUBLISHED")) {
    return fail(
      `${manuscript.title} is ${manuscript.status.replace(/_/g, " ").toLowerCase()}; only an accepted manuscript can be published.`,
    );
  }
  if (!canEditorSetStatus(actor, "PUBLISHED")) {
    return fail("Only the Editor-in-Chief can publish a manuscript.");
  }

  const editionId = readFormValue(formData, "editionId").trim();
  const selectedEdition = manuscript.venue.type === "CONFERENCE" && manuscript.editionId
    ? manuscript.edition && manuscript.edition.id === editionId ? manuscript.edition : null
    : null;
  if (manuscript.venue.type === "CONFERENCE" && manuscript.editionId && (!selectedEdition || !selectedEdition.isPublished || !["CFP_OPEN", "REVIEW", "NOTIFICATION", "PROGRAM", "COMPLETED"].includes(selectedEdition.status))) {
    return fail("Select a published conference edition before publishing this paper.");
  }

  const journalIssueId = readFormValue(formData, "journalIssueId").trim();
  const selectedIssue = manuscript.venue.type === "JOURNAL" && journalIssueId
    ? await prisma.journalIssue.findFirst({
        where: { id: journalIssueId, venueId: manuscript.venueId },
        select: { id: true, volume: true, number: true, isPublished: true, status: true },
      })
    : null;
  if (manuscript.venue.type === "JOURNAL" && journalIssueId && (!selectedIssue || (!selectedIssue.isPublished && selectedIssue.status !== "OPEN"))) {
    return fail("Choose an open or published journal issue before publishing this article.");
  }

  const volumeRaw = selectedEdition
    ? String(selectedEdition.volume ?? "")
    : selectedIssue
      ? String(selectedIssue.volume)
    : readFormValue(formData, "volume").trim();
  const issueRaw = selectedIssue ? String(selectedIssue.number) : readFormValue(formData, "issue").trim();
  const firstPage = readFormValue(formData, "firstPage").trim();
  const lastPage = readFormValue(formData, "lastPage").trim();
  const publishedAtRaw = readFormValue(formData, "publishedAt").trim();
  const isbnRaw = selectedEdition
    ? selectedEdition?.isbn ?? ""
      : readFormValue(formData, "isbn").trim();

  const volume = Number(volumeRaw);
  if (!Number.isInteger(volume) || volume < 1) {
    return fail("Enter the volume number this article appears in.");
  }

  const issue = issueRaw ? Number(issueRaw) : null;
  if (issue !== null && (!Number.isInteger(issue) || issue < 1)) {
    return fail("Issue must be a whole number.");
  }

  // Page numbers are strings: proceedings and online-first articles legitimately
  // use e-locators ("e0123", "S1"). Guard length and character set only.
  const pagePattern = /^[A-Za-z0-9]{1,12}$/;
  if (firstPage && !pagePattern.test(firstPage)) {
    return fail("First page must be letters or digits, up to 12 characters.");
  }
  if (lastPage && !pagePattern.test(lastPage)) {
    return fail("Last page must be letters or digits, up to 12 characters.");
  }

  const publishedAt = publishedAtRaw ? new Date(`${publishedAtRaw}T00:00:00Z`) : new Date();
  if (Number.isNaN(publishedAt.getTime())) {
    return fail("Enter a valid publication date.");
  }
  if (publishedAt.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    return fail("The publication date cannot be in the future.");
  }

  let isbn: string | null = null;
  if (isbnRaw) {
    if (manuscript.venue.type !== "CONFERENCE") {
      return fail("ISBN applies to proceedings volumes, not journal articles.");
    }
    if (!isValidIsbn13(isbnRaw)) return fail("That ISBN-13 is not valid.");
    isbn = normalizeIsbn(isbnRaw);
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Condition the update on the status we read. A second editor publishing
      // the same paper from another tab then updates zero rows instead of
      // overwriting the first locator and writing a duplicate event.
      const updated = await tx.manuscript.updateMany({
        where: { id: manuscript.id, status: manuscript.status },
        data: {
          status: "PUBLISHED",
          volume,
          issue,
          firstPage: firstPage || null,
          lastPage: lastPage || null,
          publishedAt,
          isbn,
          ...(selectedIssue ? { journalIssueId: selectedIssue.id } : {}),
          ...(selectedEdition ? { editionId: selectedEdition.id } : {}),
        },
      });
      if (updated.count === 0) throw new PublishConflict();

      await tx.manuscriptEvent.create({
        data: {
          manuscriptId: manuscript.id,
          type: "PUBLISHED",
          actorId: auth.user.id,
          fromStatus: manuscript.status,
          toStatus: "PUBLISHED",
          note: `Published in ${manuscript.venue.name} ${volume}${issue ? `(${issue})` : ""}${
            firstPage ? `, pp. ${firstPage}${lastPage ? `–${lastPage}` : ""}` : ""
          }.`,
        },
      });
    });
  } catch (error) {
    if (error instanceof PublishConflict) {
      return fail("That manuscript was published from another session. Reload the page.");
    }
    throw error;
  }

  const prefix = manuscript.venue.type === "JOURNAL" ? "sbj" : "sbc";

  await notifyUserById({
    recipientId: manuscript.authorId,
    actorId: auth.user.id,
    type: "manuscript-published",
    targetType: "manuscript",
    targetId: manuscript.id,
    title: `Published in ${manuscript.venue.name}`,
    body: `${manuscript.title} — ${manuscript.venue.name} ${volume}${
      issue ? `(${issue})` : ""
    }${firstPage ? `, pp. ${firstPage}${lastPage ? `–${lastPage}` : ""}` : ""}.`,
  });

  revalidatePath(`/${prefix}/${manuscript.venue.slug}`);
  revalidatePath(`/${prefix}/${manuscript.venue.slug}/archive`);
  revalidatePath(`/${prefix}/${manuscript.venue.slug}/article/${manuscript.id}`);
  if (manuscript.venue.type === "CONFERENCE") {
    revalidatePath(`/${prefix}/${manuscript.venue.slug}/proceedings/${volume}`);
    if (selectedEdition) revalidatePath(`/${prefix}/${manuscript.venue.slug}/${selectedEdition.slug}`);
  }
  revalidatePath("/workspace/editorial");
  revalidatePath("/workspace/editorial/board");
  revalidatePath(`/${prefix}`);

  return {
    success: true,
    message: `${manuscript.title} is now published in ${manuscript.venue.name} ${volume}.`,
  };
}

class PublishConflict extends Error {}

/**
 * Withdraw a submission.
 *
 * Withdrawal is a status, not a delete: the row, its files, and its review
 * history stay, because a withdrawn paper is still part of the venue's record.
 * It has no reputation consequence — manuscripts carry no vote counters, so
 * there is nothing to reverse.
 *
 * Only the author may withdraw, only from a pre-acceptance status, and the desk
 * is told so an editor does not keep chasing reports for a paper that is gone.
 */
export async function withdrawManuscriptAction(
  _previous: ManuscriptActionResult,
  formData: FormData,
): Promise<ManuscriptActionResult> {
  const auth = await getActiveUser();
  if (auth.frozen) return fail(auth.message);

  const limit = await enforceRateLimit({
    namespace: "manuscript:withdraw",
    key: auth.user.id,
    limit: 5,
    window: "1 h",
  });
  if (!limit.allowed) return { success: false, message: limit.error };

  const manuscriptId = readFormValue(formData, "manuscriptId");
  if (!manuscriptId) return fail("Choose a submission to withdraw.");

  const manuscript = await prisma.manuscript.findUnique({
    where: { id: manuscriptId },
    select: {
      id: true,
      title: true,
      status: true,
      authorId: true,
      venueId: true,
      venue: { select: { name: true } },
    },
  });
  if (!manuscript) return fail("That submission no longer exists.");
  if (manuscript.authorId !== auth.user.id) {
    return fail("Only the author can withdraw this submission.");
  }
  if (!canAuthorWithdraw(manuscript.status)) {
    return fail(
      manuscript.status === "PUBLISHED"
        ? "A published article cannot be withdrawn from the workspace. Contact the editor about a correction or retraction."
        : "This submission has already been decided and can no longer be withdrawn.",
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.manuscript.updateMany({
        where: { id: manuscriptId, status: manuscript.status },
        data: { status: "WITHDRAWN" },
      });
      if (updated.count === 0) throw new WithdrawConflict();

      await tx.manuscriptEvent.create({
        data: {
          manuscriptId,
          type: "WITHDRAWN",
          actorId: auth.user.id,
          fromStatus: manuscript.status,
          toStatus: "WITHDRAWN",
          note: "Withdrawn by the author.",
        },
      });
    });
  } catch (error) {
    if (error instanceof WithdrawConflict) {
      return fail("This submission changed in another session. Reload and retry.");
    }
    throw error;
  }

  const desk = await prisma.editorialRole.findMany({
    where: { venueId: manuscript.venueId },
    select: { userId: true },
  });
  await Promise.all(
    [...new Set(desk.map((seat) => seat.userId))].map((recipientId) =>
      notifyUserById({
        recipientId,
        actorId: auth.user.id,
        type: "manuscript-withdrawn",
        targetType: "editorialManuscript",
        targetId: manuscript.id,
        title: `Withdrawn: ${manuscript.title}`,
        body: `The author withdrew this submission from ${manuscript.venue.name}.`,
      }),
    ),
  );

  revalidatePath("/workspace/submissions");
  revalidatePath(`/workspace/submissions/${manuscript.id}`);
  revalidatePath("/workspace/editorial");
  revalidatePath("/workspace/editorial/board");
  revalidatePath(`/workspace/editorial/manuscripts/${manuscript.id}`);

  return {
    success: true,
    message: `"${manuscript.title}" has been withdrawn. The record stays in your workspace.`,
  };
}

class WithdrawConflict extends Error {}
