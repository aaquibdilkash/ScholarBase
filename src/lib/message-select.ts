import type { Prisma } from "@prisma/client";

/**
 * ⚡ Shared lightweight projection for Message reads and server-action
 * responses. Includes the self-referencing replyTo relation with a minimal
 * scalar-only sub-select to avoid deep nested joins (zero-compute reads).
 */
export const messageSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  body: true,
  createdAt: true,
  updatedAt: true,
  editedAt: true,
  isDeleted: true,
  readAt: true,
  replyToId: true,
  sender: {
    select: {
      id: true,
      name: true,
      handle: true,
      avatarUrl: true,
    },
  },
  replyTo: {
    select: {
      id: true,
      body: true,
      isDeleted: true,
      sender: {
        select: {
          id: true,
          name: true,
          handle: true,
        },
      },
    },
  },
} as const;

export type MessageWithReply = Prisma.MessageGetPayload<{
  select: typeof messageSelect;
}>;