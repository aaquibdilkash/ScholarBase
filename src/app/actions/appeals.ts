"use server";

import prisma from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
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
}) {
  const currentUser = await requireActiveUser("Log in to appeal.");

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
  if (trimmed.length === 0) throw new Error("Appeal reason is required.");
  if (trimmed.length > MAX_APPEAL_REASON) throw new Error(`Appeal reason is too long (max ${MAX_APPEAL_REASON} characters).`);

  const fetched = (await delegate.findUnique({
    where: { id: entityId },
    select: { authorId: true, isFrozen: true, isDeleted: true, hasActiveAppeal: true },
  })) as {
    authorId: string | null;
    isFrozen: boolean;
    isDeleted: boolean;
    hasActiveAppeal: boolean;
  } | null;

  if (!fetched) throw new Error("Content not found.");
  if (fetched.authorId !== currentUser.id) {
    throw new Error("Only the owner can appeal this content.");
  }
  if (!fetched.isFrozen && !fetched.isDeleted) {
    throw new Error("Only frozen or deleted content can be appealed.");
  }
  if (fetched.hasActiveAppeal) {
    throw new Error("An appeal is already pending for this content.");
  }

  const appeal = await prisma.$transaction(async (tx) => {
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

  if (path) revalidatePath(path);
  return { success: true, data: appeal };
}

