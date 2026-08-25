"use server";

import prisma from "@/lib/db";
import { requireCurrentUser, isUserAdmin } from "@/lib/auth";
import { notifyUserById } from "@/lib/notifications";

import {
  AdminContentItem,
  CommentModel,
  ContentMap,
  DeleteMapValue,
  FreezableContentModel,
} from "@/types/admin";

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

  await model.update({
    where: { id: commentId },
    data: {
      content: "[This comment was deleted by an administrator]",
      authorId: null,
    },
  });

  return { success: true, data: { id: commentId } };
}

// Get admin dashboard stats (counts per content type + users)
export async function getAdminStats() {
  const user = await requireCurrentUser("Log in to access admin.");

  if (!(await isUserAdmin(user.id))) {
    throw new Error("Not authorized.");
  }

  const sections = {
    users: await prisma.user.count(),
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
    totalUsers: sections.users,
    totalContent,
    sections,
  };
}

// Get all users for admin panel
export async function getAdminUsers() {
  const user = await requireCurrentUser("Log in to access admin.");

  if (!(await isUserAdmin(user.id))) {
    throw new Error("Not authorized.");
  }

  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      isFrozen: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
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
    notifyUserById({
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
    notifyUserById({
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

// Get all content for admin panel
export async function getAdminContent(
  contentType?: string,
): Promise<AdminContentItem[]> {
  const user = await requireCurrentUser("Log in to access admin.");

  if (!(await isUserAdmin(user.id))) {
    throw new Error("Not authorized.");
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
    if (!config) return [];

    const items = await config.model.findMany({
      include: {
        author: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return items.map((item) => ({
      ...item,
      detailHref: config.detailHref(item),
    }));
  }

  return [];
}
