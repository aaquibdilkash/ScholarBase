'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { notifyUserById } from '@/lib/notifications'

export async function toggleLike(
    targetId: string,
    type: 'article' | 'post' | 'vacancy' | 'admission' | 'event' | 'supervisor' | 'recommendation'
): Promise<boolean> {
    const user = await requireCurrentUser('Log in to show appreciation for this research.')

    let isLiked = false

    if (type === 'article') {
        const existing = await prisma.articleLike.findUnique({
            where: { articleId_userId: { articleId: targetId, userId: user.id } },
        })

        if (existing) {
            await prisma.articleLike.delete({ where: { id: existing.id } })
            isLiked = false
        } else {
            await prisma.articleLike.create({ data: { articleId: targetId, userId: user.id } })
            isLiked = true

            const article = await prisma.article.findUnique({
                where: { id: targetId },
                select: { authorId: true, title: true },
            })

            if (article?.authorId) {
                await notifyUserById({
                    recipientId: article.authorId,
                    actorId: user.id,
                    type: 'article-liked',
                    targetType: 'article',
                    targetId,
                    title: `${user.email?.split('@')[0] || 'Someone'} liked your article`,
                    body: article.title,
                })
            }
        }
    } else if (type === 'post') {
        const existing = await prisma.socialLike.findUnique({
            where: { socialPostId_userId: { socialPostId: targetId, userId: user.id } },
        })

        if (existing) {
            await prisma.socialLike.delete({ where: { id: existing.id } })
            isLiked = false
        } else {
            await prisma.socialLike.create({ data: { socialPostId: targetId, userId: user.id } })
            isLiked = true

            const post = await prisma.socialPost.findUnique({
                where: { id: targetId },
                select: { authorId: true, content: true },
            })

            if (post?.authorId) {
                await notifyUserById({
                    recipientId: post.authorId,
                    actorId: user.id,
                    type: 'post-liked',
                    targetType: 'post',
                    targetId,
                    title: `${user.email?.split('@')[0] || 'Someone'} liked your post`,
                    body: post.content.slice(0, 120),
                })
            }
        }
    } else if (type === 'vacancy') {
        const existing = await prisma.jobVacancyLike.findUnique({
            where: { jobVacancyId_userId: { jobVacancyId: targetId, userId: user.id } },
        })

        if (existing) {
            await prisma.jobVacancyLike.delete({ where: { id: existing.id } })
            isLiked = false
        } else {
            await prisma.jobVacancyLike.create({ data: { jobVacancyId: targetId, userId: user.id } })
            isLiked = true

            const vacancy = await prisma.jobVacancy.findUnique({
                where: { id: targetId },
                select: { authorId: true, title: true },
            })

            if (vacancy?.authorId) {
                await notifyUserById({
                    recipientId: vacancy.authorId,
                    actorId: user.id,
                    type: 'vacancy-liked',
                    targetType: 'vacancy',
                    targetId,
                    title: `${user.email?.split('@')[0] || 'Someone'} liked your vacancy posting`,
                    body: vacancy.title,
                })
            }
        }
    } else if (type === 'admission') {
        const existing = await prisma.phdAdmissionLike.findUnique({
            where: { phdAdmissionId_userId: { phdAdmissionId: targetId, userId: user.id } },
        })

        if (existing) {
            await prisma.phdAdmissionLike.delete({ where: { id: existing.id } })
            isLiked = false
        } else {
            await prisma.phdAdmissionLike.create({ data: { phdAdmissionId: targetId, userId: user.id } })
            isLiked = true
            const admission = await prisma.phdAdmission.findUnique({
                where: { id: targetId },
                select: { authorId: true, university: true, department: true },
            })

            if (admission?.authorId) {
                await notifyUserById({
                    recipientId: admission.authorId,
                    actorId: user.id,
                    type: 'admission-liked',
                    targetType: 'admission',
                    targetId,
                    title: `${user.email?.split('@')[0] || 'Someone'} liked your PhD admission posting`,
                    body: `${admission.university} - ${admission.department}`,
                })
            }
        }
    } else if (type === 'supervisor') {
        const existing = await prisma.supervisorLike.findUnique({
            where: { supervisorId_userId: { supervisorId: targetId, userId: user.id } },
        })

        if (existing) {
            await prisma.supervisorLike.delete({ where: { id: existing.id } })
            isLiked = false
        } else {
            await prisma.supervisorLike.create({ data: { supervisorId: targetId, userId: user.id } })
            isLiked = true

            const supervisor = await prisma.supervisor.findUnique({
                where: { id: targetId },
                select: { name: true },
            })

            // TODO: How to notify a supervisor? They don't have a userId
        }
    } else if (type === 'recommendation') {
        const existing = await prisma.recommendationLike.findUnique({
            where: { recommendationId_userId: { recommendationId: targetId, userId: user.id } },
        })

        if (existing) {
            await prisma.recommendationLike.delete({ where: { id: existing.id } })
            isLiked = false
        } else {
            await prisma.recommendationLike.create({ data: { recommendationId: targetId, userId: user.id } })
            isLiked = true

            const recommendation = await prisma.recommendation.findUnique({
                where: { id: targetId },
                select: { authorId: true, feedback: true },
            })

            if (recommendation?.authorId) {
                await notifyUserById({
                    recipientId: recommendation.authorId,
                    actorId: user.id,
                    type: 'recommendation-liked',
                    targetType: 'recommendation',
                    targetId,
                    title: `${user.email?.split('@')[0] || 'Someone'} liked your recommendation`,
                    body: recommendation.feedback.slice(0, 120),
                })
            }
        }
    } else if (type === 'event') {
        const existing = await prisma.researchEventLike.findUnique({
            where: { researchEventId_userId: { researchEventId: targetId, userId: user.id } },
        })


        if (existing) {
            await prisma.researchEventLike.delete({ where: { id: existing.id } })
            isLiked = false
        } else {
            await prisma.researchEventLike.create({ data: { researchEventId: targetId, userId: user.id } })
            isLiked = true
            const event = await prisma.researchEvent.findUnique({
                where: { id: targetId },
                select: { authorId: true, title: true },
            })

            if (event?.authorId) {
                await notifyUserById({
                    recipientId: event.authorId,
                    actorId: user.id,
                    type: 'event-liked',
                    targetType: 'event',
                    targetId,
                    title: `${user.email?.split('@')[0] || 'Someone'} liked your event posting`,
                    body: event.title,
                })
            }
        }
    }

    revalidatePath('/blog')
    revalidatePath('/feed')
    revalidatePath('/vacancies')
    revalidatePath('/admissions')
    revalidatePath('/events')
    revalidatePath('/supervisor')
    revalidatePath('/recommendation')

    return isLiked
}


export async function addComment(
    targetId: string,
    type: 'vacancy' | 'admission' | 'event',
    content: string,
    parentId?: string
) {
    const user = await requireCurrentUser('You must be logged in to comment.')

    if (type === 'vacancy') {
        const vacancy = await prisma.jobVacancy.findUnique({
            where: { id: targetId },
            select: { authorId: true, title: true },
        })
        if (!vacancy) throw new Error('Vacancy not found')

        await prisma.jobVacancyComment.create({
            data: {
                jobVacancyId: targetId,
                authorId: user.id,
                content,
                parentId,
            },
        })

        if (vacancy.authorId) {
            await notifyUserById({
                recipientId: vacancy.authorId,
                actorId: user.id,
                type: 'vacancy-comment',
                targetType: 'vacancy',
                targetId,
                title: `${user.email?.split('@')[0] || 'Someone'} commented on your vacancy posting`,
                body: content,
            })
        }
    } else if (type === 'admission') {
        const admission = await prisma.phdAdmission.findUnique({
            where: { id: targetId },
            select: { authorId: true, university: true, department: true },
        })
        if (!admission) throw new Error('Admission not found')

        await prisma.phdAdmissionComment.create({
            data: {
                phdAdmissionId: targetId,
                authorId: user.id,
                content,
                parentId,
            },
        })

        if (admission.authorId) {
            await notifyUserById({
                recipientId: admission.authorId,
                actorId: user.id,
                type: 'admission-comment',
                targetType: 'admission',
                targetId,
                title: `${user.email?.split('@')[0] || 'Someone'} commented on your PhD admission posting`,
                body: content,
            })
        }
    } else if (type === 'event') {
        const event = await prisma.researchEvent.findUnique({
            where: { id: targetId },
            select: { authorId: true, title: true },
        })
        if (!event) throw new Error('Event not found')

        await prisma.researchEventComment.create({
            data: {
                researchEventId: targetId,
                authorId: user.id,
                content,
                parentId,
            },
        })

        if (event.authorId) {
            await notifyUserById({
                recipientId: event.authorId,
                actorId: user.id,
                type: 'event-comment',
                targetType: 'event',
                targetId,
                title: `${user.email?.split('@')[0] || 'Someone'} commented on your event posting`,
                body: content,
            })
        }
    }

    revalidatePath('/feed')
    revalidatePath('/vacancies')
    revalidatePath('/admissions')
    revalidatePath('/events')
}
