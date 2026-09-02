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
import { MAX_REPORT_DETAILS } from "@/lib/constants";

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
    delegate:
      prisma.researchGrantComment as unknown as ModuleConfig["delegate"],
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
    delegate:
      prisma.researchEventComment as unknown as ModuleConfig["delegate"],
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
    delegate:
      prisma.recommendationComment as unknown as ModuleConfig["delegate"],
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

  const normalizedDetails = details?.trim() || null;
  if (normalizedDetails && normalizedDetails.length > MAX_REPORT_DETAILS) {
    throw new Error(`Report details are too long (max ${MAX_REPORT_DETAILS} characters).`);
  }

  const report = await prisma.$transaction(async (tx) => {
    // 1. Create the report record.
    const newReport = await tx.report.create({
      data: {
        entityId,
        entityType,
        module: mod,
        reason,
        details: normalizedDetails,
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

// ----------------------------------------------------------------------------
// CONTENT MODEL MAPS (used by moderateContent)
// ----------------------------------------------------------------------------

// Maps a content-type key to the Prisma delegate for the row. Comments and
// top-level content share the same shape so a single resolver suffices.
const modelMap: Record<
  string,
  {
    model: {
      update: (args: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => Promise<unknown>;
      findUnique: (args: {
        where: { id: string };
        select: object;
      }) => Promise<unknown>;
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
  SCHOLAR_PROFILE: { model: prisma.user },
};

// Comment models (soft-deleted / frozen per RULE 4).
const commentModelMap: Record<
  string,
  {
    model: {
      update: (args: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => Promise<unknown>;
      findUnique: (args: {
        where: { id: string };
        select: object;
      }) => Promise<unknown>;
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

// -----------------------------------------------------------------------------
// moderateContent — admin-facing server action dispatching to freeze, delete,
// or dismiss reports inside a single atomic transaction (RULE 3).
// Maps a comment content type to its top-level content delegate and the FK
// field linking the comment to that parent. Used to restore materialized
// totalComments counters when a soft-deleted top-level comment is recovered.
const COMMENT_TOP_LEVEL: Record<
  string,
  {
    model: {
      update: (args: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => Promise<unknown>;
      findUnique: (args: {
        where: { id: string };
        select: object;
      }) => Promise<unknown>;
    };
    fk: string;
  }
> = {
  socialComment: { model: prisma.socialPost, fk: "socialPostId" },
  articleComment: { model: prisma.article, fk: "articleId" },
  helpComment: { model: prisma.helpPost, fk: "helpPostId" },
  contributionComment: { model: prisma.contribution, fk: "contributionId" },
  publicationComment: { model: prisma.publication, fk: "publicationId" },
  researchToolComment: { model: prisma.researchTool, fk: "researchToolId" },
  researchGrantComment: { model: prisma.researchGrant, fk: "researchGrantId" },
  courseComment: { model: prisma.course, fk: "courseId" },
  journalComment: { model: prisma.journal, fk: "journalId" },
  resultComment: { model: prisma.result, fk: "resultId" },
  surveyComment: { model: prisma.researchSurvey, fk: "surveyId" },
  researchEventComment: { model: prisma.researchEvent, fk: "researchEventId" },
  admissionComment: { model: prisma.phdAdmission, fk: "phdAdmissionId" },
  vacancyComment: { model: prisma.jobVacancy, fk: "jobVacancyId" },
  supervisorComment: { model: prisma.supervisor, fk: "supervisorId" },
  recommendationComment: {
    model: prisma.recommendation,
    fk: "recommendationId",
  },
};

// Resolves the top-level parent of a comment and reports whether that parent
// is itself soft-deleted (so counters are only restored for visible content).
async function resolveCommentParent(
  commentModel: {
    findUnique: (args: {
      where: { id: string };
      select: object;
    }) => Promise<unknown>;
  },
  contentType: string,
  contentId: string,
) {
  const cfg = COMMENT_TOP_LEVEL[contentType];
  if (!cfg) return null;
  const comment = (await commentModel.findUnique({
    where: { id: contentId },
    select: { [cfg.fk]: true },
  })) as Record<string, string | null> | null;
  const parentId = comment?.[cfg.fk];
  if (!parentId) return null;
  const parent = (await cfg.model.findUnique({
    where: { id: parentId },
    select: { id: true, isDeleted: true },
  })) as { id: string; isDeleted: boolean } | null;
  if (!parent) return null;
  return { model: cfg.model, id: parent.id, isDeleted: parent.isDeleted };
}

// -----------------------------------------------------------------------------
// moderateContent — admin-facing server action dispatching to freeze, delete,
// or dismiss reports inside a single atomic transaction (RULE 3).
// -----------------------------------------------------------------------------
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

  const isCommentType = Object.prototype.hasOwnProperty.call(
    commentModelMap,
    contentType,
  );
  const commentEntry = isCommentType ? commentModelMap[contentType] : undefined;
  const entry = commentEntry ? undefined : modelMap[contentType];
  if (!entry && !commentEntry) throw new Error("Invalid content type");

  const result = await prisma.$transaction(async (tx) => {
    if (commentEntry) {
      // --- Comment moderation (soft delete, RULE 4) ---
      // Comments now carry isDeleted / isFrozen columns, so they support the
      // same FREEZE / UNFREEZE / DELETE / RECOVER / DISMISS_REPORTS matrix as
      // every other content type. Rows are never destroyed.
      const entity = (await commentEntry.model.findUnique({
        where: { id: contentId },
        select: { id: true, isDeleted: true, isFrozen: true },
      })) as { id: string; isDeleted: boolean; isFrozen: boolean } | null;
      if (!entity) throw new Error("Content not found");

      switch (action) {
        case "FREEZE": {
          const updated = (await commentEntry.model.update({
            where: { id: contentId },
            data: { isFrozen: true },
          })) as { id: string; isFrozen: boolean; isDeleted: boolean };
          return { action, success: true, data: updated };
        }

        case "UNFREEZE": {
          const updated = (await commentEntry.model.update({
            where: { id: contentId },
            data: { isFrozen: false },
          })) as { id: string; isFrozen: boolean; isDeleted: boolean };
          return { action, success: true, data: updated };
        }

        case "DELETE": {
          // Soft-delete (RULE 4) + freeze + dismiss pending reports. For a
          // first-time delete, reverse the author's vote-derived reputation
          // and decrement the parent counters — mirroring the user-initiated
          // delete flow in deleteCommentTransaction.
          const full = (await commentEntry.model.findUnique({
            where: { id: contentId },
            select: {
              id: true,
              totalVotes: true,
              authorId: true,
              parentId: true,
            },
          })) as {
            id: string;
            totalVotes: number;
            authorId: string | null;
            parentId: string | null;
          } | null;
          if (!full) throw new Error("Content not found");

          if (!entity.isDeleted) {
            if (full.authorId && full.totalVotes !== 0) {
              await tx.user.update({
                where: { id: full.authorId },
                data: { reputation: { decrement: full.totalVotes } },
              });
            }
            if (full.parentId) {
              await commentEntry.model.update({
                where: { id: full.parentId },
                data: { totalReplies: { decrement: 1 } },
              });
            } else {
              const parent = await resolveCommentParent(
                commentEntry.model,
                contentType,
                contentId,
              );
              if (parent && !parent.isDeleted) {
                await parent.model.update({
                  where: { id: parent.id },
                  data: { totalComments: { decrement: 1 } },
                });
              }
            }
          }

          const updated = (await commentEntry.model.update({
            where: { id: contentId },
            data: {
              isDeleted: true,
              isFrozen: true,
              deletedByType: "ADMIN",
              deletedById: user.id,
            },
          })) as { id: string; isFrozen: boolean; isDeleted: boolean };
          await tx.report.updateMany({
            where: { entityId: contentId, status: "PENDING" },
            data: { status: "DISMISSED" },
          });
          return { action, success: true, data: updated };
        }

        case "RECOVER": {
          // Restore a soft-deleted comment: clear the delete AND the freeze
          // that was applied alongside it, so it returns to the thread
          // exactly as it was before deletion. Reputation gained from its
          // votes is re-granted, and parent counters are restored (skipping
          // parents that are themselves soft-deleted).
          const full = (await commentEntry.model.findUnique({
            where: { id: contentId },
            select: {
              id: true,
              isFrozen: true,
              isDeleted: true,
              totalVotes: true,
              authorId: true,
              parentId: true,
            },
          })) as {
            id: string;
            isFrozen: boolean;
            isDeleted: boolean;
            totalVotes: number;
            authorId: string | null;
            parentId: string | null;
          } | null;
          if (!full) throw new Error("Content not found");

          if (full.isDeleted) {
            if (full.authorId && full.totalVotes !== 0) {
              await tx.user.update({
                where: { id: full.authorId },
                data: { reputation: { increment: full.totalVotes } },
              });
            }
            // Restore the parent's materialized counters. Replies restore
            // totalReplies on their parent comment; top-level comments
            // restore totalComments on their parent post/article.
            if (full.parentId) {
              await commentEntry.model.update({
                where: { id: full.parentId },
                data: { totalReplies: { increment: 1 } },
              });
            } else {
              const parent = await resolveCommentParent(
                commentEntry.model,
                contentType,
                contentId,
              );
              if (parent && parent.isDeleted === false) {
                await parent.model.update({
                  where: { id: parent.id },
                  data: { totalComments: { increment: 1 } },
                });
              }
            }
          }

          const updated = (await commentEntry.model.update({
            where: { id: contentId },
            data: {
              isDeleted: false,
              isFrozen: false,
              deletedByType: null,
              deletedById: null,
              hasActiveAppeal: false,
            },
          })) as { id: string; isFrozen: boolean; isDeleted: boolean };
          await tx.appeal.updateMany({
            where: { entityId: contentId, status: "PENDING" },
            data: { status: "ACTIONED", reviewedById: user.id, reviewedAt: new Date() },
          });
          return { action, success: true, data: updated };
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
          return {
            action,
            success: true,
            data: { id: contentId, reportCount: 0 },
          };
        }

        case "DISMISS_APPEAL": {
          // Acknowledge the owner's appeal: clear the flag so the content
          // returns to a normal moderated state (admins can then re-decide).
          const updated = (await commentEntry.model.update({
            where: { id: contentId },
            data: { hasActiveAppeal: false },
          })) as { id: string; hasActiveAppeal: boolean };
          await tx.appeal.updateMany({
            where: { entityId: contentId, status: "PENDING" },
            data: { status: "DISMISSED", reviewedById: user.id, reviewedAt: new Date() },
          });
          return { action, success: true, data: updated };
        }

        default:
          throw new Error(`Unknown moderation action: ${action}`);
      }
    }

    const entry2 = entry as NonNullable<typeof entry>;
    const entity = (await entry2.model.findUnique({
      where: { id: contentId },
      select: { id: true, isFrozen: true, isDeleted: true },
    })) as { id: string; isFrozen: boolean; isDeleted: boolean } | null;

    if (!entity) throw new Error("Content not found");

    // Author materialized content-count fields, used to keep the delete /
    // recover reputation + counter symmetry (RULE 3 / RULE 4). Users are
    // handled by dedicated flows and carry no content-count field.
    const AUTHOR_COUNT_FIELD: Record<string, string | null> = {
      feed: "socialPostCount",
      blog: "articleCount",
      publication: "publicationCount",
      journal: "journalCount",
      researchTool: "researchToolCount",
      admission: "phdAdmissionCount",
      event: "researchEventCount",
      vacancy: "jobVacancyCount",
      help: "helpPostCount",
      result: "resultCount",
      contribution: "contributionCount",
      supervisor: "supervisorCount",
      recommendation: "recommendationCount",
      survey: "surveyCount",
      SCHOLAR_PROFILE: null,
    };

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
        // Soft-delete (RULE 4) + freeze + dismiss pending reports. For a
        // first-time delete, reverse the author's vote-derived reputation
        // and decrement their materialized content count — mirroring the
        // user-initiated delete flows.
        const countField = AUTHOR_COUNT_FIELD[contentType];
        const full = (await entry2.model.findUnique({
          where: { id: contentId },
          select: {
            id: true,
            ...(countField ? { totalVotes: true, authorId: true } : {}),
            ...(contentType === "recommendation" ? { isAnonymous: true } : {}),
          },
        })) as {
          id: string;
          totalVotes?: number;
          authorId?: string | null;
          isAnonymous?: boolean;
        } | null;
        if (!full) throw new Error("Content not found");

        if (!entity.isDeleted) {
          if (countField && full.authorId) {
            if ((full.totalVotes ?? 0) !== 0) {
              await tx.user.update({
                where: { id: full.authorId },
                data: { reputation: { decrement: full.totalVotes ?? 0 } },
              });
            }
            // Creation-bonus reversal: always applied regardless of anonymity.
            // (recommendationCount decrement is still conditional on !isAnonymous.)
            const isAnonymousRec =
              contentType === "recommendation" && !!full.isAnonymous;
            await tx.user.update({
              where: { id: full.authorId },
              data: {
                ...(isAnonymousRec ? {} : { [countField]: { decrement: 1 } }),
                reputation: { decrement: 1 },
              },
            });
          }
        }

        const updated = (await entry2.model.update({
          where: { id: contentId },
          data: {
            isDeleted: true,
            isFrozen: true,
            deletedByType: "ADMIN",
            deletedById: user.id,
          },
        })) as { id: string; isFrozen: boolean; isDeleted: boolean };
        await tx.report.updateMany({
          where: { entityId: contentId, status: "PENDING" },
          data: { status: "DISMISSED" },
        });
        return { action, success: true, data: updated };
      }

      case "RECOVER": {
        // Restore a soft-deleted row: clear the tombstone AND the freeze
        // that was applied alongside the delete, so the content returns to
        // the feed exactly as it was before deletion. The reputation that
        // was reversed at delete time is re-granted, and the author's
        // materialized content count is restored.
        const countField = AUTHOR_COUNT_FIELD[contentType];
        const full = (await entry2.model.findUnique({
          where: { id: contentId },
          select: {
            id: true,
            ...(countField ? { totalVotes: true, authorId: true } : {}),
            ...(contentType === "recommendation" ? { isAnonymous: true } : {}),
          },
        })) as {
          id: string;
          totalVotes?: number;
          authorId?: string | null;
          isAnonymous?: boolean;
        } | null;
        if (!full) throw new Error("Content not found");

        if (entity.isDeleted && countField && full.authorId) {
          if ((full.totalVotes ?? 0) !== 0) {
            await tx.user.update({
              where: { id: full.authorId },
              data: { reputation: { increment: full.totalVotes ?? 0 } },
            });
          }
          // Creation-bonus grant-back: always applied regardless of anonymity.
          // (recommendationCount increment is still conditional on !isAnonymous.)
          const isAnonymousRec =
            contentType === "recommendation" && !!full.isAnonymous;
          await tx.user.update({
            where: { id: full.authorId },
            data: {
              ...(isAnonymousRec ? {} : { [countField]: { increment: 1 } }),
              reputation: { increment: 1 },
            },
          });
        }

        const updated = (await entry2.model.update({
          where: { id: contentId },
          data: {
            isDeleted: false,
            isFrozen: false,
            deletedByType: null,
            deletedById: null,
            hasActiveAppeal: false,
          },
        })) as { id: string; isFrozen: boolean; isDeleted: boolean };
        await tx.appeal.updateMany({
          where: { entityId: contentId, status: "PENDING" },
          data: { status: "ACTIONED", reviewedById: user.id, reviewedAt: new Date() },
        });
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

      case "DISMISS_APPEAL": {
        // Acknowledge the owner's appeal: clear the flag so the content
        // returns to a normal moderated state (admins can then re-decide).
        const updated = (await entry2.model.update({
          where: { id: contentId },
          data: { hasActiveAppeal: false },
        })) as { id: string; hasActiveAppeal: boolean };
        await tx.appeal.updateMany({
          where: { entityId: contentId, status: "PENDING" },
          data: { status: "DISMISSED", reviewedById: user.id, reviewedAt: new Date() },
        });
        return { action, success: true, data: updated };
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
