import prisma from '@/lib/db'

/**
 * ZERO-COMPUTE TRENDING
 * ---------------------
 * Trending items are ranked by the pre-computed `trendingScore` column that a
 * background cron job refreshes (see src/app/api/cron/trending). Reads never
 * compute scores on the fly and never run relational `_count` aggregations —
 * the materialized `totalVotes`/`totalComments` columns are returned directly.
 */

const AUTHOR_SELECT = { id: true, name: true, handle: true, avatarUrl: true }

async function getTrending<T extends { id: string; createdAt: Date }>(
  fetcher: () => Promise<T[]>,
  itemType: string,
) {
  const items = await fetcher()
  return items.map((item) => ({
    ...item,
    type: itemType,
    // `trendingScore` exists on every trending-bearing model but is not part of
    // the shared `T` constraint, so a single intentional cast is used here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    score: (item as any).trendingScore ?? 0,
  }))
}

const TRENDING_INCLUDE = {
  votes: { select: { userId: true, voteType: true } },
} as const

export const getTrendingArticles = async () =>
  getTrending(() =>
    prisma.article.findMany({
      where: { published: true, isDeleted: false },
      include: { author: { select: AUTHOR_SELECT }, ...TRENDING_INCLUDE },
      orderBy: { trendingScore: 'desc' },
      take: 20,
    }),
    'article',
  )
export const getTrendingVacancies = async () =>
  getTrending(() =>
    prisma.jobVacancy.findMany({
      where: { isDeleted: false },
      include: { author: { select: AUTHOR_SELECT }, ...TRENDING_INCLUDE },
      orderBy: { trendingScore: 'desc' },
      take: 20,
    }),
    'vacancy',
  )

export const getTrendingAdmissions = async () =>
  getTrending(() =>
    prisma.phdAdmission.findMany({
      where: { isDeleted: false },
      include: { author: { select: AUTHOR_SELECT }, ...TRENDING_INCLUDE },
      orderBy: { trendingScore: 'desc' },
      take: 20,
    }),
    'admission',
  )

export const getTrendingEvents = async () =>
  getTrending(() =>
    prisma.researchEvent.findMany({
      where: { isDeleted: false },
      include: { author: { select: AUTHOR_SELECT }, ...TRENDING_INCLUDE },
      orderBy: { trendingScore: 'desc' },
      take: 20,
    }),
    'event',
  )

export const getTrendingSocialPosts = async () =>
  getTrending(() =>
    prisma.socialPost.findMany({
      where: { isDeleted: false },
      include: { author: { select: AUTHOR_SELECT }, ...TRENDING_INCLUDE },
      orderBy: { trendingScore: 'desc' },
      take: 20,
    }),
    'social-post',
  )
export const getTrendingJournals = async () =>
  getTrending(() =>
    prisma.journal.findMany({
      where: { isDeleted: false },
      include: { author: { select: AUTHOR_SELECT }, ...TRENDING_INCLUDE },
      orderBy: { trendingScore: 'desc' },
      take: 20,
    }),
    'journal',
  )

export const getTrendingResearchTools = async () =>
  getTrending(() =>
    prisma.researchTool.findMany({
      where: { isDeleted: false },
      include: { author: { select: AUTHOR_SELECT }, ...TRENDING_INCLUDE },
      orderBy: { trendingScore: 'desc' },
      take: 20,
    }),
    'researchTool',
  )

export const getTrendingHelpPosts = async () =>
  getTrending(() =>
    prisma.helpPost.findMany({
      where: { isDeleted: false },
      include: { author: { select: AUTHOR_SELECT }, ...TRENDING_INCLUDE },
      orderBy: { trendingScore: 'desc' },
      take: 20,
    }),
    'help-post',
  )

export const getTrendingResults = async () =>
  getTrending(() =>
    prisma.result.findMany({
      where: { isDeleted: false },
      include: { author: { select: AUTHOR_SELECT }, ...TRENDING_INCLUDE },
      orderBy: { trendingScore: 'desc' },
      take: 20,
    }),
    'result',
  )

export const getTrendingPublications = async () =>
  getTrending(() =>
    prisma.publication.findMany({
      where: { isDeleted: false },
      include: { author: { select: AUTHOR_SELECT }, ...TRENDING_INCLUDE },
      orderBy: { trendingScore: 'desc' },
      take: 20,
    }),
    'publication',
  )

export const getTrendingContributions = async () =>
  getTrending(() =>
    prisma.contribution.findMany({
      where: { isDeleted: false, status: 'APPROVED' },
      include: { author: { select: AUTHOR_SELECT }, ...TRENDING_INCLUDE },
      orderBy: { trendingScore: 'desc' },
      take: 20,
    }),
    'contribution',
  )

export const getTrendingSurveys = async () =>
  getTrending(() =>
    prisma.researchSurvey.findMany({
      where: { isDeleted: false },
      include: { author: { select: AUTHOR_SELECT }, ...TRENDING_INCLUDE },
      orderBy: { trendingScore: 'desc' },
      take: 20,
    }),
    'survey',
  )

export const getTrendingGrants = async () =>
  getTrending(() =>
    prisma.researchGrant.findMany({
      where: { isDeleted: false },
      include: { author: { select: AUTHOR_SELECT }, ...TRENDING_INCLUDE },
      orderBy: { trendingScore: 'desc' },
      take: 20,
    }),
    'grant',
  )

export const getTrendingCourses = async () =>
  getTrending(() =>
    prisma.course.findMany({
      where: { isDeleted: false },
      include: { author: { select: AUTHOR_SELECT }, ...TRENDING_INCLUDE },
      orderBy: { trendingScore: 'desc' },
      take: 20,
    }),
    'course',
  )

export async function getTrendingSupervisors() {
  const supervisors = await prisma.supervisor.findMany({
    where: { isDeleted: false },
    include: {
      author: { select: AUTHOR_SELECT },
      ...TRENDING_INCLUDE,
    },
    orderBy: { trendingScore: 'desc' },
    take: 20,
  })

  return supervisors.map((supervisor) => ({
    ...supervisor,
    type: 'supervisor',
    score: supervisor.trendingScore,
  }))
}

export async function getTrendingScholars(userId?: string) {
  const scholars = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      handle: true,
      avatarUrl: true,
      bio: true,
      reputation: true,
      followersCount: true,
      followingCount: true,
      followers: userId
        ? { where: { followerId: userId }, select: { followerId: true } }
        : false,
    },
    orderBy: { reputation: 'desc' },
    take: 20,
  })

  return scholars.map((scholar) => ({
    ...scholar,
    type: 'scholar' as const,
    score: scholar.reputation,
  }))
}
