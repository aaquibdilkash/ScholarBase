"use server";

import { cache } from "react";
import prisma from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import type {
  ReportEntityType,
  ReportModule,
  ReportReason,
  ModerationAction,
} from "@/types/reports";
import { MAX_REPORT_DETAILS } from "@/lib/constants";
import { Prisma } from "@prisma/client";

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
  model: string;
  reportCountField: string;
}

interface ModelDelegate {
  update: (
    args: {
      where: { id: string };
      data: Record<string, unknown>;
    },
  ) => Promise<unknown>;
  findUnique: (
    args: {
      where: { id: string };
      select: Record<string, unknown>;
    },
  ) => Promise<unknown>;
}

const MODULE_MODEL_MAP: Record<ReportModule, ModuleConfig> = {
  // --- Top-level content (entityType: "POST") ---
  SOCIAL_FEED: {
    delegate: prisma.socialPost as unknown as ModuleConfig["delegate"],
    model: "socialPost",
    reportCountField: "reportCount",
  },
  RECOMMENDATION: {
    delegate: prisma.recommendation as unknown as ModuleConfig["delegate"],
    model: "recommendation",
    reportCountField: "reportCount",
  },
  SUPERVISOR: {
    delegate: prisma.supervisor as unknown as ModuleConfig["delegate"],
    model: "supervisor",
    reportCountField: "reportCount",
  },
  SCHOLAR_PROFILE: {
    delegate: prisma.user as unknown as ModuleConfig["delegate"],
    model: "user",
    reportCountField: "reportCount",
  },
  ARTICLE_PAGE: {
    delegate: prisma.article as unknown as ModuleConfig["delegate"],
    model: "article",
    reportCountField: "reportCount",
  },
  PUBLICATION: {
    delegate: prisma.publication as unknown as ModuleConfig["delegate"],
    model: "publication",
    reportCountField: "reportCount",
  },
  JOURNAL: {
    delegate: prisma.journal as unknown as ModuleConfig["delegate"],
    model: "journal",
    reportCountField: "reportCount",
  },
  RESEARCH_TOOL: {
    delegate: prisma.researchTool as unknown as ModuleConfig["delegate"],
    model: "researchTool",
    reportCountField: "reportCount",
  },
  RESEARCH_GRANT: {
    delegate: prisma.researchGrant as unknown as ModuleConfig["delegate"],
    model: "researchGrant",
    reportCountField: "reportCount",
  },
  COURSE: {
    delegate: prisma.course as unknown as ModuleConfig["delegate"],
    model: "course",
    reportCountField: "reportCount",
  },
  RESULT: {
    delegate: prisma.result as unknown as ModuleConfig["delegate"],
    model: "result",
    reportCountField: "reportCount",
  },
  CONTRIBUTION: {
    delegate: prisma.contribution as unknown as ModuleConfig["delegate"],
    model: "contribution",
    reportCountField: "reportCount",
  },
  HELP_POST: {
    delegate: prisma.helpPost as unknown as ModuleConfig["delegate"],
    model: "helpPost",
    reportCountField: "reportCount",
  },
  RESEARCH_EVENT: {
    delegate: prisma.researchEvent as unknown as ModuleConfig["delegate"],
    model: "researchEvent",
    reportCountField: "reportCount",
  },
  PHD_ADMISSION: {
    delegate: prisma.phdAdmission as unknown as ModuleConfig["delegate"],
    model: "phdAdmission",
    reportCountField: "reportCount",
  },
  JOB_VACANCY: {
    delegate: prisma.jobVacancy as unknown as ModuleConfig["delegate"],
    model: "jobVacancy",
    reportCountField: "reportCount",
  },
  RESEARCH_SURVEY: {
    delegate: prisma.researchSurvey as unknown as ModuleConfig["delegate"],
    model: "researchSurvey",
    reportCountField: "reportCount",
  },
  // --- Nested comments (entityType: "COMMENT") ---
  SOCIAL_COMMENT: {
    delegate: prisma.socialComment as unknown as ModuleConfig["delegate"],
    model: "socialComment",
    reportCountField: "reportCount",
  },
  ARTICLE_COMMENT: {
    delegate: prisma.articleComment as unknown as ModuleConfig["delegate"],
    model: "articleComment",
    reportCountField: "reportCount",
  },
  HELP_COMMENT: {
    delegate: prisma.helpPostComment as unknown as ModuleConfig["delegate"],
    model: "helpPostComment",
    reportCountField: "reportCount",
  },
  CONTRIBUTION_COMMENT: {
    delegate: prisma.contributionComment as unknown as ModuleConfig["delegate"],
    model: "contributionComment",
    reportCountField: "reportCount",
  },
  PUBLICATION_COMMENT: {
    delegate: prisma.publicationComment as unknown as ModuleConfig["delegate"],
    model: "publicationComment",
    reportCountField: "reportCount",
  },
  RESEARCH_TOOL_COMMENT: {
    delegate: prisma.researchToolComment as unknown as ModuleConfig["delegate"],
    model: "researchToolComment",
    reportCountField: "reportCount",
  },
  RESEARCH_GRANT_COMMENT: {
    delegate: prisma.researchGrantComment as unknown as ModuleConfig["delegate"],
    model: "researchGrantComment",
    reportCountField: "reportCount",
  },
  COURSE_COMMENT: {
    delegate: prisma.courseComment as unknown as ModuleConfig["delegate"],
    model: "courseComment",
    reportCountField: "reportCount",
  },
  JOURNAL_COMMENT: {
    delegate: prisma.journalComment as unknown as ModuleConfig["delegate"],
    model: "journalComment",
    reportCountField: "reportCount",
  },
  RESULT_COMMENT: {
    delegate: prisma.resultComment as unknown as ModuleConfig["delegate"],
    model: "resultComment",
    reportCountField: "reportCount",
  },
  SURVEY_COMMENT: {
    delegate: prisma.surveyComment as unknown as ModuleConfig["delegate"],
    model: "surveyComment",
    reportCountField: "reportCount",
  },
  RESEARCH_EVENT_COMMENT: {
    delegate: prisma.researchEventComment as unknown as ModuleConfig["delegate"],
    model: "researchEventComment",
    reportCountField: "reportCount",
  },
  PHD_ADMISSION_COMMENT: {
    delegate: prisma.phdAdmissionComment as unknown as ModuleConfig["delegate"],
    model: "phdAdmissionComment",
    reportCountField: "reportCount",
  },
  JOB_VACANCY_COMMENT: {
    delegate: prisma.jobVacancyComment as unknown as ModuleConfig["delegate"],
    model: "jobVacancyComment",
    reportCountField: "reportCount",
  },
  SUPERVISOR_COMMENT: {
    delegate: prisma.supervisorComment as unknown as ModuleConfig["delegate"],
    model: "supervisorComment",
    reportCountField: "reportCount",
  },
  RECOMMENDATION_COMMENT: {
    delegate: prisma.recommendationComment as unknown as ModuleConfig["delegate"],
    model: "recommendationComment",
    reportCountField: "reportCount",
  },
};
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
  const user = await requireActiveUser("Log in to continue.");

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

  let report;
  try {
    report = await prisma.$transaction(async (tx) => {
      // 1. Create the report record.
      const newReport = await tx.report.create({
        data: {
          entityId,
          entityType,
          module: mod,
          category: reason,
          details: normalizedDetails,
          reporterId: user.id,
        },
      });

      // 2. Atomically increment the materialized reportCount on the target.
      // RULE 1: resolve the delegate against the transaction client `tx` so
      // this write runs on the single pooled connection (a global-prisma
      // delegate here would check out a SECOND connection mid-tx -> deadlock).
      await (tx as unknown as Record<
        string,
        {
          update: (
            args: {
              where: { id: string };
              data: Record<string, unknown>;
            },
          ) => Promise<unknown>;
        }
      >)[config.model].update({
        where: { id: entityId },
        data: {
          [config.reportCountField]: { increment: 1 },
        },
      });

      return newReport;
    });
  } catch (err) {
    // @@unique([reporterId, entityId]) — the user already reported this
    // entity. Return a friendly message instead of an uncaught 500.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return {
        success: false,
        message: "You have already reported this item.",
      };
    }
    throw err;
  }

  return { success: true, data: report };
}

// ----------------------------------------------------------------------------
// CONTENT MODEL MAPS (used by moderateContent)
// ----------------------------------------------------------------------------

// Maps a content-type key to the Prisma delegate for the row. Comments and
// top-level content share the same shape so a single resolver suffices.
const modelMap: Record<string, { model: string }> = {
  feed: { model: "socialPost" },
  blog: { model: "article" },
  publication: { model: "publication" },
  journal: { model: "journal" },
  researchTool: { model: "researchTool" },
  admission: { model: "phdAdmission" },
  event: { model: "researchEvent" },
  vacancy: { model: "jobVacancy" },
  help: { model: "helpPost" },
  result: { model: "result" },
  contribution: { model: "contribution" },
  supervisor: { model: "supervisor" },
  recommendation: { model: "recommendation" },
  survey: { model: "researchSurvey" },
  SCHOLAR_PROFILE: { model: "user" },
};

// Comment models (soft-deleted / frozen per RULE 4).
const commentModelMap: Record<string, { model: string }> = {
  socialComment: { model: "socialComment" },
  articleComment: { model: "articleComment" },
  helpComment: { model: "helpPostComment" },
  contributionComment: { model: "contributionComment" },
  publicationComment: { model: "publicationComment" },
  researchToolComment: { model: "researchToolComment" },
  researchGrantComment: { model: "researchGrantComment" },
  courseComment: { model: "courseComment" },
  journalComment: { model: "journalComment" },
  resultComment: { model: "resultComment" },
  surveyComment: { model: "surveyComment" },
  researchEventComment: { model: "researchEventComment" },
  admissionComment: { model: "phdAdmissionComment" },
  vacancyComment: { model: "jobVacancyComment" },
  supervisorComment: { model: "supervisorComment" },
  recommendationComment: { model: "recommendationComment" },
};

// -----------------------------------------------------------------------------
// moderateContent — admin-facing server action dispatching to freeze, delete,
// or dismiss reports inside a single atomic transaction (RULE 3).
// Maps a comment content type to its top-level content delegate and the FK
// field linking the comment to that parent. Used to restore materialized
// totalComments counters when a soft-deleted top-level comment is recovered.
const COMMENT_TOP_LEVEL: Record<string, { model: string; fk: string }> = {
  socialComment: { model: "socialPost", fk: "socialPostId" },
  articleComment: { model: "article", fk: "articleId" },
  helpComment: { model: "helpPost", fk: "helpPostId" },
  contributionComment: { model: "contribution", fk: "contributionId" },
  publicationComment: { model: "publication", fk: "publicationId" },
  researchToolComment: { model: "researchTool", fk: "researchToolId" },
  researchGrantComment: { model: "researchGrant", fk: "researchGrantId" },
  courseComment: { model: "course", fk: "courseId" },
  journalComment: { model: "journal", fk: "journalId" },
  resultComment: { model: "result", fk: "resultId" },
  surveyComment: { model: "researchSurvey", fk: "surveyId" },
  researchEventComment: { model: "researchEvent", fk: "researchEventId" },
  admissionComment: { model: "phdAdmission", fk: "phdAdmissionId" },
  vacancyComment: { model: "jobVacancy", fk: "jobVacancyId" },
  supervisorComment: { model: "supervisor", fk: "supervisorId" },
  recommendationComment: { model: "recommendation", fk: "recommendationId" },
};

// Resolves the top-level parent of a comment and reports whether that parent
// is itself soft-deleted (so counters are only restored for visible content).
async function resolveCommentParent(
  client: Prisma.TransactionClient,
  commentModel: string,
  contentType: string,
  contentId: string,
) {
  const tx = client as Prisma.TransactionClient & Record<string, ModelDelegate>;
  const cfg = COMMENT_TOP_LEVEL[contentType];
  if (!cfg) return null;
  const model = tx[commentModel];
  const comment = (await model.findUnique({
    where: { id: contentId },
    select: { [cfg.fk]: true },
  })) as Record<string, string | null> | null;
  const parentId = comment?.[cfg.fk];
  if (!parentId) return null;
  const parent = (await tx[cfg.model].findUnique({
    where: { id: parentId },
    select: { id: true, isDeleted: true },
  })) as { id: string; isDeleted: boolean } | null;
  if (!parent) return null;
  return { model: tx[cfg.model], id: parent.id, isDeleted: parent.isDeleted };
}

// -----------------------------------------------------------------------------
// MODERATION NOTIFICATIONS
// -----------------------------------------------------------------------------
// Every admin moderation action (FREEZE / UNFREEZE / DELETE / RECOVER) must
// notify the affected owner and offer a clickable link back to the exact
// resource — the content page, the post/article a comment lives on, or the
// user's profile. `targetType` is the key consumed by `getNotificationLink`
// in src/lib/notification-links.ts, NOT the generic "MODERATION" stub that
// produced dead (unlinkable) notifications.
const CONTENT_TARGET_TYPE: Record<string, string> = {
  // Top-level content
  feed: "post",
  blog: "article",
  publication: "publication",
  journal: "journal",
  researchTool: "researchTool",
  researchGrant: "researchGrant",
  course: "course",
  admission: "admission",
  event: "event",
  vacancy: "vacancy",
  help: "help",
  result: "result",
  contribution: "contribution",
  supervisor: "supervisor",
  recommendation: "recommendation",
  survey: "survey",
  SCHOLAR_PROFILE: "profile",
  // Nested comments -> resource they belong to
  socialComment: "post",
  articleComment: "article",
  helpComment: "help",
  contributionComment: "contribution",
  publicationComment: "publication",
  researchToolComment: "researchTool",
  researchGrantComment: "researchGrant",
  courseComment: "course",
  journalComment: "journal",
  resultComment: "result",
  surveyComment: "survey",
  researchEventComment: "event",
  admissionComment: "admission",
  vacancyComment: "vacancy",
  supervisorComment: "supervisor",
  recommendationComment: "recommendation",
};

type ModerationTarget = {
  recipientId: string | null;
  targetType: string;
  targetId: string;
  isComment: boolean;
  isProfile: boolean;
};

async function resolveModerationTarget(
  client: Prisma.TransactionClient,
  opts: {
    contentType: string;
    contentId: string;
    commentModel?: string;
    model?: string;
  },
): Promise<ModerationTarget> {
  const tx = client as Prisma.TransactionClient & Record<string, ModelDelegate>;
  const { contentType, contentId, commentModel, model } = opts;
  const isProfile = contentType === "SCHOLAR_PROFILE";
  const isComment = Boolean(commentModel);

  // A profile IS the user — notify them and link to their /scholars page.
  if (isProfile) {
    return {
      recipientId: contentId,
      targetType: "profile",
      targetId: contentId,
      isComment: false,
      isProfile: true,
    };
  }

  const targetType = CONTENT_TARGET_TYPE[contentType] || "MODERATION";

  // Comments link to the top-level page they live on (the post/article/etc.),
  // and the recipient is the comment author.
  if (commentModel) {
    const commentModelDelegate = tx[commentModel];
    const comment = (await commentModelDelegate.findUnique({
      where: { id: contentId },
      select: { authorId: true },
    })) as { authorId?: string | null } | null;

    let targetId = contentId;
    const parent = await resolveCommentParent(
      client,
      commentModel,
      contentType,
      contentId,
    );
    if (parent) {
      targetId = parent.id;
      if (contentType === "recommendationComment") {
        const cfg = COMMENT_TOP_LEVEL[contentType];
        const rec = (await tx[cfg.model].findUnique({
          where: { id: parent.id },
          select: { supervisorId: true },
        })) as { supervisorId?: string | null } | null;
        if (rec?.supervisorId) targetId = `${rec.supervisorId}/${parent.id}`;
      }
    }
    return {
      recipientId: comment?.authorId ?? null,
      targetType,
      targetId,
      isComment,
      isProfile: false,
    };
  }

  // Top-level content: recipient is the author; target is the content page.
  let recipientId: string | null = null;
  let targetId = contentId;
  if (model) {
    const modelDelegate = tx[model];
    const result = (await modelDelegate.findUnique({
      where: { id: contentId },
      select: {
        authorId: true,
        ...(contentType === "recommendation" ? { supervisorId: true } : {}),
      },
    })) as { authorId?: string | null; supervisorId?: string | null } | null;
    recipientId = result?.authorId ?? null;
    if (contentType === "recommendation" && result?.supervisorId) {
      targetId = `${result.supervisorId}/${contentId}`;
    }
  }
  return { recipientId, targetType, targetId, isComment: false, isProfile: false };
}

function buildModerationNotice(
  action: ModerationAction,
  isComment: boolean,
  isProfile: boolean,
) {
  const subject = isComment ? "comment" : isProfile ? "profile" : "content";
  switch (action) {
    case "FREEZE":
      return {
        type: isProfile ? "USER_FROZEN" : "CONTENT_FROZEN",
        title: isProfile
          ? "Your account has been frozen"
          : "Your content has been frozen",
        body: isProfile
          ? "An administrator froze your account because of reports. While frozen you cannot create new content, but you can appeal this decision."
          : `An administrator froze your ${subject} because of reports. You can appeal this decision if you believe it was a mistake.`,
      };
    case "UNFREEZE":
      return {
        type: isProfile ? "USER_UNFROZEN" : "CONTENT_UNFROZEN",
        title: isProfile
          ? "Your account has been unfrozen"
          : "Your content has been unfrozen",
        body: isProfile
          ? "An administrator unfroze your account. You can create and engage with content again."
          : `An administrator unfroze your ${subject}. It is visible to the community again.`,
      };
    case "DELETE":
      return {
        type: isProfile ? "USER_DELETED" : "CONTENT_DELETED",
        title: isProfile
          ? "Your profile has been deleted"
          : "Your content has been deleted",
        body: isProfile
          ? "An administrator deleted your profile because it violated community guidelines. You can appeal this decision."
          : `An administrator deleted your ${subject}. You can appeal this decision.`,
      };
    case "RECOVER":
      return {
        type: isProfile ? "USER_RECOVERED" : "CONTENT_RECOVERED",
        title: isProfile
          ? "Your profile has been recovered"
          : "Your content has been recovered",
        body: isProfile
          ? "An administrator recovered your profile after reviewing it. You can use your account normally again."
          : `An administrator recovered your ${subject} after reviewing it. It is visible to the community again.`,
      };
    default:
      return {
        type: "MODERATION",
        title: "Moderation update",
        body: "Your content was updated by moderators.",
      };
  }
}

type ModerationTx = {
  notification: {
    create: (args: {
      data: {
        recipientId: string;
        actorId: string;
        type: string;
        targetType: string;
        targetId: string;
        title: string;
        body: string;
      };
    }) => Promise<unknown>;
  };
};

async function notifyModerationTarget(
  tx: ModerationTx,
  target: ModerationTarget,
  actorId: string,
  notice: { type: string; title: string; body: string },
) {
  if (!target.recipientId || target.recipientId === actorId) return;
  await tx.notification.create({
    data: {
      recipientId: target.recipientId,
      actorId,
      type: notice.type,
      targetType: target.targetType,
      targetId: target.targetId,
      title: notice.title,
      body: notice.body,
    },
  });
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
  const user = await requireActiveUser("Log in to continue.");

  const { isUserAdmin } = await import("@/lib/auth");
  if (!(await isUserAdmin(user.id))) {
    throw new Error("Not authorized.");
  }

  try {
    const isCommentType = Object.prototype.hasOwnProperty.call(
      commentModelMap,
      contentType,
    );
    const commentEntry = isCommentType ? commentModelMap[contentType] : undefined;
    const entry = commentEntry ? undefined : modelMap[contentType];
    if (!entry && !commentEntry) throw new Error("Invalid content type");

    const result = await prisma.$transaction(async (tx) => {
      const getDelegate = (modelName: string): ModelDelegate => {
        const delegate = (tx as unknown as Record<string, ModelDelegate>)[
          modelName
        ];
        if (!delegate) throw new Error(`Invalid model delegate: ${modelName}`);
        return delegate;
      };

      const txCommentEntry = commentEntry ? { model: commentEntry.model } : undefined;
      const txEntry = entry ? { model: entry.model } : undefined;
      const txCommentDelegate = txCommentEntry
        ? getDelegate(txCommentEntry.model)
        : undefined;
      const txEntryDelegate = txEntry ? getDelegate(txEntry.model) : undefined;

      if (commentEntry) {
      // --- Comment moderation (soft delete, RULE 4) ---
      // Comments now carry isDeleted / isFrozen columns, so they support the
      // same FREEZE / UNFREEZE / DELETE / RECOVER / DISMISS_REPORTS matrix as
      // every other content type. Rows are never destroyed.
      const entity = (await txCommentDelegate!.findUnique({
        where: { id: contentId },
        select: { id: true, isDeleted: true, isFrozen: true },
      })) as { id: string; isDeleted: boolean; isFrozen: boolean } | null;
      if (!entity) throw new Error("Content not found");

      switch (action) {
        case "FREEZE": {
          const updated = (await txCommentDelegate!.update({
            where: { id: contentId },
            data: { isFrozen: true },
          })) as { id: string; isFrozen: boolean; isDeleted: boolean };
          // Notify the comment author and link to the post it belongs to.
          const frozenCommentTarget = await resolveModerationTarget(tx, {
            contentType,
            contentId,
            commentModel: commentEntry.model,
          });
          const frozenCommentNotice = buildModerationNotice(action, true, false);
          await notifyModerationTarget(
            tx as unknown as ModerationTx,
            frozenCommentTarget,
            user.id,
            frozenCommentNotice,
          );
          return { action, success: true, data: updated };
        }

        case "UNFREEZE": {
          const updated = (await txCommentDelegate!.update({
            where: { id: contentId },
            data: { isFrozen: false },
          })) as { id: string; isFrozen: boolean; isDeleted: boolean };
          // Notify the comment author and link to the post it belongs to.
          const unfrozenCommentTarget = await resolveModerationTarget(tx, {
            contentType,
            contentId,
            commentModel: commentEntry.model,
          });
          const unfrozenCommentNotice = buildModerationNotice(action, true, false);
          await notifyModerationTarget(
            tx as unknown as ModerationTx,
            unfrozenCommentTarget,
            user.id,
            unfrozenCommentNotice,
          );
          return { action, success: true, data: updated };
        }

        case "DELETE": {
          // Soft-delete (RULE 4) + freeze + dismiss pending reports. For a
          // first-time delete, reverse the author's vote-derived reputation
          // and decrement the parent counters — mirroring the user-initiated
          // delete flow in deleteCommentTransaction.
          const full = (await txCommentDelegate!.findUnique({
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
              await txCommentDelegate!.update({
                where: { id: full.parentId },
                data: { totalReplies: { decrement: 1 } },
              });
            } else {
              const parent = await resolveCommentParent(
                tx,
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

          const updated = (await txCommentDelegate!.update({
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
          // Notify the comment author and link to the post it belongs to.
          const deletedCommentTarget = await resolveModerationTarget(tx, {
            contentType,
            contentId,
            commentModel: commentEntry.model,
          });
          const deletedCommentNotice = buildModerationNotice(action, true, false);
          await notifyModerationTarget(
            tx as unknown as ModerationTx,
            deletedCommentTarget,
            user.id,
            deletedCommentNotice,
          );
          return { action, success: true, data: updated };
        }

        case "RECOVER": {
          // Restore a soft-deleted comment: clear the delete AND the freeze
          // that was applied alongside it, so it returns to the thread
          // exactly as it was before deletion. Reputation gained from its
          // votes is re-granted, and parent counters are restored (skipping
          // parents that are themselves soft-deleted).
          const full = (await txCommentDelegate!.findUnique({
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
              await txCommentDelegate!.update({
                where: { id: full.parentId },
                data: { totalReplies: { increment: 1 } },
              });
            } else {
              const parent = await resolveCommentParent(
                tx,
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

          const updated = (await txCommentDelegate!.update({
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
          // Notify the comment author and link to the post it belongs to.
          const recoveredCommentTarget = await resolveModerationTarget(tx, {
            contentType,
            contentId,
            commentModel: commentEntry.model,
          });
          const recoveredCommentNotice = buildModerationNotice(action, true, false);
          await notifyModerationTarget(
            tx as unknown as ModerationTx,
            recoveredCommentTarget,
            user.id,
            recoveredCommentNotice,
          );
          return { action, success: true, data: updated };
        }

        case "DISMISS_REPORTS": {
          await txCommentDelegate!.update({
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
          const updated = (await txCommentDelegate!.update({
            where: { id: contentId },
            data: { hasActiveAppeal: false },
          })) as { id: string; hasActiveAppeal: boolean };
          await tx.appeal.updateMany({
            where: { entityId: contentId, status: "PENDING" },
            data: { status: "DISMISSED", reviewedById: user.id, reviewedAt: new Date() },
          });
          // Notify the comment author that their appeal was declined and link
          // to the post the comment belongs to.
          const appealCommentTarget = await resolveModerationTarget(tx, {
            contentType,
            contentId,
            commentModel: commentEntry.model,
          });
          await notifyModerationTarget(
            tx as unknown as ModerationTx,
            appealCommentTarget,
            user.id,
            {
              type: "APPEAL_REJECTED",
              title: "Your appeal was reviewed",
              body: "Moderators reviewed your appeal and decided to keep the content frozen.",
            },
          );
          return { action, success: true, data: updated };
        }

        default:
          throw new Error(`Unknown moderation action: ${action}`);
      }
    }

    if (!entry) throw new Error("Invalid entry");

    const entity = (await txEntryDelegate!.findUnique({
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
        // Freeze the content and notify the owner. SCHOLAR_PROFILE resolves
        // to the User model (the owner = the user themselves), so the target
        // resolver handles recipient + the /scholars link for us.
        const updated = (await txEntryDelegate!.update({
          where: { id: contentId },
          data: { isFrozen: true },
        })) as { id: string; isFrozen: boolean; isDeleted: boolean };
        const frozenTarget = await resolveModerationTarget(tx, {
          contentType,
          contentId,
          model: entry.model,
        });
        const frozenNotice = buildModerationNotice(action, false, frozenTarget.isProfile);
        await notifyModerationTarget(
          tx as unknown as ModerationTx,
          frozenTarget,
          user.id,
          frozenNotice,
        );
        // Return the updated row fields so the client can surgically patch
        // its React Query cache (RULE 1) instead of refetching.
        return { action, success: true, data: updated };
      }

      case "UNFREEZE": {
        const updated = (await txEntryDelegate!.update({
          where: { id: contentId },
          data: { isFrozen: false },
        })) as { id: string; isFrozen: boolean; isDeleted: boolean };
        // Always notify the owner when an admin unfreezes content (whether
        // manually or after an appeal) so they know it is active again and can
        // click through to the resource.
        const unfrozenTarget = await resolveModerationTarget(tx, {
          contentType,
          contentId,
          model: entry.model,
        });
        const unfrozenNotice = buildModerationNotice(action, false, unfrozenTarget.isProfile);
        await notifyModerationTarget(
          tx as unknown as ModerationTx,
          unfrozenTarget,
          user.id,
          unfrozenNotice,
        );
        await tx.appeal.updateMany({
          where: { entityId: contentId, status: "PENDING" },
          data: { status: "ACTIONED", reviewedById: user.id, reviewedAt: new Date() },
        });
        return { action, success: true, data: updated };
      }

      case "DELETE": {
        // Soft-delete (RULE 4) + freeze + dismiss pending reports. For a
        // first-time delete, reverse the author's vote-derived reputation
        // and decrement their materialized content count — mirroring the
        // user-initiated delete flows.
        const countField = AUTHOR_COUNT_FIELD[contentType];
        const full = (await txEntryDelegate!.findUnique({
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

        const updated = (await txEntryDelegate!.update({
          where: { id: contentId },
          data: {
            isDeleted: true,
            isFrozen: true,
            ...(contentType !== "SCHOLAR_PROFILE"
              ? { deletedByType: "ADMIN", deletedById: user.id }
              : {}),
          },
        })) as { id: string; isFrozen: boolean; isDeleted: boolean };
        await tx.report.updateMany({
          where: { entityId: contentId, status: "PENDING" },
          data: { status: "DISMISSED" },
        });
        // Notify the owner and link to the deleted resource (the content page
        // or the user's profile) so they know it was removed and can appeal.
        const deletedTarget = await resolveModerationTarget(tx, {
          contentType,
          contentId,
          model: entry.model,
        });
        const deletedNotice = buildModerationNotice(action, false, deletedTarget.isProfile);
        await notifyModerationTarget(
          tx as unknown as ModerationTx,
          deletedTarget,
          user.id,
          deletedNotice,
        );
        return { action, success: true, data: updated };
      }

      case "RECOVER": {
        // Restore a soft-deleted row: clear the tombstone AND the freeze
        // that was applied alongside the delete, so the content returns to
        // the feed exactly as it was before deletion. The reputation that
        // was reversed at delete time is re-granted, and the author's
        // materialized content count is restored.
        const countField = AUTHOR_COUNT_FIELD[contentType];
        const full = (await txEntryDelegate!.findUnique({
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

        const updated = (await txEntryDelegate!.update({
          where: { id: contentId },
          data: {
            isDeleted: false,
            isFrozen: false,
            hasActiveAppeal: false,
            ...(contentType !== "SCHOLAR_PROFILE"
              ? { deletedByType: null, deletedById: null }
              : {}),
          },
        })) as { id: string; isFrozen: boolean; isDeleted: boolean };
        await tx.appeal.updateMany({
          where: { entityId: contentId, status: "PENDING" },
          data: { status: "ACTIONED", reviewedById: user.id, reviewedAt: new Date() },
        });
        // Notify the owner and link to the recovered resource so they know it
        // is live again.
        const recoveredTarget = await resolveModerationTarget(tx, {
          contentType,
          contentId,
          model: entry.model,
        });
        const recoveredNotice = buildModerationNotice(action, false, recoveredTarget.isProfile);
        await notifyModerationTarget(
          tx as unknown as ModerationTx,
          recoveredTarget,
          user.id,
          recoveredNotice,
        );
        return { action, success: true, data: updated };
      }

      case "DISMISS_REPORTS": {
        await txEntryDelegate!.update({
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
        const updated = (await txEntryDelegate!.update({
          where: { id: contentId },
          data: { hasActiveAppeal: false },
        })) as { id: string; hasActiveAppeal: boolean };
        // Notify the owner that their appeal was declined and link back to
        // the resource (content page or profile).
        const appealRejectedTarget = await resolveModerationTarget(tx, {
          contentType,
          contentId,
          model: entry.model,
        });
        await notifyModerationTarget(
          tx as unknown as ModerationTx,
          appealRejectedTarget,
          user.id,
          {
            type: "APPEAL_REJECTED",
            title: "Your appeal was reviewed",
            body: "Moderators reviewed your appeal and decided to keep the content frozen.",
          },
        );
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Moderation action failed.";
    throw new Error(`Failed to ${action.toLowerCase()} content: ${message}`);
  }
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
