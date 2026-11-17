"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import prisma from "@/lib/db";
import { getActiveUser, isUserAdmin } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readFormValue } from "@/lib/form";
import { canTransferToJournal } from "@/lib/publishing/permissions";
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
  const title = readFormValue(formData, "title");
  const abstract = readFormValue(formData, "abstract");
  const keywordsRaw = readFormValue(formData, "keywords");
  const filePath = readFormValue(formData, "filePath");
  const fileName = readFormValue(formData, "fileName");
  const declaredBytes = Number(readFormValue(formData, "fileSize"));
  const sha256 = readFormValue(formData, "sha256");

  if (!invitationEventId) {
    return submitFail("This invitation is no longer available.");
  }
  if (!title) return submitFail("Add a title for the extended version.");
  if (title.length > MAX_MANUSCRIPT_TITLE) {
    return submitFail(`The title must be ${MAX_MANUSCRIPT_TITLE} characters or fewer.`);
  }
  if (!abstract) return submitFail("Add an abstract for the extended version.");
  if (abstract.length > MAX_MANUSCRIPT_ABSTRACT) {
    return submitFail(`The abstract must be ${MAX_MANUSCRIPT_ABSTRACT} characters or fewer.`);
  }
  if (keywordsRaw.length > MAX_MANUSCRIPT_KEYWORDS) {
    return submitFail(`Keywords must be ${MAX_MANUSCRIPT_KEYWORDS} characters or fewer.`);
  }
  const keywordProblem = validateManuscriptKeywords(keywordsRaw);
  if (keywordProblem) return submitFail(keywordProblem);

  if (!filePath || !sha256) {
    return submitFail("Upload the manuscript PDF before submitting.");
  }
  if (!isManuscriptObjectPathForUser(auth.user.id, filePath)) {
    return submitFail("That upload does not belong to your account.");
  }
  if (
    !Number.isFinite(declaredBytes) ||
    declaredBytes <= 0 ||
    declaredBytes > MAX_MANUSCRIPT_BYTES
  ) {
    return submitFail("The uploaded PDF is empty or larger than 25 MB.");
  }

  const invitation = await findOpenInvitationForAuthor({
    invitationEventId,
    authorId: auth.user.id,
  });
  if (!invitation) {
    return submitFail(
      "This invitation is no longer open. It may have been declined or already used.",
    );
  }

  const check = await verifyManuscriptObject({
    userId: auth.user.id,
    path: filePath,
    declaredBytes,
    expectedSha256: sha256,
  });
  if (!check.ok) {
    // Do not delete an object a row already points at: a retry after a failed
    // insert can legitimately re-use the same path.
    const referenced = await prisma.manuscriptFile.findFirst({
      where: { filePath },
      select: { id: true },
    });
    if (!referenced) await deleteManuscriptObject(filePath);
    return submitFail(check.message);
  }

  const keywords = parseManuscriptKeywords(keywordsRaw).join(", ");
  const coAuthors =
    invitation.manuscript.coAuthors === null
      ? {}
      : { coAuthors: invitation.manuscript.coAuthors as Prisma.InputJsonValue };

  let createdId: string;
  try {
    createdId = await createJournalManuscript({
      authorId: auth.user.id,
      invitation,
      title,
      abstract,
      keywords,
      coAuthors,
      filePath,
      fileName: safeManuscriptFileName(fileName),
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

  if (invitation.invitedById) {
    await notifyUserById({
      recipientId: invitation.invitedById,
      actorId: auth.user.id,
      type: "manuscript-transfer-accepted",
      targetType: "manuscript",
      targetId: createdId,
      title: `Extended version submitted to ${invitation.targetVenue.name}`,
      body: `${title} — the author accepted your invitation.`,
    });
  }

  revalidatePath("/workspace/submissions");
  revalidatePath("/workspace/editorial");

  return {
    success: true,
    message: `Submitted to ${invitation.targetVenue.name}.`,
    data: { id: createdId },
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
      targetType: "manuscript",
      targetId: invitation.manuscript.id,
      title: `Invitation to ${invitation.targetVenue.name} declined`,
      body: `${invitation.manuscript.title} — the author declined to submit an extended version.`,
    });
  }

  revalidatePath("/workspace/submissions");
  revalidatePath("/workspace/editorial");

  return {
    success: true,
    message: `You declined the invitation to ${invitation.targetVenue.name}.`,
  };
}
