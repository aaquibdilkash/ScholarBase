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

export async function startConversation(formData: FormData) {
  const supabaseUser = await requireCurrentUser('Please log in to send a message.')
  const recipientId = readFormValue(formData, 'recipientId')
  const body = readFormValue(formData, 'body')

  if (!recipientId || !body) {
    redirect('/messages/new?message=Recipient and message are required.')
  }

  if (recipientId === supabaseUser.id) {
    redirect('/messages/new?message=You cannot message yourself.')
  }

  const user = await prisma.user.findUnique({
    where: { id: supabaseUser.id },
    select: { id: true, name: true },
  })
  if (!user) {
    redirect('/messages/new?message=User not found.')
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
  redirect(`/messages/${conversationId}`)
}

export async function sendMessage(conversationId: string, formData: FormData) {
  const supabaseUser = await requireCurrentUser('Please log in to message a scholar.')
  const body = readFormValue(formData, 'body')

  if (!body) {
    redirect(`/messages/${conversationId}?message=Message body is required.`)
  }

  const user = await prisma.user.findUnique({
    where: { id: supabaseUser.id },
    select: { id: true, name: true },
  })
  if (!user) {
    redirect('/messages?message=User not found.')
  }

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      participants: { some: { userId: user.id } },
    },
    select: { id: true, participants: { select: { userId: true } } },
  })

  if (!conversation) {
    redirect('/messages?message=Conversation not found.')
  }

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
}