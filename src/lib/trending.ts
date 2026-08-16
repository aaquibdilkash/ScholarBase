import prisma from '@/lib/db'
import type { SupervisorWithVotesAndRecommendations } from '@/types/trending'
import { unstable_cache } from 'next/cache'

const VOTE_WEIGHT = 1
const COMMENT_WEIGHT = 2
const TRENDING_DAYS = 7

// We can add more complexity to this later, e.g. time decay
function calculateTrendingScore(item: {
    _count: { votes: number; comments: number }
}) {
    return item._count.votes * VOTE_WEIGHT + item._count.comments * COMMENT_WEIGHT
}

async function getTrending<T extends { _count: { votes: number; comments: number }, votes?: { userId: string }[], createdAt: Date }>(
    fetcher: () => Promise<T[]>,
    itemType: 'vacancy' | 'admission' | 'event' | 'article' | 'social-post' | 'journal' | 'researchTool' | 'help-post' | 'result' | 'contribution' | 'publication' | 'survey'
) {
    const items = await fetcher()

    const scoredItems = items.map(item => ({
        ...item,
        type: itemType,
        score: calculateTrendingScore(item),
    }))

    // Include items with score >= 0 (score 0 items will be sorted by creation date)
    const filteredItems = scoredItems.filter(item => item.score >= 0)

    // Sort by score, then by creation date
    const sortedItems = filteredItems.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score
        }
        return b.createdAt.getTime() - a.createdAt.getTime()
    })

    return sortedItems
}

export const getTrendingArticles = unstable_cache(async function getTrendingArticles() {
    const since = new Date()
    since.setDate(since.getDate() - TRENDING_DAYS)

    return getTrending(() => prisma.article.findMany({
        where: { createdAt: { gte: since }, published: true },
        include: {
            author: true,
            _count: {
                select: {
                    votes: true,
                    comments: true,
                },
            },
            votes: { select: { userId: true, voteType: true } },
        },
    }), 'article')
}, ['trending-articles'], { revalidate: 300 })

export const getTrendingVacancies = unstable_cache(async function getTrendingVacancies() {
    const since = new Date()
    since.setDate(since.getDate() - TRENDING_DAYS)

    return getTrending(() => prisma.jobVacancy.findMany({
        where: { createdAt: { gte: since } },
        include: {
            author: true,
            _count: { select: { votes: true, comments: true } },
            votes: { select: { userId: true, voteType: true } },
        },
    }), 'vacancy')
}, ['trending-vacancies'], { revalidate: 300 })

export const getTrendingAdmissions = unstable_cache(async function getTrendingAdmissions() {
    const since = new Date()
    since.setDate(since.getDate() - TRENDING_DAYS)

    return getTrending(() => prisma.phdAdmission.findMany({
        where: { createdAt: { gte: since } },
        include: {
            author: true,
            _count: { select: { votes: true, comments: true } },
            votes: { select: { userId: true, voteType: true } },
        },
    }), 'admission')
}, ['trending-admissions'], { revalidate: 300 })

export const getTrendingEvents = unstable_cache(async function getTrendingEvents() {
    const since = new Date()
    since.setDate(since.getDate() - TRENDING_DAYS)

    return getTrending(() => prisma.researchEvent.findMany({
        where: { createdAt: { gte: since } },
        include: {
            author: true,
            _count: { select: { votes: true, comments: true } },
            votes: { select: { userId: true, voteType: true } },
        },
    }), 'event')
}, ['trending-events'], { revalidate: 300 })

export const getTrendingSocialPosts = unstable_cache(async function getTrendingSocialPosts() {
    const since = new Date()
    since.setDate(since.getDate() - TRENDING_DAYS)

    return getTrending(() => prisma.socialPost.findMany({
        where: { createdAt: { gte: since } },
        include: {
            author: true,
            _count: { select: { votes: true, comments: true } },
            votes: { select: { userId: true, voteType: true } },
        },
    }), 'social-post')
}, ['trending-social-posts'], { revalidate: 300 })


export const getTrendingJournals = unstable_cache(async function getTrendingJournals() {
    const since = new Date()
    since.setDate(since.getDate() - TRENDING_DAYS)

    return getTrending(() => prisma.journal.findMany({
        where: { createdAt: { gte: since } },
        include: {
            author: true,
            _count: { select: { votes: true, comments: true } },
            votes: { select: { userId: true, voteType: true } },
        },
    }), 'journal')
}, ['trending-journals'], { revalidate: 300 })

export const getTrendingResearchTools = unstable_cache(async function getTrendingResearchTools() {
    const since = new Date()
    since.setDate(since.getDate() - TRENDING_DAYS)

    return getTrending(() => prisma.researchTool.findMany({
        where: { createdAt: { gte: since } },
        include: {
            author: true,
            _count: { select: { votes: true, comments: true } },
            votes: { select: { userId: true, voteType: true } },
        },
    }), 'researchTool')
}, ['trending-research-tools'], { revalidate: 300 })

export const getTrendingHelpPosts = unstable_cache(async function getTrendingHelpPosts() {
    const since = new Date()
    since.setDate(since.getDate() - TRENDING_DAYS)

    return getTrending(() => prisma.helpPost.findMany({
        where: { createdAt: { gte: since } },
        include: {
            author: true,
            _count: { select: { votes: true, comments: true } },
            votes: { select: { userId: true, voteType: true } },
        },
    }), 'help-post')
}, ['trending-help-posts'], { revalidate: 300 })

export const getTrendingResults = unstable_cache(async function getTrendingResults() {
    const since = new Date()
    since.setDate(since.getDate() - TRENDING_DAYS)

    return getTrending(() => prisma.result.findMany({
        where: { createdAt: { gte: since } },
        include: {
            author: true,
            _count: { select: { votes: true, comments: true } },
            votes: { select: { userId: true, voteType: true } },
        },
    }), 'result')
}, ['trending-results'], { revalidate: 300 })

export const getTrendingPublications = unstable_cache(async function getTrendingPublications() {
    const since = new Date()
    since.setDate(since.getDate() - TRENDING_DAYS)

    return getTrending(() => prisma.publication.findMany({
        where: { createdAt: { gte: since } },
        include: {
            author: true,
            _count: { select: { votes: true, comments: true } },
            votes: { select: { userId: true, voteType: true } },
        },
    }), 'publication')
}, ['trending-publications'], { revalidate: 300 })

export const getTrendingContributions = unstable_cache(async function getTrendingContributions() {
    const since = new Date()
    since.setDate(since.getDate() - TRENDING_DAYS)

    return getTrending(() => prisma.contribution.findMany({
        where: { createdAt: { gte: since }, status: 'APPROVED' },
        include: {
            author: true,
            _count: { select: { votes: true, comments: true } },
            votes: { select: { userId: true, voteType: true } },
        },
    }), 'contribution')
}, ['trending-contributions'], { revalidate: 300 })

export const getTrendingSurveys = unstable_cache(async function getTrendingSurveys() {
    const since = new Date()
    since.setDate(since.getDate() - TRENDING_DAYS)

    return getTrending(() => prisma.researchSurvey.findMany({
        where: { createdAt: { gte: since } },
        include: {
            author: true,
            _count: { select: { votes: true, comments: true, responses: true } },
            votes: { select: { userId: true, voteType: true } },
        },
    }), 'survey')
}, ['trending-surveys'], { revalidate: 300 })

export async function getTrendingSupervisors() {
    const supervisors = await prisma.supervisor.findMany<{
        include: {
            author: true;
            recommendations: true;
            votes: { select: { userId: true; voteType: true } };
            _count: { select: { votes: true; comments: true } };
        };
    }>({
        include: {
            author: true,
            // SupervisorCard needs recommendations to compute avg rating
            recommendations: true,
            votes: { select: { userId: true, voteType: true } },
            _count: {
                select: {
                    votes: true,
                    comments: true,
                },
            },
        },
    })

    const scoredSupervisors = supervisors.map(
        (supervisor: SupervisorWithVotesAndRecommendations) => {
            const votes = supervisor.votes ?? []
            const recommendationCount = supervisor.recommendations?.length ?? 0

            if (recommendationCount === 0) {
                return {
                    ...supervisor,
                    score: 0,
                    type: 'supervisor',
                    votes,
                }
            }

            const avgRating =
                supervisor.recommendations.reduce((sum: number, rec) => {
                    return sum + rec.rating
                }, 0) / recommendationCount

            const score = avgRating * Math.log(recommendationCount + 1)

            return {
                ...supervisor,
                score,
                type: 'supervisor',
                votes,
            }
        },
    )

    const filteredSupervisors = scoredSupervisors.filter((s) => s.score > 0)

    const sortedSupervisors = filteredSupervisors.sort(
        (a, b) => b.score - a.score,
    )

    return sortedSupervisors
}

export async function getTrendingScholars(userId?: string) {
    const scholars = await prisma.user.findMany({
        include: {
            followers: userId ? { where: { followerId: userId } } : false,
            _count: {
                select: {
                    followers: true,
                    following: true,
                },
            },
        },
        orderBy: {
            reputation: 'desc',
        },
        take: 20,
    });

    return scholars.map(scholar => ({
        ...scholar,
        type: 'scholar',
        score: scholar.reputation,
    }));
}
