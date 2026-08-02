'use server'

import prisma from '@/lib/db'
import { requireCurrentUser, isUserAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

// Freeze/unfreeze content
export async function toggleContentFreeze(contentType: string, contentId: string) {
  const user = await requireCurrentUser('Log in to access admin.')

  if (!await isUserAdmin(user.id)) {
    throw new Error('Not authorized.')
  }

  const modelMap: Record<string, any> = {
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
  }

  const model = modelMap[contentType]
  if (!model) throw new Error('Invalid content type')

  const content = await model.findUnique({
    where: { id: contentId },
    select: { isFrozen: true },
  })

  if (!content) throw new Error('Content not found')

  await model.update({
    where: { id: contentId },
    data: { isFrozen: !content.isFrozen },
  })

  revalidatePath('/admin')
  return { success: true, isFrozen: !content.isFrozen }
}

// Freeze/unfreeze author
export async function toggleAuthorFreeze(authorId: string) {
  const user = await requireCurrentUser('Log in to access admin.')

  if (!await isUserAdmin(user.id)) {
    throw new Error('Not authorized.')
  }

  const author = await prisma.user.findUnique({
    where: { id: authorId },
    select: { isFrozen: true },
  })

  if (!author) throw new Error('Author not found')

  await prisma.user.update({
    where: { id: authorId },
    data: { isFrozen: !author.isFrozen },
  })

  revalidatePath('/admin')
  return { success: true, isFrozen: !author.isFrozen }
}

// Delete any content by admin
export async function adminDeleteContent(contentType: string, contentId: string) {
  const user = await requireCurrentUser('Log in to access admin.')

  if (!await isUserAdmin(user.id)) {
    throw new Error('Not authorized.')
  }

  const deleteMap: Record<string, any> = {
    feed: { model: prisma.socialPost, path: '/feed' },
    blog: { model: prisma.article, path: '/blog' },
    publication: { model: prisma.publication, path: '/publications' },
    journal: { model: prisma.journal, path: '/journals' },
    researchTool: { model: prisma.researchTool, path: '/research-tools' },
    admission: { model: prisma.phdAdmission, path: '/admissions' },
    event: { model: prisma.researchEvent, path: '/events' },
    vacancy: { model: prisma.jobVacancy, path: '/vacancies' },
    help: { model: prisma.helpPost, path: '/help' },
    result: { model: prisma.result, path: '/results' },
    contribution: { model: prisma.contribution, path: '/contributions' },
    supervisor: { model: prisma.supervisor, path: '/supervisor' },
    recommendation: { model: prisma.recommendation, path: '/supervisor' },
    survey: { model: prisma.researchSurvey, path: '/surveys' },
  }

  const config = deleteMap[contentType]
  if (!config) throw new Error('Invalid content type')

  await config.model.delete({ where: { id: contentId } })
  revalidatePath(config.path)
  revalidatePath('/admin')

  return { success: true }
}

// Delete comment by admin
export async function adminDeleteComment(commentType: string, commentId: string) {
  const user = await requireCurrentUser('Log in to access admin.')

  if (!await isUserAdmin(user.id)) {
    throw new Error('Not authorized.')
  }

  const commentModelMap: Record<string, any> = {
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
  }

  const model = commentModelMap[commentType]
  if (!model) throw new Error('Invalid comment type')

  await model.delete({ where: { id: commentId } })
  revalidatePath('/admin')

  return { success: true }
}

// Get admin dashboard stats (counts per content type + users)
export async function getAdminStats() {
  const user = await requireCurrentUser('Log in to access admin.')

  if (!await isUserAdmin(user.id)) {
    throw new Error('Not authorized.')
  }

  const [
    totalUsers,
    feed,
    blog,
    publications,
    journals,
    researchTools,
    admissions,
    events,
    vacancies,
    help,
    results,
    contributions,
    supervisors,
    recommendations,
    surveys,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.socialPost.count(),
    prisma.article.count(),
    prisma.publication.count(),
    prisma.journal.count(),
    prisma.researchTool.count(),
    prisma.phdAdmission.count(),
    prisma.researchEvent.count(),
    prisma.jobVacancy.count(),
    prisma.helpPost.count(),
    prisma.result.count(),
    prisma.contribution.count(),
    prisma.supervisor.count(),
    prisma.recommendation.count(),
    prisma.researchSurvey.count(),
  ])

  const sections = {
    feed,
    blog,
    publications,
    journals,
    researchTools,
    admissions,
    events,
    vacancies,
    help,
    results,
    contributions,
    supervisors,
    recommendations,
    surveys,
  }

  const totalContent = Object.values(sections).reduce((a, b) => a + b, 0)

  return {
    totalUsers,
    totalContent,
    sections,
  }
}

// Get all content for admin panel
export async function getAdminContent(contentType?: string) {
  const user = await requireCurrentUser('Log in to access admin.')

  if (!await isUserAdmin(user.id)) {
    throw new Error('Not authorized.')
  }

  if (contentType) {
    const contentMap: Record<string, { model: any; detailHref: (item: any) => string }> = {
      feed: {
        model: prisma.socialPost,
        detailHref: (item) => `/feed/${item.id}`,
      },
      blog: {
        model: prisma.article,
        detailHref: (item) => `/blog/${item.slug}`,
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
        detailHref: (item) => `/supervisor/${item.supervisorId}/recommendation/${item.id}`,
      },
      surveys: {
        model: prisma.researchSurvey,
        detailHref: (item) => `/surveys/${item.id}`,
      },
    }

    const config = contentMap[contentType]
    if (!config) return []

    const items = await config.model.findMany({
      include: { author: true },
      orderBy: { createdAt: 'desc' },
    })

    return items.map((item: any) => ({
      ...item,
      detailHref: config.detailHref(item),
    }))
  }

  return {}
}
