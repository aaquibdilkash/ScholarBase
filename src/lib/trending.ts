import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

/**
 * ZERO-COMPUTE TRENDING
 * ---------------------
 * Trending items are ranked by the pre-computed `trendingScore` column that a
 * background cron job refreshes (see src/app/api/cron/trending). Reads never
 * compute scores on the fly and never run relational `_count` aggregations —
 * the materialized `totalVotes`/`totalComments` columns are returned directly.
 */

const AUTHOR_SELECT = { id: true, name: true, handle: true, avatarUrl: true, institutionVerifiedAt: true }

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

/**
 * Viewer-scoped relations for trending rows.
 *
 * This MUST be filtered to the current viewer. Two reasons:
 *
 *  1. Privacy: an unfiltered `votes: { select: { userId: true } }` returns
 *     every voter's identity for every trending post, to anonymous visitors.
 *  2. Correctness: the cards read `votes[0].voteType` to decide the button
 *     state. With an unfiltered array, `votes[0]` is whichever account voted
 *     first, so an anonymous visitor could be shown a vote they never cast.
 *
 * Trending is a `take: 10` list rendered on nearly every index page, so the
 * viewer is resolved once per call. `getCurrentUser` verifies the JWT locally
 * (no GoTrue round trip), so this is cheap.
 */
const trendingInclude = (viewerId: string | null) =>
  ({
    votes: {
      where: { userId: viewerId ?? "__anonymous__" },
      select: { voteType: true },
    },
    bookmarks: {
      where: { userId: viewerId ?? "__anonymous__" },
      select: { id: true },
    },
  }) as const

export const getTrendingArticles = async () => {
  const user = await getCurrentUser()
  const include = trendingInclude(user?.id ?? null)
  return getTrending(() =>
    prisma.article.findMany({
      where: { published: true, isDeleted: false },
      include: { author: { select: AUTHOR_SELECT }, ...include },
      orderBy: { trendingScore: 'desc' },
      take: 10,
    }),
    'article',
  )
}
export const getTrendingVacancies = async () => {
  const user = await getCurrentUser()
  const include = trendingInclude(user?.id ?? null)
  return getTrending(() =>
    prisma.jobVacancy.findMany({
      where: { isDeleted: false },
      include: { author: { select: AUTHOR_SELECT }, ...include },
      orderBy: { trendingScore: 'desc' },
      take: 10,
    }),
    'vacancy',
  )
}

export const getTrendingAdmissions = async () => {
  const user = await getCurrentUser()
  const include = trendingInclude(user?.id ?? null)
  return getTrending(() =>
    prisma.phdAdmission.findMany({
      where: { isDeleted: false },
      include: { author: { select: AUTHOR_SELECT }, ...include },
      orderBy: { trendingScore: 'desc' },
      take: 10,
    }),
    'admission',
  )
}

export const getTrendingEvents = async () => {
  const user = await getCurrentUser()
  const include = trendingInclude(user?.id ?? null)
  return getTrending(() =>
    prisma.researchEvent.findMany({
      where: { isDeleted: false },
      include: { author: { select: AUTHOR_SELECT }, ...include },
      orderBy: { trendingScore: 'desc' },
      take: 10,
    }),
    'event',
  )
}

export const getTrendingSocialPosts = async () => {
  const user = await getCurrentUser()
  const include = trendingInclude(user?.id ?? null)
  return getTrending(() =>
    prisma.socialPost.findMany({
      where: { isDeleted: false },
      include: { author: { select: AUTHOR_SELECT }, ...include },
      orderBy: { trendingScore: 'desc' },
      take: 10,
    }),
    'social-post',
  )
}
export const getTrendingJournals = async () => {
  const user = await getCurrentUser()
  const include = trendingInclude(user?.id ?? null)
  return getTrending(() =>
    prisma.journal.findMany({
      where: { isDeleted: false },
      include: { author: { select: AUTHOR_SELECT }, ...include },
      orderBy: { trendingScore: 'desc' },
      take: 10,
    }),
    'journal',
  )
}

export const getTrendingResearchTools = async () => {
  const user = await getCurrentUser()
  const include = trendingInclude(user?.id ?? null)
  return getTrending(() =>
    prisma.researchTool.findMany({
      where: { isDeleted: false },
      include: { author: { select: AUTHOR_SELECT }, ...include },
      orderBy: { trendingScore: 'desc' },
      take: 10,
    }),
    'researchTool',
  )
}

export const getTrendingHelpPosts = async () => {
  const user = await getCurrentUser()
  const include = trendingInclude(user?.id ?? null)
  return getTrending(() =>
    prisma.helpPost.findMany({
      where: { isDeleted: false },
      include: { author: { select: AUTHOR_SELECT }, ...include },
      orderBy: { trendingScore: 'desc' },
      take: 10,
    }),
    'help-post',
  )
}

export const getTrendingResults = async () => {
  const user = await getCurrentUser()
  const include = trendingInclude(user?.id ?? null)
  return getTrending(() =>
    prisma.result.findMany({
      where: { isDeleted: false },
      include: { author: { select: AUTHOR_SELECT }, ...include },
      orderBy: { trendingScore: 'desc' },
      take: 10,
    }),
    'result',
  )
}

export const getTrendingPublications = async () => {
  const user = await getCurrentUser()
  const include = trendingInclude(user?.id ?? null)
  return getTrending(() =>
    prisma.publication.findMany({
      where: { isDeleted: false },
      include: { author: { select: AUTHOR_SELECT }, ...include },
      orderBy: { trendingScore: 'desc' },
      take: 10,
    }),
    'publication',
  )
}

export const getTrendingContributions = async () => {
  const user = await getCurrentUser()
  const include = trendingInclude(user?.id ?? null)
  return getTrending(() =>
    prisma.contribution.findMany({
      where: { isDeleted: false, status: 'APPROVED' },
      include: { author: { select: AUTHOR_SELECT }, ...include },
      orderBy: { trendingScore: 'desc' },
      take: 10,
    }),
    'contribution',
  )
}

export const getTrendingSurveys = async () => {
  const user = await getCurrentUser()
  const include = trendingInclude(user?.id ?? null)
  return getTrending(() =>
    prisma.researchSurvey.findMany({
      where: { isDeleted: false },
      include: { author: { select: AUTHOR_SELECT }, ...include },
      orderBy: { trendingScore: 'desc' },
      take: 10,
    }),
    'survey',
  )
}

export const getTrendingGrants = async () => {
  const user = await getCurrentUser()
  const include = trendingInclude(user?.id ?? null)
  return getTrending(() =>
    prisma.researchGrant.findMany({
      where: { isDeleted: false },
      include: { author: { select: AUTHOR_SELECT }, ...include },
      orderBy: { trendingScore: 'desc' },
      take: 10,
    }),
    'grant',
  )
}

export const getTrendingCourses = async () => {
  const user = await getCurrentUser()
  const include = trendingInclude(user?.id ?? null)
  return getTrending(() =>
    prisma.course.findMany({
      where: { isDeleted: false },
      include: { author: { select: AUTHOR_SELECT }, ...include },
      orderBy: { trendingScore: 'desc' },
      take: 10,
    }),
    'course',
  )
}

export async function getTrendingSupervisors() {
  const user = await getCurrentUser()
  const include = trendingInclude(user?.id ?? null)
  const supervisors = await prisma.supervisor.findMany({
    where: { isDeleted: false },
    include: { author: { select: AUTHOR_SELECT }, ...include },
    orderBy: { trendingScore: 'desc' },
    take: 10,
  })

  return supervisors.map((supervisor) => ({
    ...supervisor,
    type: 'supervisor',
    score: supervisor.trendingScore,
  }))
}

/**
 * Trending scholars.
 *
 * The viewer is resolved from the session, server-side. The `userId` parameter
 * this used to accept is gone: it was only ever fed a server-derived value, but
 * a viewer-scoped `followers` filter has no business being caller-supplied.
 */
export async function getTrendingScholars() {
  const user = await getCurrentUser()
  const userId = user?.id
  const scholars = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      handle: true,
      avatarUrl: true, institutionVerifiedAt: true,
      bio: true,
      reputation: true,
      trendingScore: true,
      followersCount: true,
      followingCount: true,
      followers: userId
        ? { where: { followerId: userId }, select: { followerId: true } }
        : false,
    },
    orderBy: { trendingScore: 'desc' },
    take: 10,
  })

  return scholars.map((scholar) => ({
    ...scholar,
    type: 'scholar' as const,
    score: scholar.trendingScore,
  }))
}
