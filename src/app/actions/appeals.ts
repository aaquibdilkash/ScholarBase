"use server";

import prisma from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { AppealStatus } from "@prisma/client";
import {
  MAX_APPEAL_REASON,
  APPEAL_CATEGORIES,
  MODULE_TO_CONTENT_TYPE,
  type AppealCategory,
} from "@/lib/constants";

type DelegateModel = {
  update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
  findUnique: (args: { where: { id: string }; select: Record<string, unknown> }) => Promise<unknown>;
};

// RULE 1: Never bind delegates to the global client and reuse them inside an
// interactive transaction. Doing so checks out a SECOND connection from the pool
// mid-transaction, exhausting it and causing deadlocks (Prisma P2028). Instead we
// store model-name strings and resolve the delegate dynamically against whatever
// client is active: `prisma` outside a transaction, or the transaction client
// `tx` inside one.
const POST_DELEGATES: Record<string, string> = {
  feed: "socialPost",
  blog: "article",
  publication: "publication",
  journal: "journal",
  researchTool: "researchTool",
  researchGrant: "researchGrant",
  course: "course",
  result: "result",
  contribution: "contribution",
  help: "helpPost",
  event: "researchEvent",
  admission: "phdAdmission",
  vacancy: "jobVacancy",
  supervisor: "supervisor",
  recommendation: "recommendation",
  survey: "researchSurvey",
  SCHOLAR_PROFILE: "user",
};

const COMMENT_DELEGATES: Record<string, string> = {
  socialComment: "socialComment",
  articleComment: "articleComment",
  helpComment: "helpPostComment",
  contributionComment: "contributionComment",
  publicationComment: "publicationComment",
  researchToolComment: "researchToolComment",
  researchGrantComment: "researchGrantComment",
  courseComment: "courseComment",
  journalComment: "journalComment",
  resultComment: "resultComment",
  surveyComment: "surveyComment",
  researchEventComment: "researchEventComment",
  admissionComment: "phdAdmissionComment",
  vacancyComment: "jobVacancyComment",
  supervisorComment: "supervisorComment",
  recommendationComment: "recommendationComment",
};

function resolveModel(contentType: string) {
  return POST_DELEGATES[contentType] ?? COMMENT_DELEGATES[contentType] ?? null;
}

// Resolve the delegate dynamically against the active client (`prisma` outside a
// transaction, `tx` inside one). Returns null for unknown content types.
function getModelDelegate(
  client: unknown,
  contentType: string
): DelegateModel | null {
  const model = resolveModel(contentType);
  if (!model) return null;
  return (client as Record<string, DelegateModel>)[model];
}


/** Expected, user-facing validation failures returned as structured results. */
type AppealError = { success: false; error: string };
/** Successful appeal creation. */
type AppealSuccess = { success: true; data: Awaited<ReturnType<typeof prisma.appeal.create>> };
type AppealResult = AppealError | AppealSuccess;

export async function submitAppeal({
  entityId,
  module,
  entityType,
  reasonCategory,
  details,
  path,
}: {
  entityId: string;
  module: string;
  entityType: "POST" | "COMMENT";
  /** Structured category from APPEAL_CATEGORIES (MISTAKEN_MODERATION, ...). */
  reasonCategory?: string;
  /** Free-text details explaining the appeal. */
  details: string;
  path?: string;
}): Promise<AppealResult> {
  // An appeal is the frozen user's ONLY route back — so this entry point must
  // NOT use requireActiveUser (which throws ACCOUNT_FROZEN). Only deleted
  // accounts stay blocked; frozen owners are explicitly allowed through and
  // the frozen/deleted gates below decide eligibility per entity.
  const currentUser = await requireCurrentUser("Log in to appeal.");
  const accountState = await prisma.user.findUnique({
    where: { id: currentUser.id },
    select: { isDeleted: true },
  });
  if (accountState?.isDeleted) {
    // Account deletion is a hard block — not a recoverable user error.
    throw new Error(
      "ACCOUNT_DELETED: This account has been deleted and this action is disabled.",
    );
  }

  // Validate the structured category against the shared APPEAL_CATEGORIES
  // list (mirrors the AppealReason enum) — unknown values fall back to OTHER.
  const category: AppealCategory = APPEAL_CATEGORIES.some(
    (c) => c.value === reasonCategory?.trim(),
  )
    ? (reasonCategory!.trim() as AppealCategory)
    : "OTHER";

  const contentType = MODULE_TO_CONTENT_TYPE[module];
  if (!contentType) throw new Error("Invalid content type.");

  const delegate = getModelDelegate(prisma, contentType);
  if (!delegate) throw new Error("Invalid content type.");

  const trimmed = details.trim();
  if (trimmed.length === 0) return { success: false, error: "Appeal reason is required." };
  if (trimmed.length > MAX_APPEAL_REASON) return { success: false, error: `Appeal reason is too long (max ${MAX_APPEAL_REASON} characters).` };

  const isProfileAppeal = contentType === "SCHOLAR_PROFILE";
  const fetched = (await delegate.findUnique({
    where: { id: entityId },
    // User rows (SCHOLAR_PROFILE appeals) carry no authorId — the row id IS
    // the owner. Select id always; authorId only for non-profile content.
    select: {
      id: true,
      ...(isProfileAppeal ? {} : { authorId: true }),
      isFrozen: true,
      isDeleted: true,
      deletedByType: true,
      hasActiveAppeal: true,
    },
  })) as {
    id: string;
    authorId?: string | null;
    isFrozen: boolean;
    isDeleted: boolean;
    hasActiveAppeal: boolean;
    deletedByType?: "AUTHOR" | "ADMIN" | "POST_AUTHOR" | "PARENT_COMMENT_AUTHOR" | null;
  } | null;

  // Return structured errors for expected user-facing validation failures so
  // Next.js does not treat them as unhandled server exceptions (which would
  // surface in Sentry as crashes rather than user input errors).
  if (!fetched) return { success: false, error: "Content not found." };
  // Profiles have no authorId column: owner is the row itself.
  const ownerId = fetched.authorId ?? fetched.id;
  if (ownerId !== currentUser.id) {
    return { success: false, error: "Only the owner can appeal this content." };
  }
  if (fetched.isDeleted && fetched.deletedByType !== "ADMIN") {
    return { success: false, error: "Author-deleted content cannot be appealed." };
  }
  if (!fetched.isFrozen && !fetched.isDeleted) {
    // The content's moderation state changed after the page loaded (e.g. it
    // was unfrozen by a moderator between render and submit). Return a clear
    // message rather than throwing so Sentry doesn't capture this as a crash.
    return { success: false, error: "This content is no longer frozen or deleted — no appeal is needed." };
  }
  if (fetched.hasActiveAppeal) {
    return { success: false, error: "An appeal is already pending for this content." };
  }

  // Race-condition safety net: re-check inside the transaction. The pre-check
  // above covers the common case; this covers concurrent duplicate submissions.
  let appeal: Awaited<ReturnType<typeof prisma.appeal.create>>;
  try {
    appeal = await prisma.$transaction(async (tx) => {
      const existing = await tx.appeal.findFirst({
        where: { entityId, ownerId: currentUser.id, status: AppealStatus.PENDING },
      });
      if (existing) {
        throw new Error("An appeal is already pending for this content.");
      }

      const created = await tx.appeal.create({
        data: {
          entityId,
          entityType,
          module,
          category,
          details: trimmed,
          status: AppealStatus.PENDING,
          ownerId: currentUser.id,
        },
      });

      await getModelDelegate(tx, contentType)!.update({
        where: { id: entityId },
        data: { hasActiveAppeal: true },
      });

      return created;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to submit appeal.";
    // Only the duplicate-appeal check inside the transaction is an expected
    // failure; re-throw anything else so real DB errors surface normally.
    if (message === "An appeal is already pending for this content.") {
      return { success: false, error: message };
    }
    throw err;
  }

  if (path) revalidatePath(path);
  return { success: true, data: appeal };
}

