'use server'

import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { requireCurrentUser, isAuthorizedOrAdmin } from '@/lib/auth'
import { readFormValue } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { notifyFollowersOfActivity } from '@/lib/notifications'
import { countVotesForTarget, reverseContentCommentVoteReputation, reverseReputationForContent } from '@/app/actions/interactions'

export async function createResearchGrant(formData: FormData) {
  const user = await requireCurrentUser('Please log in to share a research grant.')

  const title = readFormValue(formData, 'title')
  const amount = readFormValue(formData, 'amount')
  const description = readFormValue(formData, 'description')
  const applyLink = readFormValue(formData, 'applyLink')
  const infoLink = readFormValue(formData, 'infoLink')

  const grant = await prisma.researchGrant.create({
    data: {
      title,
      amount: amount || null,
      description,
      applyLink: applyLink || null,
      infoLink: infoLink || null,
      authorId: user.id,
    },
  })

  await notifyFollowersOfActivity({
    actorId: user.id,
    type: 'research-grant-published',
    targetType: 'researchGrant',
    targetId: grant.id,
    title: `${user.email?.split('@')[0] || 'Someone'} shared a research grant`,
    body: amount ? `${title} - ${amount}` : title,
  })

  revalidatePath('/grants')
  return { success: true, redirect: '/grants' }
}

export async function updateResearchGrant(formData: FormData, grantId: string) {
  const user = await requireCurrentUser('Log in to edit this research grant.')

  const title = readFormValue(formData, 'title')
  const amount = readFormValue(formData, 'amount')
  const description = readFormValue(formData, 'description')
  const applyLink = readFormValue(formData, 'applyLink')
  const infoLink = readFormValue(formData, 'infoLink')

  const grant = await prisma.researchGrant.findUnique({
    where: { id: grantId },
    select: { authorId: true },
  })

  if (!grant) return
  if (!await isAuthorizedOrAdmin(grant.authorId, user.id)) {
    throw new Error('Not authorized to edit this research grant.')
  }

  await prisma.researchGrant.update({
    where: { id: grantId },
    data: {
      title,
      amount: amount || null,
      description,
      applyLink: applyLink || null,
      infoLink: infoLink || null,
    },
  })

  revalidatePath('/grants')
  revalidatePath(`/grants/${grantId}`)
  return { success: true, redirect: `/grants/${grantId}` }
}

export async function deleteResearchGrant(grantId: string) {
  const user = await requireCurrentUser('Log in to delete this research grant.')

  const grant = await prisma.researchGrant.findUnique({
    where: { id: grantId },
    select: { authorId: true },
  })

  if (!grant) return
  if (!await isAuthorizedOrAdmin(grant.authorId, user.id)) {
    throw new Error('Not authorized to delete this research grant.')
  }

  const voteCounts = await countVotesForTarget(prisma.researchGrantVote, 'researchGrantId', grantId)
  await reverseReputationForContent(grant.authorId, voteCounts)
  await reverseContentCommentVoteReputation('researchGrant', grantId)

  await prisma.researchGrant.delete({ where: { id: grantId } })

  revalidatePath('/grants')
  revalidatePath(`/grants/${grantId}`)
  redirect('/grants')
}

export async function getResearchGrants(q?: string, userId?: string) {
  const where = q
    ? {
        OR: [
          { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { amount: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { applyLink: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { infoLink: { contains: q, mode: Prisma.QueryMode.insensitive } },
        ],
      }
    : {}

  return prisma.researchGrant.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      author: {
        include: {
          followers: userId
            ? { where: { followerId: userId }, select: { followerId: true } }
            : false,
        },
      },
      votes: { select: { userId: true, voteType: true } },
      _count: { select: { votes: true, comments: true } },
    },
  })
}

export async function getResearchGrantById(grantId: string, userId?: string) {
  return prisma.researchGrant.findUniqueOrThrow({
    where: { id: grantId },
    select: {
      id: true,
      title: true,
      amount: true,
      description: true,
      applyLink: true,
      infoLink: true,
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
            ? { where: { followerId: userId }, select: { followerId: true } }
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
      votes: { select: { userId: true, voteType: true } },
      _count: { select: { votes: true, comments: true } },
    },
  });
}
