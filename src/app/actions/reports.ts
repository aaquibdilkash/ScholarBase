"use server";

import { cache } from "react";
import prisma from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import type {
  ReportEntityType,
  ReportModule,
  ReportReason,
  ModerationAction,
} from "@/types/reports";

// -----------------------------------------------------------------------------
// MODULE MODEL MAP
// -----------------------------------------------------------------------------
// Maps each ReportModule to the Prisma delegate + the column name that
// stores the materialized reportCount counter.
//
// entityType ("POST" vs "COMMENT") is too coarse to resolve a model, so we
// resolve from `module` instead. This avoids any dynamic _count aggregation
// (RULE 2: Zero-Compute Reads).
interface ModuleConfig {
  delegate: {
    update: (args: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => Promise<unknown>;
    findUnique: (args: {
      where: { id: string };
      select: Record<string, boolean>;
    }) => Promise<unknown>;
  };
  reportCountField: string;
}

const MODULE_MODEL_MAP: Record<ReportModule, ModuleConfig> = {
  // --- Top-level content (entityType: "POST") ---
  SOCIAL_FEED: {
    delegate: prisma.socialPost as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  RECOMMENDATION: {
    delegate: prisma.recommendation as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  SUPERVISOR: {
    delegate: prisma.supervisor as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  SCHOLAR_PROFILE: {
    delegate: prisma.user as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  ARTICLE_PAGE: {
    delegate: prisma.article as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  PUBLICATION: {
    delegate: prisma.publication as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  JOURNAL: {
    delegate: prisma.journal as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  RESEARCH_TOOL: {
    delegate: prisma.researchTool as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  RESEARCH_GRANT: {
    delegate: prisma.researchGrant as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  COURSE: {
    delegate: prisma.course as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  RESULT: {
    delegate: prisma.result as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  CONTRIBUTION: {
    delegate: prisma.contribution as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  HELP_POST: {
    delegate: prisma.helpPost as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  RESEARCH_EVENT: {
    delegate: prisma.researchEvent as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  PHD_ADMISSION: {
    delegate: prisma.phdAdmission as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  JOB_VACANCY: {
    delegate: prisma.jobVacancy as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  RESEARCH_SURVEY: {
    delegate: prisma.researchSurvey as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  // --- Nested comments (entityType: "COMMENT") ---
  SOCIAL_COMMENT: {
    delegate: prisma.socialComment as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  ARTICLE_COMMENT: {
    delegate: prisma.articleComment as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  HELP_COMMENT: {
    delegate: prisma.helpPostComment as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  CONTRIBUTION_COMMENT: {
    delegate: prisma.contributionComment as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  PUBLICATION_COMMENT: {
    delegate: prisma.publicationComment as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  RESEARCH_TOOL_COMMENT: {
    delegate: prisma.researchToolComment as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  RESEARCH_GRANT_COMMENT: {
    delegate: prisma.researchGrantComment as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  COURSE_COMMENT: {
    delegate: prisma.courseComment as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  JOURNAL_COMMENT: {
    delegate: prisma.journalComment as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  RESULT_COMMENT: {
    delegate: prisma.resultComment as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  SURVEY_COMMENT: {
    delegate: prisma.surveyComment as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  RESEARCH_EVENT_COMMENT: {
    delegate: prisma.researchEventComment as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  PHD_ADMISSION_COMMENT: {
    delegate: prisma.phdAdmissionComment as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  JOB_VACANCY_COMMENT: {
    delegate: prisma.jobVacancyComment as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  SUPERVISOR_COMMENT: {
    delegate: prisma.supervisorComment as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
  RECOMMENDATION_COMMENT: {
    delegate: prisma.recommendationComment as unknown as ModuleConfig["delegate"],
    reportCountField: "reportCount",
  },
};

// -----------------------------------------------------------------------------
// submitReport — creates a Report row + atomically bumps the materialized
// reportCount on the target entity (RULE 3: Atomic Transactions).
// -----------------------------------------------------------------------------
export async function submitReport(
  entityId: string,
  entityType: ReportEntityType,
  mod: ReportModule,
  reason: ReportReason,
  details?: string | null,
) {
  const user = await requireCurrentUser("Log in to continue.");

  const config = MODULE_MODEL_MAP[mod];
  if (!config) {
    throw new Error(`Unsupported report module: ${mod}`);
  }

  // Verify the target entity actually exists before creating a report.
  const entity = await config.delegate.findUnique({
    where: { id: entityId },
    select: { id: true },
  });

  if (!entity) {
    throw new Error("Content not found");
  }

  const report = await prisma.$transaction(async (tx) => {
    // 1. Create the report record.
    const newReport = await tx.report.create({
      data: {
        entityId,
        entityType,
        module: mod,
        reason,
        details: details ?? null,
        reporterId: user.id,
      },
    });

    // 2. Atomically increment the materialized reportCount on the target.
    await config.delegate.update({
      where: { id: entityId },
      data: {
        [config.reportCountField]: { increment: 1 },
      },
    });

    return newReport;
  });

  return { success: true, data: report };
}

// -----------------------------------------------------------------------------
// moderateContent — admin-facing server action dispatching to freeze, delete,
// or dismiss reports inside a single atomic transaction (RULE 3).
// -----------------------------------------------------------------------------
export async function moderateContent(
  action: ModerationAction,
  contentType: string,
  contentId: string,
) {
  const user = await requireCurrentUser("Log in to continue.");

  const { isUserAdmin } = await import("@/lib/auth");
  if (!(await isUserAdmin(user.id))) {
    throw new Error("Not authorized.");
  }

  const modelMap: Record<
    string,
    {
      model: {
        update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
        findUnique: (args: { where: { id: string }; select: object }) => Promise<unknown>;
      };
    }
  > = {
    feed: { model: prisma.socialPost },
    blog: { model: prisma.article },
    publication: { model: prisma.publication },
    journal: { model: prisma.journal },
    researchTool: { model: prisma.researchTool },
    admission: { model: prisma.phdAdmission },
    event: { model: prisma.researchEvent },
    vacancy: { model: prisma.jobVacancy },
    help: { model: prisma.helpPost },
    result: { model: prisma.result },
    contribution: { model: prisma.contribution },
    supervisor: { model: prisma.supervisor },
    recommendation: { model: prisma.recommendation },
    survey: { model: prisma.researchSurvey },
    // User profiles are reported as SCHOLAR_PROFILE; User already carries
    // isFrozen / isDeleted / reportCount so the generic branches below work.
    SCHOLAR_PROFILE: { model: prisma.user },
  };

  // Comment models (tombstoned on delete per RULE 4, no isFrozen/isDeleted).
  const commentModelMap: Record<
    string,
    {
      model: {
        update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
        findUnique: (args: { where: { id: string }; select: object }) => Promise<unknown>;
        delete: (args: { where: { id: string } }) => Promise<unknown>;
      };
    }
  > = {
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

  const isCommentType = Object.prototype.hasOwnProperty.call(commentModelMap, contentType);
  const commentEntry = isCommentType ? commentModelMap[contentType] : undefined;
  const entry = commentEntry ? undefined : modelMap[contentType];
  if (!entry && !commentEntry) throw new Error("Invalid content type");

  const result = await prisma.$transaction(async (tx) => {
    if (commentEntry) {
      // --- Comment moderation (tombstone pattern, RULE 4) ---
      const entity = await commentEntry.model.findUnique({
        where: { id: contentId },
        select: { id: true, authorId: true, totalReplies: true },
      });
      if (!entity) throw new Error("Content not found");

      switch (action) {
        case "FREEZE":
        case "UNFREEZE":
          // Comments have no isFrozen flag; nothing to do but ack it.
          return { action, success: true, data: { id: contentId } };

        case "DELETE": {
          // Tombstone if it has replies, otherwise hard-delete (RULE 4).
          if ((entity as { totalReplies?: number }).totalReplies && (entity as { totalReplies?: number }).totalReplies! > 0) {
            await commentEntry.model.update({
              where: { id: contentId },
              data: { content: "[This comment was deleted by admin]", authorId: null },
            });
          } else {
            await commentEntry.model.delete({ where: { id: contentId } });
          }
          await tx.report.updateMany({
            where: { entityId: contentId, status: "PENDING" },
            data: { status: "DISMISSED" },
          });
          return {
            action,
            success: true,
            data: {
              id: contentId,
              removed:
                ((entity as { totalReplies?: number }).totalReplies ?? 0) ===
                0,
            },
          };
        }

        case "DISMISS_REPORTS": {
          await commentEntry.model.update({
            where: { id: contentId },
            data: { reportCount: 0 },
          });
          await tx.report.updateMany({
            where: { entityId: contentId, status: "PENDING" },
            data: { status: "DISMISSED" },
          });
          return { action, success: true, data: { id: contentId, reportCount: 0 } };
        }

        default:
          throw new Error(`Unknown moderation action: ${action}`);
      }
    }

    const entry2 = entry as NonNullable<typeof entry>;
    const entity = await entry2.model.findUnique({
      where: { id: contentId },
      select: { id: true, isFrozen: true, isDeleted: true },
    });

    if (!entity) throw new Error("Content not found");

    switch (action) {
      case "FREEZE": {
        const updated = (await entry2.model.update({
          where: { id: contentId },
          data: { isFrozen: true },
        })) as { id: string; isFrozen: boolean; isDeleted: boolean };
        // Return the updated row fields so the client can surgically patch
        // its React Query cache (RULE 1) instead of refetching.
        return { action, success: true, data: updated };
      }

      case "UNFREEZE": {
        const updated = (await entry2.model.update({
          where: { id: contentId },
          data: { isFrozen: false },
        })) as { id: string; isFrozen: boolean; isDeleted: boolean };
        return { action, success: true, data: updated };
      }

      case "DELETE": {
        // Soft-delete (RULE 4) + freeze + dismiss pending reports.
        const updated = (await entry2.model.update({
          where: { id: contentId },
          data: { isDeleted: true, isFrozen: true },
        })) as { id: string; isFrozen: boolean; isDeleted: boolean };
        await tx.report.updateMany({
          where: { entityId: contentId, status: "PENDING" },
          data: { status: "DISMISSED" },
        });
        return { action, success: true, data: updated };
      }

      case "RECOVER": {
        // Restore a soft-deleted row: clear the tombstone AND the
        // freeze that was applied alongside the delete, so the content
        // returns to the feed exactly as it was before deletion.
        const updated = (await entry2.model.update({
          where: { id: contentId },
          data: { isDeleted: false, isFrozen: false },
        })) as { id: string; isFrozen: boolean; isDeleted: boolean };
        return { action, success: true, data: updated };
      }

      case "DISMISS_REPORTS": {
        await entry2.model.update({
          where: { id: contentId },
          data: { reportCount: 0 },
        });
        await tx.report.updateMany({
          where: { entityId: contentId, status: "PENDING" },
          data: { status: "DISMISSED" },
        });
        return { action, success: true, data: { id: contentId } };
      }

      default:
        throw new Error(`Unknown moderation action: ${action}`);
    }
  });

  return result;
}

// -----------------------------------------------------------------------------
// getReportCount — cached helper for server components (RULE 2: Zero-Compute).
// -----------------------------------------------------------------------------
export const getReportCount = cache(
  async (entityId: string, mod: ReportModule): Promise<number> => {
    const config = MODULE_MODEL_MAP[mod];
    if (!config) return 0;

    const result = await config.delegate.findUnique({
      where: { id: entityId },
      select: { [config.reportCountField]: true },
    });

    return (result as { reportCount?: number } | null)?.reportCount ?? 0;
  },
);
