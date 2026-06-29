'use server'

import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function toggleFollow(followingId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const loginMessage = encodeURIComponent("Log in to follow this scholar and track their research.")
    redirect(`/login?message=${loginMessage}`)
  }

  const existing = await prisma.follows.findUnique({
    where: { followerId_followingId: { followerId: user.id, followingId } }
  })

  if (existing) {
    await prisma.follows.delete({
      where: { followerId_followingId: { followerId: user.id, followingId } }
    })
  } else {
    await prisma.follows.create({
      data: { followerId: user.id, followingId }
    })
  }

  revalidatePath(`/scholar/${followingId}`)
  revalidatePath('/feed')
}