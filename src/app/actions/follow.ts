'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function toggleFollow(followingId: string) {
  const user = await requireCurrentUser('Log in to follow this scholar and track their research.')

  const existing = await prisma.follows.findUnique({
    where: { followerId_followingId: { followerId: user.id, followingId } },
  })

  if (existing) {
    await prisma.follows.delete({
      where: { followerId_followingId: { followerId: user.id, followingId } },
    })
  } else {
    await prisma.follows.create({
      data: { followerId: user.id, followingId },
    })
  }

  revalidatePath(`/scholar/${followingId}`)
  revalidatePath('/feed')
}