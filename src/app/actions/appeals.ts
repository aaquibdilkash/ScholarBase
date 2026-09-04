"use server";

import prisma from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { AppealStatus } from "@prisma/client";
import {
  MAX_APPEAL_REASON,
  APPEAL_CATEGORIES,
  type AppealCategory,
} from "@/lib/constants";

const MODULE_TO_CONTENT_TYPE: Record<string, string> = {
  SOCIAL_FEED: "feed",
  ARTICLE_PAGE: "blog",
  PUBLICATION: "publication",
  JOURNAL: "journal",
  RESEARCH_TOOL: "researchTool",
  RESEARCH_GRANT: "researchGrant",
  COURSE: "course",
  RESULT: "result",
  CONTRIBUTION: "contribution",
  HELP_POST: "help",
  RESEARCH_EVENT: "event",
  PHD_ADMISSION: "admission",
  JOB_VACANCY: "vacancy",
  SUPERVISOR: "supervisor",
  RECOMMENDATION: "recommendation",
  RESEARCH_SURVEY: "survey",
  SCHOLAR_PROFILE: "SCHOLAR_PROFILE",
  SOCIAL_COMMENT: "socialComment",
  ARTICLE_COMMENT: "articleComment",
  HELP_COMMENT: "helpComment",
  CONTRIBUTION_COMMENT: "contributionComment",
  PUBLICATION_COMMENT: "publicationComment",
  RESEARCH_TOOL_COMMENT: "researchToolComment",
  RESEARCH_GRANT_COMMENT: "researchGrantComment",
  COURSE_COMMENT: "courseComment",
  JOURNAL_COMMENT: "journalComment",
  RESULT_COMMENT: "resultComment",
  SURVEY_COMMENT: "surveyComment",
  RESEARCH_EVENT_COMMENT: "researchEventComment",
  PHD_ADMISSION_COMMENT: "admissionComment",
  JOB_VACANCY_COMMENT: "vacancyComment",
  SUPERVISOR_COMMENT: "supervisorComment",
  RECOMMENDATION_COMMENT: "recommendationComment",
};

type DelegateModel = {
  update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
  findUnique: (args: { where: { id: string }; select: Record<string, unknown> }) => Promise<unknown>;
};

const POST_DELEGATES: Record<string, { model: DelegateModel }> = {
  feed: { model: prisma.socialPost },
  blog: { model: prisma.article },
  publication: { model: prisma.publication },
  journal: { model: prisma.journal },
  researchTool: { model: prisma.researchTool },
  researchGrant: { model: prisma.researchGrant },
  course: { model: prisma.course },
  result: { model: prisma.result },
  contribution: { model: prisma.contribution },
  help: { model: prisma.helpPost },
  event: { model: prisma.researchEvent },
  admission: { model: prisma.phdAdmission },
  vacancy: { model: prisma.jobVacancy },
  supervisor: { model: prisma.supervisor },
  recommendation: { model: prisma.recommendation },
  survey: { model: prisma.researchSurvey },
  SCHOLAR_PROFILE: { model: prisma.user },
};

const COMMENT_DELEGATES: Record<string, { model: DelegateModel }> = {
  socialComment: { model: prisma.socialComment },
  articleComment: { model: prisma.articleComment },
  helpComment: { model: prisma.helpPostComment },
  contributionComment: { model: prisma.contributionComment },
  publicationComment: { model: prisma.publicationComment },
  researchToolComment: { model: prisma.researchToolComment },
  researchGrantComment: { model: prisma.researchGrantComment },
  courseComment: { model: prisma.courseComment },
  journalComment: { model: prisma.journalComment },
  resultComment: { model: prisma.resultComment },
  surveyComment: { model: prisma.surveyComment },
  researchEventComment: { model: prisma.researchEventComment },
  admissionComment: { model: prisma.phdAdmissionComment },
  vacancyComment: { model: prisma.jobVacancyComment },
  supervisorComment: { model: prisma.supervisorComment },
  recommendationComment: { model: prisma.recommendationComment },
};

function resolveModel(contentType: string) {
  return POST_DELEGATES[contentType] ?? COMMENT_DELEGATES[contentType] ?? null;
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

  const resolved = resolveModel(contentType);
  if (!resolved) throw new Error("Invalid content type.");

  const trimmed = details.trim();
  if (trimmed.length === 0) throw new Error("Appeal reason is required.");
  if (trimmed.length > MAX_APPEAL_REASON) throw new Error(`Appeal reason is too long (max ${MAX_APPEAL_REASON} characters).`);

  const fetched = (await resolved.model.findUnique({
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

    await resolved.model.update({
      where: { id: entityId },
      data: { hasActiveAppeal: true },
    });

    return created;
  });

  if (path) revalidatePath(path);
  return { success: true, data: appeal };
}

