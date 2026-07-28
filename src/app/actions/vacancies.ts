'use server'

import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { requireCurrentUser, isAuthorizedOrAdmin } from '@/lib/auth'
import { readFormValue } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { notifyFollowersOfActivity } from '@/lib/notifications'
import { countVotesForTarget, countCommentsForTarget, reverseReputationForContent } from '@/app/actions/interactions'

export async function getVacancies(q?: string, userId?: string) {
    const where = q
        ? {
            OR: [
                { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { institution: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
            ],
        }
        : {};

    return prisma.jobVacancy.findMany({
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

export async function getVacancyById(id: string) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    return prisma.jobVacancy.findUnique({
        where: { id: id },
        include: {
            author: {
                include: {
                    followers: user
                        ? {
                            where: { followerId: user.id },
                            select: { followerId: true },
                        }
                        : false,
                },
            },
            comments: {
                where: { parentId: null },
                include: {
                    author: true,
                    votes: user ? { where: { userId: user.id } } : false,
                    _count: { select: { votes: true } },
                    replies: {
                        include: {
                            author: true,
                            votes: user ? { where: { userId: user.id } } : false,
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

export async function createJobVacancy(formData: FormData) {
    const user = await requireCurrentUser('Please log in to submit details.')

    const title = readFormValue(formData, 'title')
    const institution = readFormValue(formData, 'institution')
    const deadline = new Date(readFormValue(formData, 'deadline'))
    const description = readFormValue(formData, 'description')
    const notificationLink = readFormValue(formData, 'notificationLink')
    const applyLink = readFormValue(formData, 'applyLink')

    if (!notificationLink || !applyLink) {
        throw new Error('Notification and Apply links are required.')
    }

    const vacancy = await prisma.jobVacancy.create({
        data: { title, institution, deadline, description, notificationLink, applyLink, authorId: user.id },
    })

    await notifyFollowersOfActivity({
        actorId: user.id,
        type: 'vacancy-published',
        targetType: 'vacancy',
        targetId: vacancy.id,
        title: `${user.email?.split('@')[0] || 'Someone'} posted a new academic vacancy`,
        body: `${title} at ${institution} - Apply by ${deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    })

    revalidatePath('/vacancies')
    return { success: true, redirect: '/vacancies' }
}

export async function updateJobVacancy(formData: FormData, vacancyId: string) {
    const user = await requireCurrentUser('Log in to edit this vacancy.')

    const title = readFormValue(formData, 'title')
    const institution = readFormValue(formData, 'institution')
    const deadline = new Date(readFormValue(formData, 'deadline'))
    const description = readFormValue(formData, 'description')
    const notificationLink = readFormValue(formData, 'notificationLink')
    const applyLink = readFormValue(formData, 'applyLink')

    if (!notificationLink || !applyLink) {
        throw new Error('Notification and Apply links are required.')
    }

    const vacancy = await prisma.jobVacancy.findUnique({
        where: { id: vacancyId },
        select: { authorId: true },
    })

    if (!vacancy) return
    if (!await isAuthorizedOrAdmin(vacancy.authorId, user.id)) {
        throw new Error('Not authorized to edit this vacancy.')
    }

    await prisma.jobVacancy.update({
        where: { id: vacancyId },
        data: { title, institution, deadline, description, notificationLink, applyLink },
    })

    revalidatePath('/vacancies')
    revalidatePath(`/vacancies/${vacancyId}`)
    redirect(`/vacancies/${vacancyId}`)
}

export async function deleteJobVacancy(vacancyId: string) {
    const user = await requireCurrentUser('Log in to delete this vacancy.')

    const vacancy = await prisma.jobVacancy.findUnique({
        where: { id: vacancyId },
        select: { authorId: true },
    })

    if (!vacancy) return
    if (!await isAuthorizedOrAdmin(vacancy.authorId, user.id)) {
        throw new Error('Not authorized to delete this vacancy.')
    }

    // Reverse reputation from votes and comments before deletion
    const voteCounts = await countVotesForTarget(prisma.jobVacancyVote, 'jobVacancyId', vacancyId);
    const commentCount = await countCommentsForTarget(prisma.jobVacancyComment, 'jobVacancyId', vacancyId);
    await reverseReputationForContent(vacancy.authorId, voteCounts, commentCount);

    await prisma.jobVacancy.delete({ where: { id: vacancyId } })

    revalidatePath('/vacancies')
    revalidatePath(`/vacancies/${vacancyId}`)
    redirect('/vacancies')
}

export async function getLatestVacancies(count: number, userId?: string) {
    return prisma.jobVacancy.findMany({
        where: {
            deadline: {
                gte: new Date(),
            },
        },
        take: count,
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
