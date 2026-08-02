'use server'

import prisma from '@/lib/db'
import { requireCurrentUser, isAuthorizedOrAdmin } from '@/lib/auth'
import { readFormValue, readOptionalFormValue } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { notifyFollowersOfActivity } from '@/lib/notifications'

export async function getSurveys(q?: string, userId?: string) {
    const where = q
        ? {
            OR: [
                { title: { contains: q, mode: 'insensitive' as const } },
                { description: { contains: q, mode: 'insensitive' as const } },
            ],
        }
        : {};

    return prisma.researchSurvey.findMany({
        where,
        orderBy: { createdAt: 'desc' },
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
                select: { votes: true, comments: true, responses: true },
            },
        },
    });
}

export async function getSurvey(id: string, userId?: string) {
    return prisma.researchSurvey.findUnique({
        where: { id },
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
            questions: {
                orderBy: { order: 'asc' },
                include: {
                    options: {
                        orderBy: { order: 'asc' },
                    },
                },
            },
            comments: {
                where: { parentId: null },
                include: {
                    author: true,
                    votes: userId ? { where: { userId } } : false,
                    _count: { select: { votes: true } },
                    replies: {
                        include: {
                            author: true,
                            votes: userId ? { where: { userId } } : false,
                            _count: { select: { votes: true } },
                        },
                        orderBy: { createdAt: 'asc' },
                    },
                },
                orderBy: { createdAt: 'desc' },
            },
            votes: {
                select: { userId: true, voteType: true },
            },
            _count: {
                select: { votes: true, comments: true, responses: true },
            },
        },
    });
}

export async function getSurveyResponse(surveyId: string, userId: string) {
    return prisma.surveyResponse.findFirst({
        where: {
            surveyId,
            respondentId: userId,
        },
        include: {
            answers: true,
        },
    });
}

export async function createSurvey(formData: FormData) {
    const user = await requireCurrentUser('Please log in to create a survey.')

    const title = readFormValue(formData, 'title')
    const description = readOptionalFormValue(formData, 'description')
    const privacy = readFormValue(formData, 'privacy') as 'ANONYMOUS' | 'NON_ANONYMOUS' | 'HYBRID'
    const shareData = formData.get('shareData') === 'true'
    const questionsJson = readFormValue(formData, 'questions')

    if (!title) throw new Error('Title is required')
    if (!questionsJson) throw new Error('Questions are required')

    const questions = JSON.parse(questionsJson) as Array<{
        type: string
        title: string
        required: boolean
        order: number
        minValue?: number
        maxValue?: number
        options?: Array<{ value: string; label: string; order: number }>
    }>

    const survey = await prisma.researchSurvey.create({
        data: {
            title,
            description,
            privacy: privacy || 'HYBRID',
            shareData,
            authorId: user.id,
            questions: {
                create: questions.map((q) => ({
                    type: q.type as any,
                    title: q.title,
                    required: q.required,
                    order: q.order,
                    minValue: q.minValue,
                    maxValue: q.maxValue,
                    options: q.options?.length
                        ? { create: q.options }
                        : undefined,
                })),
            },
        },
    })

    await notifyFollowersOfActivity({
        actorId: user.id,
        type: 'survey-published',
        targetType: 'survey',
        targetId: survey.id,
        title: `${user.email?.split('@')[0] || 'Someone'} created a new survey`,
        body: title,
    })

    revalidatePath('/surveys')
    return { success: true, redirect: '/surveys' }
}

export async function updateSurvey(formData: FormData, surveyId: string) {
    const user = await requireCurrentUser('Log in to edit this survey.')

    const survey = await prisma.researchSurvey.findUnique({
        where: { id: surveyId },
        select: { authorId: true },
    })
    if (!survey) return
    if (!await isAuthorizedOrAdmin(survey.authorId, user.id)) throw new Error('Not authorized to edit this survey.')

    const title = readFormValue(formData, 'title')
    const description = readOptionalFormValue(formData, 'description')
    const privacy = readFormValue(formData, 'privacy') as 'ANONYMOUS' | 'NON_ANONYMOUS' | 'HYBRID'
    const shareData = formData.get('shareData') === 'true'
    const questionsJson = readFormValue(formData, 'questions')

    if (!title) throw new Error('Title is required')

    // Delete existing questions and recreate
    await prisma.surveyQuestionOption.deleteMany({
        where: { question: { surveyId } },
    })
    await prisma.surveyQuestion.deleteMany({ where: { surveyId } })

    const questions = questionsJson
        ? JSON.parse(questionsJson)
        : []

    await prisma.researchSurvey.update({
        where: { id: surveyId },
        data: {
            title,
            description,
            privacy: privacy || 'HYBRID',
            shareData,
            questions: {
                create: questions.map((q: any) => ({
                    type: q.type,
                    title: q.title,
                    required: q.required,
                    order: q.order,
                    minValue: q.minValue,
                    maxValue: q.maxValue,
                    options: q.options?.length
                        ? { create: q.options }
                        : undefined,
                })),
            },
        },
    })

    revalidatePath('/surveys')
    revalidatePath(`/surveys/${surveyId}`)
    redirect(`/surveys/${surveyId}`)
}

export async function deleteSurvey(surveyId: string) {
    const user = await requireCurrentUser('Log in to delete this survey.')

    const survey = await prisma.researchSurvey.findUnique({
        where: { id: surveyId },
        select: { authorId: true },
    })
    if (!survey) return
    if (!await isAuthorizedOrAdmin(survey.authorId, user.id)) throw new Error('Not authorized to delete this survey.')

    await prisma.researchSurvey.delete({ where: { id: surveyId } })

    revalidatePath('/surveys')
    revalidatePath(`/surveys/${surveyId}`)
    redirect('/surveys')
}

export async function closeSurvey(surveyId: string) {
    const user = await requireCurrentUser('Log in to close this survey.')

    const survey = await prisma.researchSurvey.findUnique({
        where: { id: surveyId },
        select: { authorId: true },
    })
    if (!survey) return
    if (!await isAuthorizedOrAdmin(survey.authorId, user.id)) throw new Error('Not authorized.')

    await prisma.researchSurvey.update({
        where: { id: surveyId },
        data: { status: 'CLOSED' },
    })

    revalidatePath(`/surveys/${surveyId}`)
}

export async function reopenSurvey(surveyId: string) {
    const user = await requireCurrentUser('Log in to reopen this survey.')

    const survey = await prisma.researchSurvey.findUnique({
        where: { id: surveyId },
        select: { authorId: true },
    })
    if (!survey) return
    if (!await isAuthorizedOrAdmin(survey.authorId, user.id)) throw new Error('Not authorized.')

    await prisma.researchSurvey.update({
        where: { id: surveyId },
        data: { status: 'OPEN' },
    })

    revalidatePath(`/surveys/${surveyId}`)
}

export async function toggleShareData(surveyId: string) {
    const user = await requireCurrentUser('Log in to manage this survey.')

    const survey = await prisma.researchSurvey.findUnique({
        where: { id: surveyId },
        select: { authorId: true, shareData: true },
    })
    if (!survey) return
    if (!await isAuthorizedOrAdmin(survey.authorId, user.id)) throw new Error('Not authorized.')

    await prisma.researchSurvey.update({
        where: { id: surveyId },
        data: { shareData: !survey.shareData },
    })

    revalidatePath(`/surveys/${surveyId}`)
    revalidatePath(`/surveys/${surveyId}/results`)
}

export async function submitSurveyResponse(formData: FormData, surveyId: string): Promise<{ success: boolean; message: string } | { error: string }> {
    let user;
    try {
        user = await requireCurrentUser('Log in to submit a survey response.')
    } catch {
        return { error: 'UNAUTHORIZED' }
    }

    const isAnonymous = formData.get('isAnonymous') === 'true'
    const answersJson = readFormValue(formData, 'answers')
    if (!answersJson) throw new Error('Answers are required')

    const answers = JSON.parse(answersJson) as Array<{
        questionId: string
        value: string
    }>

    // Check if user already responded - if so, update existing response (upsert pattern)
    const existingResponse = await prisma.surveyResponse.findFirst({
        where: {
            surveyId,
            respondentId: user.id,
        },
        include: { answers: { select: { id: true } } },
    })

    if (existingResponse) {
        // Delete old answers and create new ones
        await prisma.surveyAnswer.deleteMany({
            where: { responseId: existingResponse.id },
        })
        await prisma.surveyResponse.update({
            where: { id: existingResponse.id },
            data: {
                isAnonymous,
                answers: {
                    create: answers.map((a) => ({
                        questionId: a.questionId,
                        value: a.value,
                    })),
                },
            },
        })
        revalidatePath(`/surveys/${surveyId}`)
        return { success: true, message: 'Response updated successfully!' }
    }

    await prisma.surveyResponse.create({
        data: {
            surveyId,
            // Always link the response to the authenticated user so they can
            // retrieve and edit their own previous response later. Anonymity
            // is preserved via the isAnonymous flag (used in results/export).
            respondentId: user.id,
            isAnonymous,
            answers: {
                create: answers.map((a) => ({
                    questionId: a.questionId,
                    value: a.value,
                })),
            },
        },
    })

    // Award 5 reputation points for participating in a survey (first time only)
    await prisma.user.update({
        where: { id: user.id },
        data: { reputation: { increment: 5 } },
    })

    revalidatePath(`/surveys/${surveyId}`)
    return { success: true, message: 'Response submitted successfully!' }
}

export async function getSurveyResponses(surveyId: string, userId?: string) {
    const survey = await prisma.researchSurvey.findUnique({
        where: { id: surveyId },
        select: { authorId: true },
    })
    if (!survey) return null
    if (survey.authorId !== userId) return null

    return prisma.surveyResponse.findMany({
        where: { surveyId },
        include: {
            respondent: {
                select: { id: true, name: true, handle: true, avatarUrl: true },
            },
            answers: {
                include: {
                    question: {
                        select: { id: true, title: true, type: true },
                    },
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    })
}

export async function getSurveyResults(surveyId: string) {
    const survey = await prisma.researchSurvey.findUnique({
        where: { id: surveyId },
        include: {
            questions: {
                orderBy: { order: 'asc' },
                include: {
                    options: { orderBy: { order: 'asc' } },
                    answers: true,
                },
            },
            _count: { select: { responses: true } },
        },
    })
    return survey
}

export async function hasUserResponded(surveyId: string, userId: string) {
    // Check if user is the survey author - authors can always respond (preview)
    const survey = await prisma.researchSurvey.findUnique({
        where: { id: surveyId },
        select: { authorId: true },
    });
    if (survey?.authorId === userId) return false;

    const response = await prisma.surveyResponse.findFirst({
        where: {
            surveyId,
            respondentId: userId,
        },
    })
    return !!response
}
