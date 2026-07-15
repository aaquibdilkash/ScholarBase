
import prisma from '@/lib/db'

const LIKE_WEIGHT = 1
const COMMENT_WEIGHT = 2
const TRENDING_DAYS = 7

// We can add more complexity to this later, e.g. time decay
function calculateTrendingScore(item: {
    _count: { likes: number; comments: number }
}) {
    return item._count.likes * LIKE_WEIGHT + item._count.comments * COMMENT_WEIGHT
}

async function getTrending<T extends { _count: { likes: number; comments: number }, likes?: { userId: string }[], createdAt: Date }>(
    fetcher: () => Promise<T[]>,
    type: 'vacancy' | 'admission' | 'event' | 'article' | 'social-post' | 'journal' | 'researchTool'
) {


    const items = await fetcher()

    const allItems = items.map(item => ({ ...item, type, isLiked: !!item.likes?.length }))


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
                likes: true,
                comments: true,
            },
        },
        likes: userId ? { where: { userId } } : false,
    }

    return getTrending(() => prisma.article.findMany({
        where: { createdAt: { gte: since }, published: true },
        include: commonInclude,
    }), 'article')
}

export async function getTrendingVacancies(userId?: string) {
    const since = new Date()
    since.setDate(since.getDate() - TRENDING_DAYS)

    const commonInclude = {
        author: true,
        _count: {
            select: {
                likes: true,
                comments: true,
            },
        },
        likes: userId ? { where: { userId } } : false,
    }

    return getTrending(() => prisma.jobVacancy.findMany({
        where: { createdAt: { gte: since } },
        include: commonInclude,
    }), 'vacancy')
}

export async function getTrendingAdmissions(userId?: string) {
    const since = new Date()
    since.setDate(since.getDate() - TRENDING_DAYS)

    const commonInclude = {
        author: true,
        _count: {
            select: {
                likes: true,
                comments: true,
            },
        },
        likes: userId ? { where: { userId } } : false,
    }

    return getTrending(() => prisma.phdAdmission.findMany({
        where: { createdAt: { gte: since } },
        include: commonInclude,
    }), 'admission')
}

export async function getTrendingEvents(userId?: string) {
    const since = new Date()
    since.setDate(since.getDate() - TRENDING_DAYS)

    const commonInclude = {
        author: true,
        _count: {
            select: {
                likes: true,
                comments: true,
            },
        },
        likes: userId ? { where: { userId } } : false,
    }

    return getTrending(() => prisma.researchEvent.findMany({
        where: { createdAt: { gte: since } },
        include: commonInclude,
    }), 'event')
}

export async function getTrendingSocialPosts(userId?: string) {
    const since = new Date()
    since.setDate(since.getDate() - TRENDING_DAYS)

    const commonInclude = {
        author: true,
        _count: {
            select: {
                likes: true,
                comments: true,
            },
        },
        likes: userId ? { where: { userId } } : false,
    }

    return getTrending(() => prisma.socialPost.findMany({
        where: { createdAt: { gte: since } },
        include: commonInclude,
    }), 'social-post')
}

export async function getTrendingJournals(userId?: string) {
    const since = new Date()
    since.setDate(since.getDate() - TRENDING_DAYS)

    const commonInclude = {
        author: true,
        _count: {
            select: {
                likes: true,
                comments: true,
            },
        },
        likes: userId ? { where: { userId } } : false,
    }

    return getTrending(() => prisma.journal.findMany({
        where: { createdAt: { gte: since } },
        include: commonInclude,
    }), 'journal')
}

export async function getTrendingResearchTools(userId?: string) {
    const since = new Date()
    since.setDate(since.getDate() - TRENDING_DAYS)

    const commonInclude = {
        author: true,
        _count: {
            select: {
                likes: true,
                comments: true,
            },
        },
        likes: userId ? { where: { userId } } : false,
    }

    return getTrending(() => prisma.researchTool.findMany({
        where: { createdAt: { gte: since } },
        include: commonInclude,
    }), 'researchTool')
}

export async function getTrendingSupervisors(userId?: string) {
    const supervisors = await prisma.supervisor.findMany({

        include: {
            // SupervisorCard needs recommendations to compute avg rating
            recommendations: true,
            likes: userId ? { where: { userId } } : undefined,
            _count: {
                select: {
                    likes: true,
                    comments: true,
                },
            },
        },
    })

    const scoredSupervisors = supervisors.map((supervisor) => {
        const likes = supervisor.likes ?? []
        const recommendationCount = supervisor.recommendations?.length ?? 0

        if (recommendationCount === 0) {
            return {
                ...supervisor,
                score: 0,
                type: 'supervisor',
                likes,
            }
        }

        const avgRating =
            supervisor.recommendations.reduce((sum, rec) => {
                return sum + rec.rating
            }, 0) / recommendationCount

        const score = avgRating * Math.log(recommendationCount + 1)

        return {
            ...supervisor,
            score,
            type: 'supervisor',
            likes,
        }
    })

    const filteredSupervisors = scoredSupervisors.filter((s) => s.score > 0)

    const sortedSupervisors = filteredSupervisors.sort((a, b) => b.score - a.score)

    return sortedSupervisors
}

