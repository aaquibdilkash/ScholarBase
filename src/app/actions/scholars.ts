'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { readFormValue } from '@/lib/form'
import { getBaseUrl } from '@/lib/url'
import { sendScholarInviteEmail } from '@/lib/email'
import { Prisma } from '@prisma/client'

export async function getScholars(q?: string, sort: 'latest' | 'reputation' = 'latest', currentUserId?: string, limit = 20, cursor?: string) {
  const orderBy: Prisma.UserOrderByWithRelationInput[] =
    sort === 'reputation'
      ? [{ reputation: 'desc' }, { createdAt: 'desc' }]
      : [{ createdAt: 'desc' }]

  return prisma.user.findMany({
    where: {
      ...(q
        ? {
          OR: [
            { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { handle: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { bio: { contains: q, mode: Prisma.QueryMode.insensitive } },
          ],
        }
        : {}),
      isDeleted: false, // RULE 3: exclude soft-deleted (tombstoned) scholars
    },
    select: {
      id: true,
      name: true,
      handle: true,
      avatarUrl: true,
      bio: true,
      reputation: true,
      createdAt: true,
      // RULE 6: Read materialized counters instead of a live COUNT(*) subquery.
      followersCount: true,
      followingCount: true,
      followers: currentUserId
        ? {
          where: { followerId: currentUserId },
          select: { followerId: true },
        }
        : false,
    },
    orderBy,
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })
}

export async function getScholarById(id: string) {
  return prisma.user.findUnique({
    where: { id, isDeleted: false }, // RULE 3: exclude soft-deleted (tombstoned) scholars
    select: {
      id: true,
      name: true,
      handle: true,
      avatarUrl: true,
      bio: true,
      reputation: true,
      createdAt: true,
      // RULE 6: Read materialized counters instead of a live COUNT(*) subquery.
      followersCount: true,
      followingCount: true,
      followers: { select: { followerId: true } },
    },
  })
}

export async function inviteScholar(formData: FormData) {
  const user = await requireCurrentUser('Please log in to invite a scholar.')

  const email = readFormValue(formData, 'email')
  const name = readFormValue(formData, 'name')
  const message = readFormValue(formData, 'message')

  if (!email || !message) {
    return { success: false, error: 'Email and message are required.' }
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
    return { success: false, error: 'Failed to send invite. Please try again.' }
  }

  return { success: true, message: 'Invite sent successfully!' }
}
