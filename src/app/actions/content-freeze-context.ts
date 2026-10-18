"use server";

import prisma from "@/lib/db";
import { requireCurrentUser, isUserAdmin } from "@/lib/auth";
import { AppealStatus, ReportStatus } from "@prisma/client";
import type { ReportModule, ReportEntityType } from "@/types/reports";
import type { FreezeContext } from "./freeze-context";

/**
 * Owner/admin-only freeze context for a single frozen content entity.
 *
 * Mirrors `getMyFreezeContext` (account freeze) but scoped to a content id:
 * - Owners see the anonymized, aggregated report categories + excerpts so they
 *   understand WHY the post was frozen, plus their pending-appeal state.
 * - Admins see the same context (they already have `getReportsForEntity`).
 * - Strangers are rejected — report excerpts must never leak publicly.
 *
 * RULE 2: two indexed reads only — Report via @@index([entityId, status]),
 * Appeal via @@index([entityId, status]). Reporter identity is NEVER selected.
 */
export async function getMyContentFreezeContext(
  entityId: string,
  module: ReportModule,
  entityType: ReportEntityType = "POST",
): Promise<FreezeContext & { isOwner: boolean; isAdmin: boolean }> {
  const currentUser = await requireCurrentUser("Log in to view freeze details.");
  const userId = currentUser.id;
  const admin = await isUserAdmin(userId);

  // Resolve the entity's owner + frozen state via a local ReportModule ->
  // Prisma-model lookup, so a single action covers every freezable content
  // type (no per-module actions). Kept local to this "use server" module
  // because `reports.ts` (which owns MODULE_MODEL_MAP) cannot export
  // non-async helpers.
  const MODEL_KEY: Record<ReportModule, string> = {
    SOCIAL_FEED: "socialPost",
    RECOMMENDATION: "recommendation",
    JOURNAL_REVIEW: "journalReview",
    SUPERVISOR: "supervisor",
    SCHOLAR_PROFILE: "user",
    ARTICLE_PAGE: "article",
    PUBLICATION: "publication",
    JOURNAL: "journal",
    RESEARCH_TOOL: "researchTool",
    RESEARCH_GRANT: "researchGrant",
    COURSE: "course",
    RESULT: "result",
    CONTRIBUTION: "contribution",
    HELP_POST: "helpPost",
    RESEARCH_EVENT: "researchEvent",
    PHD_ADMISSION: "phdAdmission",
    JOB_VACANCY: "jobVacancy",
    RESEARCH_SURVEY: "researchSurvey",
    SOCIAL_COMMENT: "socialComment",
    ARTICLE_COMMENT: "articleComment",
    HELP_COMMENT: "helpPostComment",
    CONTRIBUTION_COMMENT: "contributionComment",
    PUBLICATION_COMMENT: "publicationComment",
    RESEARCH_TOOL_COMMENT: "researchToolComment",
    RESEARCH_GRANT_COMMENT: "researchGrantComment",
    COURSE_COMMENT: "courseComment",
    JOURNAL_COMMENT: "journalComment",
    RESULT_COMMENT: "resultComment",
    SURVEY_COMMENT: "surveyComment",
    RESEARCH_EVENT_COMMENT: "researchEventComment",
    PHD_ADMISSION_COMMENT: "phdAdmissionComment",
    JOB_VACANCY_COMMENT: "jobVacancyComment",
    SUPERVISOR_COMMENT: "supervisorComment",
    RECOMMENDATION_COMMENT: "recommendationComment",
    JOURNAL_REVIEW_COMMENT: "journalReviewComment",
  };
  const modelKey = MODEL_KEY[module];
  const delegate = (
    prisma as unknown as Record<string, Record<string, unknown>>
  )[modelKey] as
    | {
        findUnique: (args: {
          where: { id: string };
          select: Record<string, boolean>;
        }) => Promise<{
          authorId?: string | null;
          isFrozen: boolean;
          hasActiveAppeal: boolean;
          reportCount: number;
        } | null>;
      }
    | undefined;
  if (!delegate) throw new Error("Content not found.");
  // `user` rows carry no `authorId` — the row IS the owner.
  const isProfile = modelKey === "user";
  const entity = await delegate.findUnique({
    where: { id: entityId },
    select: {
      ...(isProfile ? {} : { authorId: true }),
      isFrozen: true,
      hasActiveAppeal: true,
      reportCount: true,
    },
  });
  if (!entity) throw new Error("Content not found.");
  const ownerId = isProfile ? entityId : (entity.authorId ?? null);

  const isOwner = ownerId != null && ownerId === userId;
  if (!isOwner && !admin) {
    throw new Error("Not authorized to view freeze details.");
  }

  // COMMENT entities surface the same POST-shaped context — the dialog only
  // needs the aggregated categories, counts, and pending-appeal state.
  void entityType;

  const [reports, pendingAppeal] = await Promise.all([
    prisma.report.findMany({
      where: { entityId, status: ReportStatus.PENDING },
      select: { category: true, details: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.appeal.findFirst({
      where: { entityId, ownerId: ownerId ?? userId, status: AppealStatus.PENDING },
      select: { id: true, createdAt: true, category: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const grouped = new Map<string, { count: number; excerpts: string[] }>();
  for (const r of reports) {
    const entry = grouped.get(r.category) ?? { count: 0, excerpts: [] };
    entry.count += 1;
    const excerpt = r.details?.trim().slice(0, 140);
    if (excerpt && entry.excerpts.length < 3) entry.excerpts.push(excerpt);
    grouped.set(r.category, entry);
  }

  return {
    isFrozen: entity.isFrozen,
    hasActiveAppeal: entity.hasActiveAppeal,
    reportCount: entity.reportCount,
    reports: [...grouped.entries()].map(([category, v]) => ({
      category,
      count: v.count,
      excerpts: v.excerpts,
    })),
    pendingAppeal: pendingAppeal
      ? {
          id: pendingAppeal.id,
          createdAt: pendingAppeal.createdAt,
          category: String(pendingAppeal.category),
        }
      : null,
    isOwner,
    isAdmin: admin,
  };
}
