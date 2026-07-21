'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { notifyUserById } from '@/lib/notifications'

export async function toggleLike(
    targetId: string,
    type: 'article' | 'post' | 'vacancy' | 'admission' | 'event' | 'supervisor' | 'recommendation' | 'help' | 'journal' | 'researchTool' | 'result'

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
                select: { authorId: true, title: true, slug: true },
            })

            if (article?.authorId) {
                await notifyUserById({
                    recipientId: article.authorId,
                    actorId: user.id,
                    type: 'article-liked',
                    targetType: 'article',
                    targetId: article.slug,
                    title: `${user.email?.split('@')[0] || 'Someone'} liked your article`,
                    body: article.title,
                })
            }
        }
        // Articles use slugs in the URL, so we clear the whole blog layout cache to be safe
        revalidatePath('/blog', 'layout')
    }

    else if (type === 'post') {
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
        revalidatePath('/feed')
        revalidatePath(`/feed/${targetId}`)
    }

    else if (type === 'vacancy') {
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
        revalidatePath('/vacancies')
        revalidatePath(`/vacancies/${targetId}`)
    }

    else if (type === 'admission') {
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
        revalidatePath('/admissions')
        revalidatePath(`/admissions/${targetId}`)
    }

    else if (type === 'supervisor') {
        const existing = await prisma.supervisorLike.findUnique({
            where: { supervisorId_userId: { supervisorId: targetId, userId: user.id } },
        })

        if (existing) {
            await prisma.supervisorLike.delete({ where: { id: existing.id } })
            isLiked = false
        } else {
            await prisma.supervisorLike.create({ data: { supervisorId: targetId, userId: user.id } })
            isLiked = true


        }
        revalidatePath('/supervisor')
        revalidatePath(`/supervisor/${targetId}`)
    }

    else if (type === 'recommendation') {
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
        revalidatePath('/recommendation')
        revalidatePath(`/recommendation/${targetId}`)
    }

    else if (type === 'event') {
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
        revalidatePath('/events')
        revalidatePath(`/events/${targetId}`)
    }

    else if (type === 'help') {
        const existing = await prisma.helpPostLike.findUnique({
            where: { helpPostId_userId: { helpPostId: targetId, userId: user.id } },
        })

        if (existing) {
            await prisma.helpPostLike.delete({ where: { id: existing.id } })
            isLiked = false
        } else {
            await prisma.helpPostLike.create({ data: { helpPostId: targetId, userId: user.id } })
            isLiked = true

            const helpPost = await prisma.helpPost.findUnique({
                where: { id: targetId },
                select: { authorId: true, title: true },
            })

            if (helpPost?.authorId) {
                await notifyUserById({
                    recipientId: helpPost.authorId,
                    actorId: user.id,
                    type: 'help-post-liked',
                    targetType: 'help',
                    targetId,
                    title: `${user.email?.split('@')[0] || 'Someone'} liked your help post`,
                    body: helpPost.title,
                })
            }
        }
        revalidatePath('/help')
        revalidatePath(`/help/${targetId}`)
    }

    else if (type === 'journal') {
        const existing = await prisma.journalLike.findUnique({
            where: { journalId_userId: { journalId: targetId, userId: user.id } },
        })

        if (existing) {
            await prisma.journalLike.delete({ where: { id: existing.id } })
            isLiked = false
        } else {
            await prisma.journalLike.create({ data: { journalId: targetId, userId: user.id } })
            isLiked = true

            const journal = await prisma.journal.findUnique({
                where: { id: targetId },
                select: { authorId: true, title: true },
            })

            if (journal?.authorId) {
                await notifyUserById({
                    recipientId: journal.authorId,
                    actorId: user.id,
                    type: 'journal-liked',
                    targetType: 'journal',
                    targetId,
                    title: `${user.email?.split('@')[0] || 'Someone'} liked your journal`,
                    body: journal.title,
                })
            }
        }
        revalidatePath('/journals')
        revalidatePath(`/journals/${targetId}`)
    }

    else if (type === 'researchTool') {
        const existing = await prisma.researchToolLike.findUnique({
            where: { researchToolId_userId: { researchToolId: targetId, userId: user.id } },
        })

        if (existing) {
            await prisma.researchToolLike.delete({ where: { id: existing.id } })
            isLiked = false
        } else {
            await prisma.researchToolLike.create({ data: { researchToolId: targetId, userId: user.id } })
            isLiked = true

            const researchTool = await prisma.researchTool.findUnique({
                where: { id: targetId },
                select: { authorId: true, name: true },
            })

            if (researchTool?.authorId) {
                await notifyUserById({
                    recipientId: researchTool.authorId,
                    actorId: user.id,
                    type: 'research-tool-liked',
                    targetType: 'researchTool',
                    targetId,
                    title: `${user.email?.split('@')[0] || 'Someone'} liked your research tool`,
                    body: researchTool.name,
                })
            }
        }
        revalidatePath('/research-tools')
        revalidatePath(`/research-tools/${targetId}`)
    }

    else if (type === 'result') {
        const existing = await prisma.resultLike.findUnique({
            where: { resultId_userId: { resultId: targetId, userId: user.id } },
        })

        if (existing) {
            await prisma.resultLike.delete({ where: { id: existing.id } })
            isLiked = false
        } else {
            await prisma.resultLike.create({ data: { resultId: targetId, userId: user.id } })
            isLiked = true

            const result = await prisma.result.findUnique({
                where: { id: targetId },
                select: { authorId: true, title: true },
            })

            if (result?.authorId) {
                await notifyUserById({
                    recipientId: result.authorId,
                    actorId: user.id,
                    type: 'result-liked',
                    targetType: 'result',
                    targetId,
                    title: `${user.email?.split('@')[0] || 'Someone'} liked your result posting`,
                    body: result.title,
                })
            }
        }
        revalidatePath('/results')
        revalidatePath(`/results/${targetId}`)
    }

    return isLiked
}