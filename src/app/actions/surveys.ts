'use server'

import prisma from '@/lib/db'
import { SurveyQuestionType } from '@prisma/client'
import type { SurveyQuestionInput } from '@/types/survey'
import { requireCurrentUser, isAuthorizedOrAdmin } from '@/lib/auth'
import { readFormValue, readOptionalFormValue } from '@/lib/form'
import { notifyFollowersOfActivity } from '@/lib/notifications'
import { countVotesForTarget, reverseReputationForContent, reverseContentCommentVoteReputation } from '@/app/actions/interactions'

export async function getSurveys(q?: string, userId?: string, limit = 20, cursor?: string) {
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
                where: { archivedAt: null },
                orderBy: { order: 'asc' },
                include: {
                    options: {
                        where: { archivedAt: null },
                        orderBy: { order: 'asc' },
                    },
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
                        orderBy: { createdAt: 'asc' },
                    },
                    _count: { select: { votes: true } },
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

    const questions = JSON.parse(questionsJson) as SurveyQuestionInput[]

    const survey = await prisma.researchSurvey.create({
        data: {
            title,
            description,
            privacy: privacy || 'HYBRID',
            shareData,
            authorId: user.id,
            questions: {
                create: questions.map((q) => ({
                    type: q.type as SurveyQuestionType,
                    title: q.title,
                    required: q.required,
                    order: q.order,
                    minValue: q.minValue,
                    maxValue: q.maxValue,
                    options: q.options?.length
                        ? { create: q.options.map(({ value, label, order }) => ({ value, label, order })) }
                        : undefined,
                })),
            },
        },
        include: {
            author: true,
            votes: true,
            questions: { include: { options: true } },
            _count: {
                select: { votes: true, comments: true, responses: true },
            },
        }
    })

    await notifyFollowersOfActivity({
        actorId: user.id,
        type: 'survey-published',
        targetType: 'survey',
        targetId: survey.id,
        title: `${user.email?.split('@')[0] || 'Someone'} created a new survey`,
        body: title,
    })

    return { success: true, data: survey }
}

export async function updateSurvey(formData: FormData, surveyId: string) {
    const user = await requireCurrentUser('Log in to edit this survey.')

    const survey = await prisma.researchSurvey.findUnique({
        where: { id: surveyId },
        select: { authorId: true },
    })
    if (!survey) {
        throw new Error('Survey not found.')
    }
    if (!await isAuthorizedOrAdmin(survey.authorId, user.id)) throw new Error('Not authorized to edit this survey.')

    const title = readFormValue(formData, 'title')
    const description = readOptionalFormValue(formData, 'description')
    const privacy = readFormValue(formData, 'privacy') as 'ANONYMOUS' | 'NON_ANONYMOUS' | 'HYBRID'
    const shareData = formData.get('shareData') === 'true'
    const questionsJson = readFormValue(formData, 'questions')

    if (!title) throw new Error('Title is required')

    const questions = questionsJson
        ? JSON.parse(questionsJson) as SurveyQuestionInput[]
        : []

    const submittedIds = questions.flatMap((question) => question.id ? [question.id] : [])
    if (new Set(submittedIds).size !== submittedIds.length) {
        throw new Error('Each survey question may only be submitted once.')
    }

    await prisma.$transaction(async (tx) => {
        const existingQuestions = await tx.surveyQuestion.findMany({
            where: { surveyId, archivedAt: null },
            include: {
                options: { where: { archivedAt: null } },
                _count: { select: { answers: true } },
            },
        })
        const existingById = new Map(existingQuestions.map((question) => [question.id, question]))

        for (const question of questions) {
            const existing = question.id ? existingById.get(question.id) : undefined

            if (question.id && !existing) {
                throw new Error('One of the survey questions is no longer available to edit.')
            }
            if (existing && existing.type !== question.type && existing._count.answers > 0) {
                throw new Error(`Cannot change the type of \"${existing.title}\" because it already has responses.`)
            }

            if (!existing) {
                await tx.surveyQuestion.create({
                    data: {
                        surveyId,
                        type: question.type as SurveyQuestionType,
                        title: question.title,
                        required: question.required,
                        order: question.order,
                        minValue: question.minValue,
                        maxValue: question.maxValue,
                        options: question.options?.length ? { create: question.options.map(({ value, label, order }) => ({ value, label, order })) } : undefined,
                    },
                })
                continue
            }

            await tx.surveyQuestion.update({
                where: { id: existing.id },
                data: {
                    type: question.type as SurveyQuestionType,
                    title: question.title,
                    required: question.required,
                    order: question.order,
                    minValue: question.minValue,
                    maxValue: question.maxValue,
                },
            })

            const submittedOptionIds = new Set(
                question.options?.flatMap((option) => option.id ? [option.id] : []) ?? [],
            )
            const existingOptionsById = new Map(existing.options.map((option) => [option.id, option]))

            for (const option of question.options ?? []) {
                const existingOption = option.id ? existingOptionsById.get(option.id) : undefined
                if (option.id && !existingOption) {
                    throw new Error(`An option in \"${existing.title}\" is no longer available to edit.`)
                }
                if (existingOption) {
                    await tx.surveyQuestionOption.update({
                        where: { id: existingOption.id },
                        data: { value: option.value, label: option.label, order: option.order },
                    })
                } else {
                    await tx.surveyQuestionOption.create({
                        data: { questionId: existing.id, value: option.value, label: option.label, order: option.order },
                    })
                }
            }

            const removedOptionIds = existing.options
                .filter((option) => !submittedOptionIds.has(option.id))
                .map((option) => option.id)
            if (removedOptionIds.length) {
                await tx.surveyQuestionOption.updateMany({
                    where: { id: { in: removedOptionIds } },
                    data: { archivedAt: new Date() },
                })
            }
        }

        const removedQuestions = existingQuestions.filter((question) => !submittedIds.includes(question.id))
        for (const question of removedQuestions) {
            if (question._count.answers > 0) {
                await tx.surveyQuestion.update({
                    where: { id: question.id },
                    data: { archivedAt: new Date(), options: { updateMany: { where: {}, data: { archivedAt: new Date() } } } },
                })
            } else {
                await tx.surveyQuestion.delete({ where: { id: question.id } })
            }
        }

        await tx.researchSurvey.update({
            where: { id: surveyId },
            data: { title, description, privacy: privacy || 'HYBRID', shareData },
        })
    })

    const updatedSurvey = await getSurvey(surveyId, user.id)

    return { success: true, data: updatedSurvey }
}

export async function deleteSurvey(surveyId: string) {
    const user = await requireCurrentUser('Log in to delete this survey.')

    const survey = await prisma.researchSurvey.findUnique({
        where: { id: surveyId },
        select: { authorId: true },
    })
    if (!survey) {
        throw new Error('Survey not found.')
    }
    if (!await isAuthorizedOrAdmin(survey.authorId, user.id)) throw new Error('Not authorized to delete this survey.')

    const voteCounts = await countVotesForTarget(prisma.surveyVote, 'surveyId', surveyId)
    await reverseReputationForContent(survey.authorId, voteCounts)
    await reverseContentCommentVoteReputation('survey', surveyId)

    await prisma.researchSurvey.delete({ where: { id: surveyId } })

    return { success: true, data: { deletedId: surveyId } }
}

export async function closeSurvey(surveyId: string) {
    const user = await requireCurrentUser('Log in to close this survey.')

    const survey = await prisma.researchSurvey.findUnique({
        where: { id: surveyId },
        select: { authorId: true },
    })
    if (!survey) {
        throw new Error('Survey not found.')
    }
    if (!await isAuthorizedOrAdmin(survey.authorId, user.id)) throw new Error('Not authorized.')

    const updatedSurvey = await prisma.researchSurvey.update({
        where: { id: surveyId },
        data: { status: 'CLOSED' },
        include: {
            author: true,
            votes: true,
            questions: { include: { options: true } },
            _count: {
                select: { votes: true, comments: true, responses: true },
            },
        }
    })
    return { success: true, data: updatedSurvey }
}

export async function reopenSurvey(surveyId: string) {
    const user = await requireCurrentUser('Log in to reopen this survey.')

    const survey = await prisma.researchSurvey.findUnique({
        where: { id: surveyId },
        select: { authorId: true },
    })
    if (!survey) {
        throw new Error('Survey not found.')
    }
    if (!await isAuthorizedOrAdmin(survey.authorId, user.id)) throw new Error('Not authorized.')

    const updatedSurvey = await prisma.researchSurvey.update({
        where: { id: surveyId },
        data: { status: 'OPEN' },
        include: {
            author: true,
            votes: true,
            questions: { include: { options: true } },
            _count: {
                select: { votes: true, comments: true, responses: true },
            },
        }
    })
    return { success: true, data: updatedSurvey }
}

export async function toggleShareData(surveyId: string) {
    const user = await requireCurrentUser('Log in to manage this survey.')

    const survey = await prisma.researchSurvey.findUnique({
        where: { id: surveyId },
        select: { authorId: true, shareData: true },
    })
    if (!survey) {
        throw new Error('Survey not found.')
    }
    if (!await isAuthorizedOrAdmin(survey.authorId, user.id)) throw new Error('Not authorized.')

    const updatedSurvey = await prisma.researchSurvey.update({
        where: { id: surveyId },
        data: { shareData: !survey.shareData },
        include: {
            author: true,
            votes: true,
            questions: { include: { options: true } },
            _count: {
                select: { votes: true, comments: true, responses: true },
            },
        }
    })

    return { success: true, data: updatedSurvey }
}

export async function submitSurveyResponse(formData: FormData, surveyId: string) {
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

    const activeQuestionCount = await prisma.surveyQuestion.count({
        where: {
            surveyId,
            archivedAt: null,
            id: { in: answers.map((answer) => answer.questionId) },
        },
    })
    if (activeQuestionCount !== new Set(answers.map((answer) => answer.questionId)).size) {
        return { error: 'This survey changed before your response was submitted. Please refresh and try again.' }
    }

    // Check if user already responded - if so, update existing response (upsert pattern)
    const existingResponse = await prisma.surveyResponse.findFirst({
        where: {
            surveyId,
            respondentId: user.id,
        },
    })

    if (existingResponse) {
        // Retain answers to archived questions as historical data, while
        // replacing responses to questions that remain active in the form.
        await prisma.surveyAnswer.deleteMany({
            where: {
                responseId: existingResponse.id,
                question: { archivedAt: null },
            },
        })
        const updatedResponse = await prisma.surveyResponse.update({
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
            include: { answers: true }
        })
        return { success: true, data: updatedResponse }
    }

    const newResponse = await prisma.surveyResponse.create({
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
        include: { answers: true }
    })

    // Award 5 reputation points for participating in a survey (first time only)
    await prisma.user.update({
        where: { id: user.id },
        data: { reputation: { increment: 5 } },
    })

    return { success: true, data: newResponse }
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
