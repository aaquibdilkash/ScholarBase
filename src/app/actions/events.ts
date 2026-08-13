'use server'

import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { requireCurrentUser, isAuthorizedOrAdmin } from '@/lib/auth'
import { readFormValue, readOptionalFormValue } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { notifyFollowersOfActivity } from '@/lib/notifications'
import { countVotesForTarget, reverseReputationForContent, reverseContentCommentVoteReputation } from '@/app/actions/interactions'

export async function getEvents(q?: string, userId?: string) {
    const where = q
        ? {
            OR: [
                { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { location: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
            ],
        }
        : {};

    return prisma.researchEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
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
                select: { votes: true, comments: true },
            },
        },
    });
}

export async function getEvent(id: string, userId?: string) {
    return prisma.researchEvent.findUnique({
        where: { id: id },
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
                select: { votes: true, comments: true },
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

    const event = await prisma.researchEvent.create({
        data: { title, date, location, description, deadline, notificationLink, applyLink, authorId: user.id },
    })

    await notifyFollowersOfActivity({
        actorId: user.id,
        type: 'event-published',
        targetType: 'event',
        targetId: event.id,
        title: `${user.email?.split('@')[0] || 'Someone'} posted a new research event`,
        body: `"${title}" - ${new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
    })

    revalidatePath('/events')
    return { success: true, redirect: '/events' }
}

export async function createEventSafe(formData: FormData): Promise<{ success: boolean; redirect?: string; error?: string }> {
    try {
        return await createResearchEvent(formData)
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        return { success: false, error: error.message || 'Failed to create event' }
    }
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

    if (!event) return
    if (!await isAuthorizedOrAdmin(event.authorId, user.id)) {
        throw new Error('Not authorized to edit this event.')
    }

    await prisma.researchEvent.update({
        where: { id: eventId },
        data: { title, date, location, description, deadline, notificationLink, applyLink },
    })

    revalidatePath('/events')
    revalidatePath(`/events/${eventId}`)
    return { success: true, redirect: `/events/${eventId}` }
}

export async function deleteResearchEvent(eventId: string) {
    const user = await requireCurrentUser('Log in to delete this event.')

    const event = await prisma.researchEvent.findUnique({
        where: { id: eventId },
        select: { authorId: true },
    })

    if (!event) return
    if (!await isAuthorizedOrAdmin(event.authorId, user.id)) {
        throw new Error('Not authorized to delete this event.')
    }

    // Reverse reputation from votes and comments before deletion
    const voteCounts = await countVotesForTarget(prisma.researchEventVote, 'researchEventId', eventId);
    await reverseReputationForContent(event.authorId, voteCounts);
    await reverseContentCommentVoteReputation('event', eventId);

    await prisma.researchEvent.delete({ where: { id: eventId } })

    revalidatePath('/events')
    revalidatePath(`/events/${eventId}`)
    redirect('/events')
}

export async function getUpcomingEvents(count: number, userId?: string) {
    return prisma.researchEvent.findMany({
        where: {
            date: {
                gte: new Date(),
            },
        },
        take: count,
        orderBy: { date: "asc" },
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
                select: {
                    userId: true,
                    voteType: true,
                },
            },
            _count: {
                select: { votes: true, comments: true },
            },
        },
    });
}
