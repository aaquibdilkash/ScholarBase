'use server'

import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { requireCurrentUser, isAuthorizedOrAdmin } from '@/lib/auth'
import { readFormValue, readOptionalFormValue } from '@/lib/form'
import { notifyFollowersOfActivity } from '@/lib/notifications'

export async function getEvents(q?: string, userId?: string, limit = 20, cursor?: string) {
    const where: Prisma.ResearchEventWhereInput = {
        isDeleted: false,
        ...(q && {
            OR: [
                { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { location: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
            ],
        }),
    };

    return prisma.researchEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
            id: true,
            title: true,
            date: true,
            location: true,
            createdAt: true,
            authorId: true,
            author: {
                select: {
                    id: true,
                    name: true,
                    handle: true,
                    avatarUrl: true,
                    followers: userId
                        ? { where: { followerId: userId }, select: { followerId: true } }
                        : false,
                },
            },
            totalVotes: true,
            totalComments: true,
            votes: userId ? { where: { userId }, select: { voteType: true } } : false,
        },
    });
}

export async function getEvent(id: string, userId?: string) {
    return prisma.researchEvent.findUnique({
        where: { id: id, isDeleted: false },
        select: {
            id: true,
            title: true,
            date: true,
            location: true,
            description: true,
            deadline: true,
            notificationLink: true,
            applyLink: true,
            createdAt: true,
            authorId: true,
            author: {
                select: {
                    id: true,
                    name: true,
                    handle: true,
                    avatarUrl: true,
                    followers: userId
                        ? { where: { followerId: userId }, select: { followerId: true } }
                        : false,
                },
            },
            totalVotes: true,
            totalComments: true,
            votes: userId ? { where: { userId }, select: { voteType: true } } : false,
            comments: {
                where: { parentId: null },
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    content: true,
                    createdAt: true,
                    updatedAt: true,
                    parentId: true,
                    authorId: true,
                    author: {
                        select: {
                            id: true,
                            name: true,
                            handle: true,
                            avatarUrl: true,
                        },
                    },
                    totalVotes: true,
                    totalReplies: true,
                    votes: userId ? { where: { userId }, select: { voteType: true } } : false,
                    replies: {
                        orderBy: { createdAt: "asc" },
                        select: {
                            id: true,
                            content: true,
                            createdAt: true,
                            updatedAt: true,
                            parentId: true,
                            authorId: true,
                            author: {
                                select: {
                                    id: true,
                                    name: true,
                                    handle: true,
                                    avatarUrl: true,
                                },
                            },
                            totalVotes: true,
                            totalReplies: true,
                            votes: userId ? { where: { userId }, select: { voteType: true } } : false,
                        },
                    },
                },
            },
        },
    });
}

export async function createResearchEvent(formData: FormData) {
    const user = await requireCurrentUser('Please log in to submit details.')

    const title = readFormValue(formData, 'title')
    const date = new Date(readFormValue(formData, 'date'))
    const location = readFormValue(formData, 'location')
    const description = readFormValue(formData, 'description')
    const deadlineInput = readOptionalFormValue(formData, 'deadline')
    const deadline = deadlineInput ? new Date(deadlineInput) : null
    const notificationLink = readFormValue(formData, 'notificationLink')
    const applyLink = readFormValue(formData, 'applyLink')

    if (!notificationLink || !applyLink) {
        throw new Error('Notification and Apply links are required.')
    }

    const event = await prisma.$transaction(async (tx) => {
        const newEvent = await tx.researchEvent.create({
            data: { title, date, location, description, deadline, notificationLink, applyLink, authorId: user.id },
        });

        await tx.userActivity.create({
            data: {
                userId: user.id,
                action: 'PUBLISHED',
                 moduleType: 'RESEARCH_EVENT',
                entityId: newEvent.id,
                entityTitle: newEvent.title,
            }
        });

        return newEvent;
    });

    await notifyFollowersOfActivity({
        actorId: user.id,
        type: 'event-published',
        targetType: 'ResearchEvent',
        targetId: event.id,
        title: `${user.email?.split('@')[0] || 'Someone'} posted a new research event`,
        body: `"${title}" - ${new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
    })

    return { success: true, data: event }
}

export async function updateResearchEvent(formData: FormData, eventId: string) {
    const user = await requireCurrentUser('Log in to edit this event.')

    const title = readFormValue(formData, 'title')
    const date = new Date(readFormValue(formData, 'date'))
    const location = readFormValue(formData, 'location')
    const description = readFormValue(formData, 'description')
    const deadlineInput = readOptionalFormValue(formData, 'deadline')
    const deadline = deadlineInput ? new Date(deadlineInput) : null
    const notificationLink = readFormValue(formData, 'notificationLink')
    const applyLink = readFormValue(formData, 'applyLink')

    if (!notificationLink || !applyLink) {
        throw new Error('Notification and Apply links are required.')
    }

    const event = await prisma.researchEvent.findUnique({
        where: { id: eventId },
        select: { authorId: true },
    })

    if (!event) {
        throw new Error('Event not found.')
    }
    if (!await isAuthorizedOrAdmin(event.authorId, user.id)) {
        throw new Error('Not authorized to edit this event.')
    }

    const updatedEvent = await prisma.researchEvent.update({
        where: { id: eventId },
        data: { title, date, location, description, deadline, notificationLink, applyLink, editedAt: new Date() },
    })

    return { success: true, data: updatedEvent }
}

export async function deleteResearchEvent(eventId: string) {
    const user = await requireCurrentUser('Log in to delete this event.')

    const event = await prisma.researchEvent.findUnique({
        where: { id: eventId },
        select: { authorId: true, totalVotes: true },
    })

    if (!event) {
        throw new Error('Event not found.')
    }
    if (!await isAuthorizedOrAdmin(event.authorId, user.id)) {
        throw new Error('Not authorized to delete this event.')
    }

    await prisma.researchEvent.update({ where: { id: eventId }, data: { isDeleted: true } })

    if (event.totalVotes !== 0) {
        await prisma.user.update({
            where: { id: event.authorId },
            data: { reputation: { decrement: event.totalVotes } },
        })
    }

    return { success: true, data: { deletedId: eventId } }
}

export async function getUpcomingEvents(count: number, userId?: string) {
    return prisma.researchEvent.findMany({
        where: {
            date: {
                gte: new Date(),
            },
            isDeleted: false,
        },
        take: count,
        orderBy: { date: "asc" },
        select: {
            id: true,
            title: true,
            date: true,
            location: true,
            createdAt: true,
            author: {
                select: {
                    id: true,
                    name: true,
                    handle: true,
                    avatarUrl: true,
                    followers: userId
                        ? { where: { followerId: userId }, select: { followerId: true } }
                        : false,
                },
            },
            totalVotes: true,
            totalComments: true,
            votes: userId ? { where: { userId }, select: { voteType: true } } : false,
        },
    });
}
