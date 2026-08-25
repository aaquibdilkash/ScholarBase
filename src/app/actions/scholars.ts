'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { getBaseUrl } from '@/lib/url'
import { sendScholarInviteEmail } from '@/lib/email'
import { Prisma } from '@prisma/client'
import type { InviteFormState } from '@/types/invite'

import { z } from 'zod'

const inviteSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  email: z.string().email({ message: 'A valid email address is required' }),
  message: z.string().min(1, { message: 'A message is required' }),
})

export async function getScholars(q?: string, sort: 'latest' | 'reputation' = 'latest', currentUserId?: string, limit = 10, cursor?: string) {
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

export async function inviteScholar(
  prevState: InviteFormState,
  formData: FormData
): Promise<InviteFormState> {
  const user = await requireCurrentUser('Please log in to invite a scholar.')

  const validatedFields = inviteSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    message: formData.get('message'),
  })

  if (!validatedFields.success) {
    return {
      success: false,
      message: validatedFields.error.issues.map((e) => e.message).join(', '),
    }
  }

  const { name, email, message } = validatedFields.data

  const baseUrl = await getBaseUrl()
  const inviteUrl = `${baseUrl}/login?callbackUrl=${encodeURIComponent('/scholars')}`

  const result = await sendScholarInviteEmail({
    recipientEmail: email,
    inviterName: user.email?.split('@')[0] || 'A scholar',
    message: `${name ? `${name},\n\n` : ''}${message}`,
    inviteUrl,
  })

  if (!result.success) {
    return { success: false, message: 'Failed to send invite. Please try again.' }
  }

  return { success: true, message: 'Invite sent successfully!' }
}
