'use server'

import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { requireCurrentUser, isAuthorizedOrAdmin } from '@/lib/auth'
import { readFormValue } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { notifyFollowersOfActivity } from '@/lib/notifications'
import { countVotesForTarget, reverseContentCommentVoteReputation, reverseReputationForContent } from '@/app/actions/interactions'

export async function createCourse(formData: FormData) {
  const user = await requireCurrentUser('Please log in to share a course.')

  const title = readFormValue(formData, 'title')
  const provider = readFormValue(formData, 'provider')
  const instructor = readFormValue(formData, 'instructor')
  const format = readFormValue(formData, 'format')
  const level = readFormValue(formData, 'level')
  const price = readFormValue(formData, 'price')
  const duration = readFormValue(formData, 'duration')
  const link = readFormValue(formData, 'link')
  const description = readFormValue(formData, 'description')

  const course = await prisma.course.create({
    data: {
      title,
      provider: provider || null,
      instructor: instructor || null,
      format: format || null,
      level: level || null,
      price: price || null,
      duration: duration || null,
      link,
      description,
      authorId: user.id,
    },
  })

  await notifyFollowersOfActivity({
    actorId: user.id,
    type: 'course-published',
    targetType: 'course',
    targetId: course.id,
    title: `${user.email?.split('@')[0] || 'Someone'} shared a research course`,
    body: provider ? `${title} - ${provider}` : title,
  })

  revalidatePath('/learn')
  return { success: true, redirect: '/learn' }
}

export async function updateCourse(formData: FormData, courseId: string) {
  const user = await requireCurrentUser('Log in to edit this course.')

  const title = readFormValue(formData, 'title')
  const provider = readFormValue(formData, 'provider')
  const instructor = readFormValue(formData, 'instructor')
  const format = readFormValue(formData, 'format')
  const level = readFormValue(formData, 'level')
  const price = readFormValue(formData, 'price')
  const duration = readFormValue(formData, 'duration')
  const link = readFormValue(formData, 'link')
  const description = readFormValue(formData, 'description')

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { authorId: true },
  })

  if (!course) return
  if (!await isAuthorizedOrAdmin(course.authorId, user.id)) {
    throw new Error('Not authorized to edit this course.')
  }

  await prisma.course.update({
    where: { id: courseId },
    data: {
      title,
      provider: provider || null,
      instructor: instructor || null,
      format: format || null,
      level: level || null,
      price: price || null,
      duration: duration || null,
      link,
      description,
    },
  })

  revalidatePath('/learn')
  revalidatePath(`/learn/${courseId}`)
  return { success: true, redirect: `/learn/${courseId}` }
}

export async function deleteCourse(courseId: string) {
  const user = await requireCurrentUser('Log in to delete this course.')

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { authorId: true },
  })

  if (!course) return
  if (!await isAuthorizedOrAdmin(course.authorId, user.id)) {
    throw new Error('Not authorized to delete this course.')
  }

  const voteCounts = await countVotesForTarget(prisma.courseVote, 'courseId', courseId)
  await reverseReputationForContent(course.authorId, voteCounts)
  await reverseContentCommentVoteReputation('course', courseId)

  await prisma.course.delete({ where: { id: courseId } })

  revalidatePath('/learn')
  revalidatePath(`/learn/${courseId}`)
  redirect('/learn')
}

export async function getCourses(q?: string, userId?: string) {
  const where = q
    ? {
        OR: [
          { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { provider: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { instructor: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { format: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { level: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
        ],
      }
    : {}

  return prisma.course.findMany({
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

export async function getCourseById(courseId: string, userId?: string) {
  return prisma.course.findUniqueOrThrow({
    where: { id: courseId },
    include: {
      author: {
        include: {
          followers: userId
            ? { where: { followerId: userId }, select: { followerId: true } }
            : false,
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
      votes: { select: { userId: true, voteType: true } },
      _count: { select: { votes: true, comments: true } },
    },
  })
}
