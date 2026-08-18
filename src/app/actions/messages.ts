'use server'

import prisma from '@/lib/db'
import { requireCurrentUser } from '@/lib/auth'
import { readFormValue } from '@/lib/form'
import { notifyUserById } from '@/lib/notifications'
import type { SubmitResult } from '@/types/form'

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
  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    orderBy: { lastMessageAt: 'desc' },
    select: directConversationSelect,
  })

  return Promise.all(
    conversations.map(async (conversation) => {
      const participant = conversation.participants.find((p) => p.user.id === userId)
      const unreadCount = await prisma.message.count({
        where: {
          conversationId: conversation.id,
          senderId: { not: userId },
          createdAt: { gt: participant?.lastReadAt ?? new Date(0) },
        },
      })
      return { ...conversation, unreadCount }
    }),
  )
}

export async function getUnreadMessageCount(userId: string) {
  const inbox = await getInbox(userId)
  return inbox.reduce((sum, conversation) => sum + conversation.unreadCount, 0)
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
        take: 40, // ⚡ INFINITE SCROLL: Only load latest 40 initially
        orderBy: { createdAt: 'desc' }, // ⚡ Must be descending to get newest
        select: {
          id: true,
          body: true,
          createdAt: true,
          senderId: true,
          conversationId: true,
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

// ⚡ INFINITE SCROLL: Fetch older messages using a cursor
export async function getMoreMessages(conversationId: string, cursorId: string) {
  const supabaseUser = await requireCurrentUser('Please log in to view messages.')

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      conversation: { participants: { some: { userId: supabaseUser.id } } },
    },
    take: 40,
    skip: 1, // Skip the cursor message itself
    cursor: { id: cursorId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      body: true,
      createdAt: true,
      senderId: true,
      conversationId: true,
      sender: {
        select: { id: true, name: true, handle: true, avatarUrl: true },
      },
    },
  })
  return messages;
}

// ⚡ REALTIME FIX: Safe fetcher for Prisma/Supabase conflicts
export async function getMessageDetails(messageId: string) {
  return prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      body: true,
      createdAt: true,
      senderId: true,
      conversationId: true,
      sender: {
        select: { id: true, name: true, handle: true, avatarUrl: true },
      },
    },
  });
}

export async function startConversation(formData: FormData): Promise<SubmitResult> {
  const supabaseUser = await requireCurrentUser('Please log in to send a message.')
  const recipientId = readFormValue(formData, 'recipientId')
  const body = readFormValue(formData, 'body')

  if (!recipientId || !body) return { success: false, error: 'Recipient and message are required.' }
  if (recipientId === supabaseUser.id) return { success: false, error: 'You cannot message yourself.' }

  const recipientBlockedSender = await prisma.block.findUnique({
    where: {
      blockerId_blockedId: { blockerId: recipientId, blockedId: supabaseUser.id },
    },
    select: { id: true },
  })
  if (recipientBlockedSender) return { success: false, error: 'You cannot message this scholar.' }

  const user = await prisma.user.findUnique({
    where: { id: supabaseUser.id },
    select: { id: true, name: true },
  })
  if (!user) return { success: false, error: 'User not found.' }

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
    data: { conversationId, senderId: user.id, body },
  })

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  })

  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId: user.id } },
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

  // REMOVED: revalidatePath
  return { success: true, redirect: `/messages/${conversationId}` }
}

export interface CreatedMessage {
  id: string;
  body: string;
  createdAt: Date;
  senderId: string;
  conversationId: string;
  sender: { id: string; name: string | null; handle: string | null; avatarUrl: string | null; };
}

export async function sendMessage(conversationId: string, formData: FormData): Promise<SubmitResult | CreatedMessage> {
  const supabaseUser = await requireCurrentUser('Please log in to message a scholar.')
  const body = readFormValue(formData, 'body')

  if (!body) return { success: false, error: 'Message body is required.' }

  const user = await prisma.user.findUnique({
    where: { id: supabaseUser.id },
    select: { id: true, name: true },
  })
  if (!user) return { success: false, error: 'User not found.' }

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      participants: { some: { userId: user.id } },
    },
    select: { id: true, participants: { select: { userId: true } } },
  })

  if (!conversation) return { success: false, error: 'Conversation not found.' }

  const otherParticipant = conversation.participants.find((p) => p.userId !== user.id)
  if (otherParticipant) {
    const blocked = await prisma.block.findUnique({
      where: {
        blockerId_blockedId: { blockerId: otherParticipant.userId, blockedId: user.id },
      },
    })
    if (blocked) return { success: false, error: 'You cannot send messages to this conversation because you have been blocked.' }
  }

  const createdMessage = await prisma.message.create({
    data: { conversationId, senderId: user.id, body },
    select: {
      id: true,
      body: true,
      createdAt: true,
      senderId: true,
      conversationId: true,
      sender: {
        select: { id: true, name: true, handle: true, avatarUrl: true },
      },
    },
  })

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  })

  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId: user.id } },
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
          title: `${user.name || 'Someone'} sent a new message`,
          body: body,
        });
      }
    }
  }

  return createdMessage;
}

export async function isUserBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const block = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    select: { id: true },
  })
  return !!block
}

export async function blockUser(blockedId: string) {
  const user = await requireCurrentUser('Please log in to block a scholar.')
  if (user.id === blockedId) throw new Error('You cannot block yourself.')
  await prisma.block.create({ data: { blockerId: user.id, blockedId } })
  // REMOVED: revalidatePath
}

export async function unblockUser(blockedId: string) {
  const user = await requireCurrentUser('Please log in to unblock a scholar.')
  await prisma.block.delete({
    where: { blockerId_blockedId: { blockerId: user.id, blockedId } },
  })
  // REMOVED: revalidatePath
}

export async function getBlockedUserIds(blockerId: string): Promise<string[]> {
  const blocks = await prisma.block.findMany({
    where: { blockerId },
    select: { blockedId: true },
  })
  return blocks.map((b) => b.blockedId)
}

// ⚡ NEW: Automatically mark conversation as read when opened
export async function markConversationAsRead(conversationId: string) {
  const supabaseUser = await requireCurrentUser();
  if (!supabaseUser) return;

  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: {
        conversationId,
        userId: supabaseUser.id,
      },
    },
    data: { lastReadAt: new Date() },
  }).catch(() => {
    // Fail silently if participant record doesn't match
  });
}
