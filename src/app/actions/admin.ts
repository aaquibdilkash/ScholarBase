"use server";

import prisma from "@/lib/db";
import { requireCurrentUser, isUserAdmin } from "@/lib/auth";
import { notifyUserById } from "@/lib/notifications";

import {
  AdminCommentModel,
  AdminContentItem,
  AdminPage,
  AdminAppealItem,
  CommentModel,
  ContentMap,
  DeleteMapValue,
  FreezableContentModel,
  ReportWithReporter,
} from "@/types/admin";
import { ADMIN_PAGE_SIZE, MODULE_TO_CONTENT_TYPE } from "@/lib/constants";

// Freeze/unfreeze content
export async function toggleContentFreeze(
  contentType: string,
  contentId: string,
) {
  const user = await requireCurrentUser("Log in to access admin.");

  if (!(await isUserAdmin(user.id))) {
    throw new Error("Not authorized.");
  }

  const modelMap: Record<string, FreezableContentModel> = {
    feed: prisma.socialPost,
    blog: prisma.article,
    publication: prisma.publication,
    journal: prisma.journal,
    researchTool: prisma.researchTool,
    admission: prisma.phdAdmission,
    event: prisma.researchEvent,
    vacancy: prisma.jobVacancy,
    help: prisma.helpPost,
    result: prisma.result,
    contribution: prisma.contribution,
    supervisor: prisma.supervisor,
    recommendation: prisma.recommendation,
    survey: prisma.researchSurvey,
  };

  const model = modelMap[contentType];
  if (!model) throw new Error("Invalid content type");

  const content = await model.findUnique({
    where: { id: contentId },
    select: { isFrozen: true },
  });

  if (!content) throw new Error("Content not found");

  await model.update({
    where: { id: contentId },
    data: { isFrozen: !content.isFrozen },
  });

  return { success: true, data: content };
}

// Freeze/unfreeze author
export async function toggleAuthorFreeze(authorId: string) {
  const user = await requireCurrentUser("Log in to access admin.");

  if (!(await isUserAdmin(user.id))) {
    throw new Error("Not authorized.");
  }

  const author = await prisma.user.findUnique({
    where: { id: authorId },
    select: { isFrozen: true },
  });

  if (!author) throw new Error("Author not found");

  await prisma.user.update({
    where: { id: authorId },
    data: { isFrozen: !author.isFrozen },
  });

  return { success: true, data: author };
}

// Delete any content by admin
export async function adminDeleteContent(
  contentType: string,
  contentId: string,
) {
  const user = await requireCurrentUser("Log in to access admin.");

  if (!(await isUserAdmin(user.id))) {
    throw new Error("Not authorized.");
  }

  const deleteMap: Record<string, DeleteMapValue> = {
    feed: { model: prisma.socialPost, path: "/feed" },
    blog: { model: prisma.article, path: "/blog" },
    publication: { model: prisma.publication, path: "/publications" },
    journal: { model: prisma.journal, path: "/journals" },
    researchTool: { model: prisma.researchTool, path: "/research-tools" },
    admission: { model: prisma.phdAdmission, path: "/admissions" },
    event: { model: prisma.researchEvent, path: "/events" },
    vacancy: { model: prisma.jobVacancy, path: "/vacancies" },
    help: { model: prisma.helpPost, path: "/help" },
    result: { model: prisma.result, path: "/results" },
    contribution: { model: prisma.contribution, path: "/contributions" },
    supervisor: { model: prisma.supervisor, path: "/supervisor" },
    recommendation: { model: prisma.recommendation, path: "/supervisor" },
    survey: { model: prisma.researchSurvey, path: "/surveys" },
  };

  const config = deleteMap[contentType];
  if (!config) throw new Error("Invalid content type");

  await config.model.update({
    where: { id: contentId },
    data: { isDeleted: true },
  });

  return { success: true, data: { id: contentId } };
}

// Delete comment by admin
export async function adminDeleteComment(
  commentType: string,
  commentId: string,
) {
  const user = await requireCurrentUser("Log in to access admin.");

  if (!(await isUserAdmin(user.id))) {
    throw new Error("Not authorized.");
  }

  const commentModelMap: Record<string, CommentModel> = {
    post: prisma.socialComment,
    article: prisma.articleComment,
    publication: prisma.publicationComment,
    journal: prisma.journalComment,
    researchTool: prisma.researchToolComment,
    admission: prisma.phdAdmissionComment,
    event: prisma.researchEventComment,
    vacancy: prisma.jobVacancyComment,
    help: prisma.helpPostComment,
    result: prisma.resultComment,
    contribution: prisma.contributionComment,
    supervisor: prisma.supervisorComment,
    recommendation: prisma.recommendationComment,
    survey: prisma.surveyComment,
  };

  const model = commentModelMap[commentType];
  if (!model) throw new Error("Invalid comment type");

  // RULE 4: soft delete — toggle isDeleted (plus the companion freeze), never
  // destroy the row, so the comment can be recovered from the admin panel.
  await model.update({
    where: { id: commentId },
    data: { isDeleted: true, isFrozen: true },
  });

  return { success: true, data: { id: commentId } };
}

// Get admin dashboard stats (counts per content type + users).
// Uses pg_class row estimates for users (RULE 2 — zero-compute reads)
// because User is the only table that grows unbounded; content tables
// stay small enough that exact counts are cheap.
export async function getAdminStats() {
  const user = await requireCurrentUser("Log in to access admin.");

  if (!(await isUserAdmin(user.id))) {
    throw new Error("Not authorized.");
  }

  // Fast user count via pg_class (avoids full table scan on User).
  const pgResult = await prisma.$queryRaw<
    [{ estimate: bigint }]  >`SELECT reltuples::bigint AS estimate FROM pg_class WHERE relname = 'User'`;
  const userEstimate = Number(pgResult[0]?.estimate ?? 0);

  const sections = {
    users: userEstimate,
    appeals: await prisma.appeal.count(),
    feed: await prisma.socialPost.count(),
    blog: await prisma.article.count(),
    publications: await prisma.publication.count(),
    journals: await prisma.journal.count(),
    researchTools: await prisma.researchTool.count(),
    admissions: await prisma.phdAdmission.count(),
    events: await prisma.researchEvent.count(),
    vacancies: await prisma.jobVacancy.count(),
    help: await prisma.helpPost.count(),
    results: await prisma.result.count(),
    contributions: await prisma.contribution.count(),
    supervisors: await prisma.supervisor.count(),
    recommendations: await prisma.recommendation.count(),
    surveys: await prisma.researchSurvey.count(),
  };

  const totalContent =
    Object.values(sections).reduce((a, b) => a + b, 0) - sections.users;

  return {
    totalUsers: userEstimate,
    totalContent,
    sections,
  };
}

// Get appeals for the admin Appeals section — paginated, newest first.
export async function getAdminAppeals(
  page = 1,
  pageSize: number = ADMIN_PAGE_SIZE,
  entityType?: string,
): Promise<AdminPage<AdminAppealItem>> {
  const user = await requireCurrentUser("Log in to access admin.");

  if (!(await isUserAdmin(user.id))) {
    throw new Error("Not authorized.");
  }

  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (entityType) {
    where.entityType = entityType;
  }

  const [rows, total] = await Promise.all([
    prisma.appeal.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.appeal.count({ where }),
  ]);

  // Join the appealed parent entity via the same delegate maps used by
  // moderateContent — keyed by the appeal's contentType string — so the
  // Appeals table can show the entity's live moderation state (entityStatus)
  // and the author's current (possibly remediated) content.
  const appealEntityDelegates: Record<string, { findUnique: (args: { where: { id: string }; select: Record<string, boolean> }) => Promise<unknown> }> = {
    feed: prisma.socialPost,
    blog: prisma.article,
    publication: prisma.publication,
    journal: prisma.journal,
    researchTool: prisma.researchTool,
    researchGrant: prisma.researchGrant,
    course: prisma.course,
    result: prisma.result,
    contribution: prisma.contribution,
    help: prisma.helpPost,
    event: prisma.researchEvent,
    admission: prisma.phdAdmission,
    vacancy: prisma.jobVacancy,
    supervisor: prisma.supervisor,
    recommendation: prisma.recommendation,
    survey: prisma.researchSurvey,
    SCHOLAR_PROFILE: prisma.user,
    socialComment: prisma.socialComment,
    articleComment: prisma.articleComment,
    helpComment: prisma.helpPostComment,
    contributionComment: prisma.contributionComment,
    publicationComment: prisma.publicationComment,
    researchToolComment: prisma.researchToolComment,
    researchGrantComment: prisma.researchGrantComment,
    courseComment: prisma.courseComment,
    journalComment: prisma.journalComment,
    resultComment: prisma.resultComment,
    surveyComment: prisma.surveyComment,
    researchEventComment: prisma.researchEventComment,
    admissionComment: prisma.phdAdmissionComment,
    vacancyComment: prisma.jobVacancyComment,
    supervisorComment: prisma.supervisorComment,
    recommendationComment: prisma.recommendationComment,
  };

  const items = await Promise.all(
    rows.map(async (row) => {
      const delegate = appealEntityDelegates[row.entityType];
      const entity = delegate
        ? ((await delegate.findUnique({
            where: { id: row.entityId },
            select: { isFrozen: true, isDeleted: true },
          })) as { isFrozen: boolean; isDeleted: boolean } | null)
        : null;

      const entityStatus = entity?.isDeleted
        ? "DELETED"
        : entity?.isFrozen
          ? "FROZEN"
          : "ACTIVE";

      return {
        ...row,
        id: row.id,
        entityId: row.entityId,
        entityType: row.entityType,
        module: row.module,
        contentType: MODULE_TO_CONTENT_TYPE[row.module],
        status: row.status,
        category: row.category,
        details: row.details,
        ownerId: row.ownerId,
        owner: row.owner,
        reviewedBy: row.reviewedBy,
        reviewedById: row.reviewedById,
        reviewedAt: row.reviewedAt,
        createdAt: row.createdAt,
        hasActiveAppeal: row.status === "PENDING",
        // Alias the content tables use to surface the pending appeal text.
        appealReason: row.details,
        entityStatus,
      };
    }),
  );

  return {
    items: items as unknown as AdminAppealItem[],
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// Get all users for admin panel (paginated, newest first)
export async function getAdminUsers(
  page = 1,
  pageSize: number = ADMIN_PAGE_SIZE,
  statusFilter: "all" | "active" | "frozen" | "deleted" = "all",
): Promise<AdminPage<AdminContentItem>> {
  const user = await requireCurrentUser("Log in to access admin.");

  if (!(await isUserAdmin(user.id))) {
    throw new Error("Not authorized.");
  }

  const where =
    statusFilter === "active"
      ? { isDeleted: false, isFrozen: false }
      : statusFilter === "frozen"
        ? { isFrozen: true }
        : statusFilter === "deleted"
          ? { isDeleted: true }
          : undefined;

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        isFrozen: true,
        isDeleted: true,
        reportCount: true,
      },
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// Approve or reject a contribution
export async function updateContributionStatus(
  contentId: string,
  status: "APPROVED" | "REJECTED",
  reason?: string,
) {
  const user = await requireCurrentUser("Log in to access admin.");

  if (!(await isUserAdmin(user.id))) {
    throw new Error("Not authorized.");
  }

  if (status === "REJECTED" && !reason) {
    throw new Error("Missing reason for rejection");
  }

  const updatedContribution = await prisma.contribution.update({
    where: { id: contentId },
    data: {
      status,
      ...(status === "REJECTED" && { rejectionReason: reason }),
    },
    include: {
      author: {
        select: {
          id: true,
        },
      },
    },
  });

  if (status === "APPROVED") {
    // This is a fire-and-forget, no need to await
    await notifyUserById({
      recipientId: updatedContribution.author.id,
      actorId: user.id,
      type: "contribution-approved",
      targetType: "contribution",
      targetId: updatedContribution.id,
      title: "Your contribution has been approved!",
      body: `Your contribution "${updatedContribution.title}" has been approved.`,
    });
  } else if (status === "REJECTED") {
    // This is a fire-and-forget, no need to await
    await notifyUserById({
      recipientId: updatedContribution.author.id,
      actorId: user.id,
      type: "contribution-rejected",
      targetType: "contribution",
      targetId: updatedContribution.id,
      title: "Your contribution has been rejected",
      body: `Your contribution "${updatedContribution.title}" has been rejected. Reason: ${reason}`,
    });
  }

  return { success: true, data: {} };
}

// Get content for admin panel — paginated (10 rows per page).
// `view` selects the section's own posts table or its comment table.
export async function getAdminContent(
  contentType?: string,
  sortBy?: "createdAt" | "reportCount",
  page = 1,
  pageSize: number = ADMIN_PAGE_SIZE,
  view: "posts" | "comments" = "posts",
  statusFilter: "all" | "active" | "frozen" | "deleted" = "all",
): Promise<AdminPage<AdminContentItem>> {
  const user = await requireCurrentUser("Log in to access admin.");

  if (!(await isUserAdmin(user.id))) {
    throw new Error("Not authorized.");
  }

  const skip = (page - 1) * pageSize;
  const totalPages = (total: number) =>
    Math.max(1, Math.ceil(total / pageSize));

  // Prisma delegates share a common count() signature, but their generic
  // typing doesn't fit the loose delegates above — cast for indexed counts.
  const countOf = (model: unknown, where?: Record<string, unknown>) =>
    (model as { count: (args?: { where?: Record<string, unknown> }) => Promise<number> }).count({ where });

  // Status filter → Prisma where. Comments are soft-deleted/frozen with the
  // same isDeleted / isFrozen columns as every other content type (RULE 4).
  // authorId is non-nullable on every comment model — soft deletion only
  // flips isDeleted/deletedByType, so the author link (and thus appeals,
  // reputation rollbacks and audit trails) is always preserved.
  const buildStatusWhere = (): Record<string, unknown> | undefined => {
    if (view === "comments") {
      if (statusFilter === "deleted") return { isDeleted: true };
      if (statusFilter === "active") return { isDeleted: false, isFrozen: false };
      if (statusFilter === "frozen") return { isFrozen: true, isDeleted: false };
      return undefined;
    }
    if (statusFilter === "active") return { isDeleted: false, isFrozen: false };
    if (statusFilter === "frozen") return { isFrozen: true };
    if (statusFilter === "deleted") return { isDeleted: true };
    return undefined;
  };

  const where = buildStatusWhere();

  // Comments for a specific section — each section owns one comment table,
  // queried with indexed ordering + skip/take so we never scan full tables
  // (RULE 2). modelKey routes moderation actions to the correct delegate.
  if (view === "comments") {
    const sectionCommentModels: Record<string, { modelKey: string; model: AdminCommentModel }> = {
      feed: { modelKey: "socialComment", model: prisma.socialComment as unknown as AdminCommentModel },
      blog: { modelKey: "articleComment", model: prisma.articleComment as unknown as AdminCommentModel },
      publications: { modelKey: "publicationComment", model: prisma.publicationComment as unknown as AdminCommentModel },
      journals: { modelKey: "journalComment", model: prisma.journalComment as unknown as AdminCommentModel },
      researchTools: { modelKey: "researchToolComment", model: prisma.researchToolComment as unknown as AdminCommentModel },
      admissions: { modelKey: "admissionComment", model: prisma.phdAdmissionComment as unknown as AdminCommentModel },
      events: { modelKey: "researchEventComment", model: prisma.researchEventComment as unknown as AdminCommentModel },
      vacancies: { modelKey: "vacancyComment", model: prisma.jobVacancyComment as unknown as AdminCommentModel },
      help: { modelKey: "helpComment", model: prisma.helpPostComment as unknown as AdminCommentModel },
      results: { modelKey: "resultComment", model: prisma.resultComment as unknown as AdminCommentModel },
      contributions: { modelKey: "contributionComment", model: prisma.contributionComment as unknown as AdminCommentModel },
      supervisors: { modelKey: "supervisorComment", model: prisma.supervisorComment as unknown as AdminCommentModel },
      recommendations: { modelKey: "recommendationComment", model: prisma.recommendationComment as unknown as AdminCommentModel },
      surveys: { modelKey: "surveyComment", model: prisma.surveyComment as unknown as AdminCommentModel },
    };

    const commentConfig = contentType ? sectionCommentModels[contentType] : undefined;
    if (!commentConfig) {
      return { items: [], total: 0, page, pageSize, totalPages: 1 };
    }

    const orderBy:
      | { createdAt: "desc" }
      | { reportCount: "desc" } =
      sortBy === "reportCount"
        ? { reportCount: "desc" as const }
        : { createdAt: "desc" as const };

    const [rows, total] = await Promise.all([
      commentConfig.model.findMany({
        include: { author: true },
        orderBy,
        take: pageSize,
        skip,
        where,
      }),
      countOf(commentConfig.model, where),
    ]);

    // Fetch pending appeal reasons for these comments so admins can review
    // why the owner is appealing (mirrors how reportCount is surfaced).
    const appealReasons = await prisma.appeal.findMany({
      where: { entityId: { in: rows.map((r) => r.id) }, status: "PENDING" },
      select: { entityId: true, details: true },
      orderBy: { createdAt: "desc" },
    });
    const appealMap = new Map(appealReasons.map((a) => [a.entityId, a.details]));

    // Comments have no detail page; the table renders them as plain text.
    const items = rows.map((row) => ({
      ...row,
      modelKey: commentConfig.modelKey,
      detailHref: "",
      appealReason: appealMap.get(row.id) ?? null,
    })) as AdminContentItem[];

    return { items, total, page, pageSize, totalPages: totalPages(total) };
  }

  if (contentType) {
    const contentMap: ContentMap = {
      feed: {
        model: prisma.socialPost,
        detailHref: (item) => `/feed/${item.id}`,
      },
      blog: {
        model: prisma.article,
        detailHref: (item) => `/blog/${"slug" in item ? item.slug : item.id}`,
      },
      publications: {
        model: prisma.publication,
        detailHref: (item) => `/publications/${item.id}`,
      },
      journals: {
        model: prisma.journal,
        detailHref: (item) => `/journals/${item.id}`,
      },
      researchTools: {
        model: prisma.researchTool,
        detailHref: (item) => `/research-tools/${item.id}`,
      },
      admissions: {
        model: prisma.phdAdmission,
        detailHref: (item) => `/admissions/${item.id}`,
      },
      events: {
        model: prisma.researchEvent,
        detailHref: (item) => `/events/${item.id}`,
      },
      vacancies: {
        model: prisma.jobVacancy,
        detailHref: (item) => `/vacancies/${item.id}`,
      },
      help: {
        model: prisma.helpPost,
        detailHref: (item) => `/help/${item.id}`,
      },
      results: {
        model: prisma.result,
        detailHref: (item) => `/results/${item.id}`,
      },
      contributions: {
        model: prisma.contribution,
        detailHref: (item) => `/contributions/${item.id}`,
      },
      supervisors: {
        model: prisma.supervisor,
        detailHref: (item) => `/supervisor/${item.id}`,
      },
      recommendations: {
        model: prisma.recommendation,
        detailHref: (item) =>
          `/supervisor/${"supervisorId" in item ? item.supervisorId : ""}/recommendation/${item.id}`,
      },
      surveys: {
        model: prisma.researchSurvey,
        detailHref: (item) => `/surveys/${item.id}`,
      },
    };

    const config = contentMap[contentType];
    if (!config) {
      return { items: [], total: 0, page, pageSize, totalPages: 1 };
    }

    const orderBy: { createdAt: "desc" } | { reportCount: "desc" } =
      sortBy === "reportCount" ? { reportCount: "desc" } : { createdAt: "desc" };

    const [items, total] = await Promise.all([
      config.model.findMany({
        include: {
          author: true,
          ...(contentType === "recommendations" ? { supervisor: true } : {}),
        },
        where,
        orderBy,
        take: pageSize,
        skip,
      }),
      countOf(config.model, where),
    ]);

    // Fetch pending appeal reasons for these items so admins can review
    // why the owner is appealing (mirrors how reportCount is surfaced).
    const appealReasons = await prisma.appeal.findMany({
      where: { entityId: { in: items.map((i) => i.id) }, status: "PENDING" },
      select: { entityId: true, details: true },
      orderBy: { createdAt: "desc" },
    });
    const appealMap = new Map(appealReasons.map((a) => [a.entityId, a.details]));

    return {
      items: items.map((item) => ({
        ...item,
        detailHref: config.detailHref(item),
        appealReason: appealMap.get(item.id) ?? null,
      })) as AdminContentItem[],
      total,
      page,
      pageSize,
      totalPages: totalPages(total),
    };
  }

    return { items: [], total: 0, page, pageSize, totalPages: 1 };
}

/**
 * Fetch all PENDING reports against a single entity so moderators can
 * inspect who reported, which category/reason, and the reporter's notes.
 * (QA #11 — report metadata was previously invisible to admins.)
 */
export async function getReportsForEntity(
  entityId: string,
): Promise<ReportWithReporter[]> {
  const user = await requireCurrentUser("Log in to access admin.");
  if (!(await isUserAdmin(user.id))) {
    throw new Error("Not authorized.");
  }

  return prisma.report.findMany({
    where: { entityId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: {
      reporter: { select: { id: true, name: true, email: true } },
    },
    }) as unknown as Promise<ReportWithReporter[]>;
}
