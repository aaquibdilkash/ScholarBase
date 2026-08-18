'use server'

import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { requireCurrentUser, isAuthorizedOrAdmin } from '@/lib/auth'
import { readFormValue, readOptionalFormValue } from '@/lib/form'
import { notifyFollowersOfActivity } from '@/lib/notifications'
import { countVotesForTarget, reverseReputationForContent, reverseContentCommentVoteReputation } from '@/app/actions/interactions'

export async function createJournal(formData: FormData) {
    const user = await requireCurrentUser('Please log in to submit details.')

    const title = readFormValue(formData, 'title')
    const issn = readOptionalFormValue(formData, 'issn')
    const impactFactor = readOptionalFormValue(formData, 'impactFactor')
    const scopus = readOptionalFormValue(formData, 'scopus')
    const abdcCategory = readOptionalFormValue(formData, 'abdcCategory')
    const publisher = readOptionalFormValue(formData, 'publisher')
    const website = readOptionalFormValue(formData, 'website')
    const about = readOptionalFormValue(formData, 'about')

    const journal = await prisma.journal.create({
        data: {
            title,
            issn,
            impactFactor: impactFactor ? parseFloat(impactFactor) : null,
            scopus,
            abdcCategory,
            publisher,
            website,
            about,
            authorId: user.id
        },
        include: {
            author: true,
            votes: true,
            _count: {
                select: { votes: true, comments: true },
            },
        }
    })

    await notifyFollowersOfActivity({
        actorId: user.id,
        type: 'journal-published',
        targetType: 'journal',
        targetId: journal.id,
        title: `${user.email?.split('@')[0] || 'Someone'} added a new journal`,
        body: `${title}${publisher ? ` by ${publisher}` : ''}`,
    })

    return { success: true, data: journal }
}

export async function updateJournal(formData: FormData, journalId: string) {
    const user = await requireCurrentUser('Log in to edit this journal.')

    const title = readFormValue(formData, 'title')
    const issn = readOptionalFormValue(formData, 'issn')
    const impactFactor = readOptionalFormValue(formData, 'impactFactor')
    const scopus = readOptionalFormValue(formData, 'scopus')
    const abdcCategory = readOptionalFormValue(formData, 'abdcCategory')
    const publisher = readOptionalFormValue(formData, 'publisher')
    const website = readOptionalFormValue(formData, 'website')
    const about = readOptionalFormValue(formData, 'about')

    const journal = await prisma.journal.findUnique({
        where: { id: journalId },
        select: { authorId: true },
    })

    if (!journal) {
        throw new Error('Journal not found.')
    }
    if (!await isAuthorizedOrAdmin(journal.authorId, user.id)) {
        throw new Error('Not authorized to edit this journal.')
    }

    const updatedJournal = await prisma.journal.update({
        where: { id: journalId },
        data: {
            title,
            issn,
            impactFactor: impactFactor ? parseFloat(impactFactor) : null,
            scopus,
            abdcCategory,
            publisher,
            website,
            about,
        },
        include: {
            author: true,
            votes: true,
            _count: {
                select: { votes: true, comments: true },
            },
        }
    })

    return { success: true, data: updatedJournal }
}

export async function deleteJournal(journalId: string) {
    const user = await requireCurrentUser('Log in to delete this journal.')

    const journal = await prisma.journal.findUnique({
        where: { id: journalId },
        select: { authorId: true },
    })

    if (!journal) {
        throw new Error('Journal not found.')
    }
    if (!await isAuthorizedOrAdmin(journal.authorId, user.id)) {
        throw new Error('Not authorized to delete this journal.')
    }

    // Reverse reputation from votes and comments before deletion
    const voteCounts = await countVotesForTarget(prisma.journalVote, 'journalId', journalId);
    await reverseReputationForContent(journal.authorId, voteCounts);
    await reverseContentCommentVoteReputation('journal', journalId);

    await prisma.journal.delete({ where: { id: journalId } })

    return { success: true, data: { deletedId: journalId } }
}

export async function getJournals(q?: string, userId?: string, limit = 20, cursor?: string) {
    const where = q
        ? {
            OR: [
                { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { publisher: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { about: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { issn: { contains: q, mode: Prisma.QueryMode.insensitive } },
            ],
        }
        : {};

    return prisma.journal.findMany({
        where,
        orderBy: {
            createdAt: 'desc',
        },
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
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

export async function getJournalById(journalId: string, userId?: string) {
    return prisma.journal.findUniqueOrThrow({
        where: {
            id: journalId,
        },
        select: {
            id: true,
            title: true,
            issn: true,
            impactFactor: true,
            scopus: true,
            abdcCategory: true,
            publisher: true,
            website: true,
            about: true,
            createdAt: true,
            updatedAt: true,
            authorId: true,
            author: {
                select: {
                    id: true,
                    name: true,
                    handle: true,
                    avatarUrl: true,
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
                select: {
                    id: true,
                    content: true,
                    createdAt: true,
                    updatedAt: true,
                    parentId: true,
                    author: {
                        select: {
                            id: true,
                            name: true,
                            handle: true,
                            avatarUrl: true,
                        },
                    },
                    votes: { select: { userId: true, voteType: true } },
                    mentions: true,
                    replies: {
                        select: {
                            id: true,
                            content: true,
                            createdAt: true,
                            updatedAt: true,
                            parentId: true,
                            author: {
                                select: {
                                    id: true,
                                    name: true,
                                    handle: true,
                                    avatarUrl: true,
                                },
                            },
                            votes: { select: { userId: true, voteType: true } },
                            mentions: true,
                            _count: { select: { votes: true } },
                        },
                        orderBy: { createdAt: "asc" },
                    },
                    _count: { select: { votes: true } },
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
