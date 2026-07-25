import prisma from '@/lib/db'

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
    type: 'vacancy' | 'admission' | 'event' | 'article' | 'social-post' | 'journal' | 'researchTool' | 'help-post' | 'result' | 'contribution'
) {


    const items = await fetcher()

    const allItems = items.map(item => ({ ...item, type }))


    const scoredItems = allItems.map(item => {
        return {
            ...item,
            score: calculateTrendingScore(item),
        }
    })

    // Filter out items with a score of 0
    const filteredItems = scoredItems.filter(item => item.score > 0)

    // Sort by score, then by creation date
    const sortedItems = filteredItems.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score
        }
        return b.createdAt.getTime() - a.createdAt.getTime()
    })

    return sortedItems
}

export async function getTrendingArticles(userId?: string) {
    const since = new Date()
    since.setDate(since.getDate() - TRENDING_DAYS)

    const commonInclude = {
        author: true,
        _count: {
            select: {
                votes: true,
                comments: true,
            },
        },
        votes: userId ? { where: { userId } } : false,
    }

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
}

export async function getTrendingVacancies(userId?: string) {
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
}

export async function getTrendingAdmissions(userId?: string) {
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
}

export async function getTrendingEvents(userId?: string) {
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
}

export async function getTrendingSocialPosts(userId?: string) {
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
}


export async function getTrendingJournals(userId?: string) {
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
}

export async function getTrendingResearchTools(userId?: string) {
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
}

export async function getTrendingHelpPosts(userId?: string) {
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
}

export async function getTrendingResults(userId?: string) {
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
}

export async function getTrendingContributions(userId?: string) {
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
}

export async function getTrendingSupervisors(userId?: string) {
    const supervisors = await prisma.supervisor.findMany({

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

    const scoredSupervisors = supervisors.map((supervisor: any) => {
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
            supervisor.recommendations.reduce((sum: number, rec: any) => {
                return sum + rec.rating
            }, 0) / recommendationCount

        const score = avgRating * Math.log(recommendationCount + 1)

        return {
            ...supervisor,
            score,
            type: 'supervisor',
            votes,
        }
    })

    const filteredSupervisors = scoredSupervisors.filter((s: any) => s.score > 0)

    const sortedSupervisors = filteredSupervisors.sort((a: any, b: any) => b.score - a.score)

    return sortedSupervisors
}
