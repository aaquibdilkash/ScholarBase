'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { readFormValue } from '@/lib/form'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { notifyUserById } from '@/lib/notifications'

const directConversationSelect = {
  id: true,
  lastMessageAt: true,
  updatedAt: true,
  participants: {
    select: {
      user: {
        select: {
          id: true,
          name: true,
          handle: true,
          avatarUrl: true,
          bio: true,
          reputation: true,
        },
      },
      lastReadAt: true,
    },
  },
  messages: {
    take: 1,
    orderBy: { createdAt: 'desc' as const },
    select: {
      body: true,
      createdAt: true,
      sender: {
        select: {
          id: true,
          name: true,
          handle: true,
        },
      },
    },
  },
}

export async function getInbox(userId: string) {
  return prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    orderBy: { lastMessageAt: 'desc' },
    select: directConversationSelect,
  })
}

export async function findDirectConversation(userIdA: string, userIdB: string) {
  const conversation = await prisma.conversation.findFirst({
    where: {
      type: 'DIRECT',
      AND: [
        { participants: { some: { userId: userIdA } } },
        { participants: { some: { userId: userIdB } } },
      ],
    },
    select: { id: true },
  })

  return conversation?.id ?? null
}

export async function getConversation(conversationId: string, userId: string) {
  return prisma.conversation.findFirst({
    where: {
      id: conversationId,
      participants: { some: { userId } },
    },
    select: {
      id: true,
      lastMessageAt: true,
      participants: {
        select: {
          user: {
            select: {
              id: true,
              name: true,
              handle: true,
              avatarUrl: true,
              bio: true,
              reputation: true,
            },
          },
          lastReadAt: true,
        },
      },
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          body: true,
          createdAt: true,
          senderId: true,
          sender: {
            select: {
              id: true,
              name: true,
              handle: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  })
}

import type { SubmitResult } from '@/types/actions'

export async function startConversation(formData: FormData): Promise<SubmitResult> {
  const supabaseUser = await requireCurrentUser('Please log in to send a message.')
  const recipientId = readFormValue(formData, 'recipientId')
  const body = readFormValue(formData, 'body')

  if (!recipientId || !body) {
    return { success: false, error: 'Recipient and message are required.' }
  }

  if (recipientId === supabaseUser.id) {
    return { success: false, error: 'You cannot message yourself.' }
  }

  // Check if the recipient has blocked the current user
  const recipientBlockedSender = await prisma.block.findUnique({
    where: {
      blockerId_blockedId: {
        blockerId: recipientId,
        blockedId: supabaseUser.id,
      },
    },
    select: { id: true },
  })
  if (recipientBlockedSender) {
    return { success: false, error: 'You cannot message this scholar.' }
  }

  const user = await prisma.user.findUnique({
    where: { id: supabaseUser.id },
    select: { id: true, name: true },
  })
  if (!user) {
    return { success: false, error: 'User not found.' }
  }

  const existingConversation = await prisma.conversation.findFirst({
    where: {
      type: 'DIRECT',
      AND: [
        { participants: { some: { userId: user.id } } },
        { participants: { some: { userId: recipientId } } },
      ],
    },
    select: { id: true },
  })

  const conversationId = existingConversation?.id ?? (await prisma.conversation.create({
    data: {
      createdById: user.id,
      type: 'DIRECT',
      participants: {
        create: [{ userId: user.id }, { userId: recipientId }],
      },
    },
    select: { id: true },
  })).id

  await prisma.message.create({
    data: {
      conversationId,
      senderId: user.id,
      body,
    },
  })

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  })

  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: { conversationId, userId: user.id },
    },
    data: { lastReadAt: new Date() },
  })

  await notifyUserById({
    recipientId,
    actorId: user.id,
    type: 'message-received',
    targetType: 'conversation',
    targetId: conversationId,
    title: `${user.name || 'Someone'} sent you a new message`,
    body: body,
  });

  revalidatePath('/messages')
  return { success: true, redirect: `/messages/${conversationId}` }
}

export async function sendMessage(conversationId: string, formData: FormData): Promise<SubmitResult | any> {
  const supabaseUser = await requireCurrentUser('Please log in to message a scholar.')
  const body = readFormValue(formData, 'body')

  if (!body) {
    return { success: false, error: 'Message body is required.' }
  }

  const user = await prisma.user.findUnique({
    where: { id: supabaseUser.id },
    select: { id: true, name: true },
  })
  if (!user) {
    return { success: false, error: 'User not found.' }
  }

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      participants: { some: { userId: user.id } },
    },
    select: { id: true, participants: { select: { userId: true } } },
  })

  if (!conversation) {
    return { success: false, error: 'Conversation not found.' }
  }

  // Check if the current user has been blocked by any participant
  const otherParticipant = conversation.participants.find(
    (p) => p.userId !== user.id,
  )
  if (otherParticipant) {
    const blocked = await prisma.block.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: otherParticipant.userId,
          blockedId: user.id,
        },
      },
    })
    if (blocked) {
      return { success: false, error: 'You cannot send messages to this conversation because you have been blocked.' }
    }
  }

  const createdMessage = await prisma.message.create({
    data: {
      conversationId,
      senderId: user.id,
      body,
    },
    select: {
      id: true,
      body: true,
      createdAt: true,
      senderId: true,
      sender: {
        select: {
          id: true,
          name: true,
          handle: true,
          avatarUrl: true,
        },
      },
    },
  })

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  })

  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: { conversationId, userId: user.id },
    },
    data: { lastReadAt: new Date() },
  })

  if (conversation) {
    for (const participant of conversation.participants) {
      if (participant.userId !== user.id) {
        await notifyUserById({
          recipientId: participant.userId,
          actorId: user.id,
          type: 'message-received',
          targetType: 'conversation',
          targetId: conversationId,
          title: `${user.name || 'Someone'} sent a new message in your conversation`,
          body: body,
        });
      }
    }
  }

  revalidatePath('/messages')
  // No need to revalidate or redirect the conversation page itself,
  // as the new message will be added in real-time.
  return createdMessage;
}

export async function isUserBlocked(
  blockerId: string,
  blockedId: string,
): Promise<boolean> {
  const block = await prisma.block.findUnique({
    where: {
      blockerId_blockedId: { blockerId, blockedId },
    },
    select: { id: true },
  })
  return !!block
}

export async function blockUser(blockedId: string) {
  const user = await requireCurrentUser('Please log in to block a scholar.')
  if (user.id === blockedId) {
    throw new Error('You cannot block yourself.')
  }

  await prisma.block.create({
    data: { blockerId: user.id, blockedId },
  })

  revalidatePath(`/scholars/${blockedId}`)
}

export async function unblockUser(blockedId: string) {
  const user = await requireCurrentUser('Please log in to unblock a scholar.')

  await prisma.block.delete({
    where: {
      blockerId_blockedId: { blockerId: user.id, blockedId },
    },
  })

  revalidatePath(`/scholars/${blockedId}`)
}

export async function getBlockedUserIds(blockerId: string): Promise<string[]> {
  const blocks = await prisma.block.findMany({
    where: { blockerId },
    select: { blockedId: true },
  })
  return blocks.map((b) => b.blockedId)
}
