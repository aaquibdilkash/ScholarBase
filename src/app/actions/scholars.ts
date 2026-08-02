'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { readFormValue } from '@/lib/form'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getBaseUrl } from '@/lib/url'
import { sendScholarInviteEmail } from '@/lib/email'
import { Prisma } from '@prisma/client'

export async function getScholars(q?: string, sort: 'latest' | 'reputation' = 'latest', currentUserId?: string) {
  const orderBy: Prisma.UserOrderByWithRelationInput[] =
    sort === 'reputation'
      ? [{ reputation: 'desc' }, { createdAt: 'desc' }]
      : [{ createdAt: 'desc' }]

  return prisma.user.findMany({
    where: q
      ? {
        OR: [
          { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { handle: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { bio: { contains: q, mode: Prisma.QueryMode.insensitive } },
        ],
      }
      : undefined,
    select: {
      id: true,
      name: true,
      handle: true,
      avatarUrl: true,
      bio: true,
      reputation: true,
      createdAt: true,
      followers: currentUserId
        ? {
          where: { followerId: currentUserId },
          select: { followerId: true },
        }
        : false,
      _count: {
        select: { followers: true, following: true },
      },
    },
    orderBy,
    take: 48,
  })
}

export async function getScholarById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      handle: true,
      avatarUrl: true,
      bio: true,
      reputation: true,
      createdAt: true,
      followers: { select: { followerId: true } },
      _count: {
        select: { followers: true, following: true },
      },
    },
  })
}

export async function inviteScholar(formData: FormData) {
  const user = await requireCurrentUser('Please log in to invite a scholar.')

  const email = readFormValue(formData, 'email')
  const name = readFormValue(formData, 'name')
  const message = readFormValue(formData, 'message')

  if (!email || !message) {
    redirect('/scholars/invite?message=Email and message are required.')
  }

  const baseUrl = await getBaseUrl()
  const inviteUrl = `${baseUrl}/login?callbackUrl=${encodeURIComponent('/scholars')}`

  const result = await sendScholarInviteEmail({
    recipientEmail: email,
    inviterName: user.email?.split('@')[0] || 'A scholar',
    message: `${name ? `${name},\n\n` : ''}${message}`,
    inviteUrl,
  })

  if (!result.success) {
    redirect('/scholars/invite?message=Failed to send invite. Please try again.')
  }

  revalidatePath('/scholars')
  redirect('/scholars/invite?message=Invite sent successfully!')
}