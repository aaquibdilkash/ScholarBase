'use server'

import { Prisma, PublicationType } from '@prisma/client'
import prisma from '@/lib/db'
import { requireCurrentUser, isAuthorizedOrAdmin } from '@/lib/auth'
import { readFormValue, readOptionalFormValue } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { notifyFollowersOfActivity } from '@/lib/notifications'
import { countVotesForTarget, countCommentsForTarget, reverseReputationForContent } from '@/app/actions/interactions'

export async function createPublication(formData: FormData) {
    const user = await requireCurrentUser('Please log in to submit a publication.')

    const title = readFormValue(formData, 'title')
    const authors = readFormValue(formData, 'authors')
    const publicationType = readFormValue(formData, 'publicationType') as PublicationType
    const journalOrConference = readOptionalFormValue(formData, 'journalOrConference')
    const publisher = readOptionalFormValue(formData, 'publisher')
    const year = readOptionalFormValue(formData, 'year')
    const volume = readOptionalFormValue(formData, 'volume')
    const issue = readOptionalFormValue(formData, 'issue')
    const pages = readOptionalFormValue(formData, 'pages')
    const doi = readOptionalFormValue(formData, 'doi')
    const isbn = readOptionalFormValue(formData, 'isbn')
    const url = readOptionalFormValue(formData, 'url')
    const keywords = readOptionalFormValue(formData, 'keywords')
    const domain = readOptionalFormValue(formData, 'domain')
    const abstract = readOptionalFormValue(formData, 'abstract')
    const isUserAuthor = readOptionalFormValue(formData, 'isUserAuthor') === 'on'

    const publication = await prisma.publication.create({
        data: {
            title,
            authors,
            publicationType,
            journalOrConference,
            publisher,
            year: year ? parseInt(year) : null,
            volume,
            issue,
            pages,
            doi,
            isbn,
            url,
            keywords,
            domain,
            abstract,
            isUserAuthor,
            authorId: user.id,
        },
    })

    await notifyFollowersOfActivity({
        actorId: user.id,
        type: 'publication-published',
        targetType: 'publication',
        targetId: publication.id,
        title: `${user.email?.split('@')[0] || 'Someone'} published a new paper`,
        body: `${title}${journalOrConference ? ` (${journalOrConference})` : ''}`,
    })

    revalidatePath('/publications')
    return { success: true, redirect: '/publications' }
}

export async function updatePublication(formData: FormData, publicationId: string) {
    const user = await requireCurrentUser('Log in to edit this publication.')

    const title = readFormValue(formData, 'title')
    const authors = readFormValue(formData, 'authors')
    const publicationType = readFormValue(formData, 'publicationType') as PublicationType
    const journalOrConference = readOptionalFormValue(formData, 'journalOrConference')
    const publisher = readOptionalFormValue(formData, 'publisher')
    const year = readOptionalFormValue(formData, 'year')
    const volume = readOptionalFormValue(formData, 'volume')
    const issue = readOptionalFormValue(formData, 'issue')
    const pages = readOptionalFormValue(formData, 'pages')
    const doi = readOptionalFormValue(formData, 'doi')
    const isbn = readOptionalFormValue(formData, 'isbn')
    const url = readOptionalFormValue(formData, 'url')
    const keywords = readOptionalFormValue(formData, 'keywords')
    const domain = readOptionalFormValue(formData, 'domain')
    const abstract = readOptionalFormValue(formData, 'abstract')
    const isUserAuthor = readOptionalFormValue(formData, 'isUserAuthor') === 'on'

    const publication = await prisma.publication.findUnique({
        where: { id: publicationId },
        select: { authorId: true },
    })

    if (!publication) return
    if (!await isAuthorizedOrAdmin(publication.authorId, user.id)) {
        throw new Error('Not authorized to edit this publication.')
    }

    await prisma.publication.update({
        where: { id: publicationId },
        data: {
            title,
            authors,
            publicationType,
            journalOrConference,
            publisher,
            year: year ? parseInt(year) : null,
            volume,
            issue,
            pages,
            doi,
            isbn,
            url,
            keywords,
            domain,
            abstract,
            isUserAuthor,
        },
    })

    revalidatePath('/publications')
    revalidatePath(`/publications/${publicationId}`)
    return { success: true, redirect: `/publications/${publicationId}` }
}

export async function deletePublication(publicationId: string) {
    const user = await requireCurrentUser('Log in to delete this publication.')

    const publication = await prisma.publication.findUnique({
        where: { id: publicationId },
        select: { authorId: true },
    })

    if (!publication) return
    if (!await isAuthorizedOrAdmin(publication.authorId, user.id)) {
        throw new Error('Not authorized to delete this publication.')
    }

    // Reverse reputation from votes and comments before deletion
    const voteCounts = await countVotesForTarget(prisma.publicationVote, 'publicationId', publicationId);
    const commentCount = await countCommentsForTarget(prisma.publicationComment, 'publicationId', publicationId);
    await reverseReputationForContent(publication.authorId, voteCounts, commentCount);

    await prisma.publication.delete({ where: { id: publicationId } })

    revalidatePath('/publications')
    revalidatePath(`/publications/${publicationId}`)
    return { redirect: '/publications' }
}

export async function getPublications(q?: string, userId?: string) {
    const where = q
        ? {
            OR: [
                { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { authors: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { keywords: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { domain: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { journalOrConference: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { abstract: { contains: q, mode: Prisma.QueryMode.insensitive } },
            ],
        }
        : {};

    return prisma.publication.findMany({
        where,
        orderBy: {
            createdAt: 'desc',
        },
        include: {
            author: {
                include: {
                    followers: userId
                        ? {
                            where: { followerId: userId },
                            select: { followerId: true },
                        }
                        : false,
                },
            },
            votes: {
                select: { userId: true, voteType: true },
            },
            _count: {
                select: {
                    votes: true,
                    comments: true,
                },
            },
        },
    });
}

export async function getPublicationById(publicationId: string, userId?: string) {
    return prisma.publication.findUniqueOrThrow({
        where: {
            id: publicationId,
        },
        include: {
            author: {
                include: {
                    followers: userId
                        ? {
                            where: { followerId: userId },
                            select: { followerId: true },
                        }
                        : false,
                },
            },
            comments: {
                where: { parentId: null },
                include: {
                    author: true,
                    votes: userId ? { where: { userId: userId } } : false,
                    _count: { select: { votes: true } },
                    replies: {
                        include: {
                            author: true,
                            votes: userId ? { where: { userId: userId } } : false,
                            _count: { select: { votes: true } },
                        },
                        orderBy: { createdAt: "asc" },
                    },
                },
                orderBy: { createdAt: "desc" },
            },
            votes: {
                select: { userId: true, voteType: true },
            },
            _count: {
                select: {
                    votes: true,
                    comments: true,
                },
            },
        },
    });
}

