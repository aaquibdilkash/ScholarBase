"use server";

import prisma from "@/lib/db";
import { isSearchableQuery } from "@/lib/search-guard";
import { allowSearchRequest } from "@/lib/search-rate-limit";
import { requireCurrentUser, getActiveUser } from "@/lib/auth";
import { readFormValue, readOptionalFormValue } from "@/lib/form";
import { messageSelect } from "@/lib/message-select";
import type { SubmitResult } from "@/types/form";
import {
  checkRateLimit,
  RATE_LIMIT_DEGRADED_ERROR,
  RATE_LIMIT_ERROR,
} from "@/lib/rate-limit";
import { queueMessagePush } from "@/lib/qstash";
import { after } from "next/server";
import { Prisma } from "@prisma/client";
import { MESSAGE_THREAD_PAGE_SIZE } from "@/constants/messages";
import { MAX_MESSAGE_BODY } from "@/lib/constants";

const sidebarUserSelect = {
  id: true,
  name: true,
  handle: true,
  avatarUrl: true,
  institutionVerifiedAt: true,
  isFrozen: true,
  isDeleted: true,
} as const;

/**
 * Collapse CRLF back to LF before measuring or storing a message body.
 *
 * Line breaks do not survive the wire unchanged: the multipart serializer
 * normalises every `\n` in a form field to `\r\n`, so a 256-character draft
 * with a single line break arrived as 257 characters and failed the cap even
 * though the composer showed `256/256`. Measuring the text the author typed —
 * and storing it with plain LF — keeps the client counter, the server cap and
 * the saved row in agreement.
 */
function normalizeMessageBody(body: string): string {
  return body.replace(/\r\n?/g, "\n");
}

const directConversationSelect = {
  id: true,
  lastMessageAt: true,
  updatedAt: true,
  participants: {
    select: {
      user: { select: sidebarUserSelect },
      lastReadAt: true,
    },
  },
  messages: {
    take: 1,
    orderBy: { createdAt: "desc" as const },
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
        },
      },
    },
  },
} as const;

// ⚡ ZERO-COMPUTE: Attach unread counts for only the fetched page of
// conversations, in one indexed raw query (Rule 2).
async function attachUnreadCounts(
  userId: string,
  conversations: { id: string }[],
): Promise<Map<string, number>> {
  if (conversations.length === 0) return new Map();
  const unreadCounts = await prisma.$queryRaw<{ conversationId: string; unreadCount: bigint }[]>`
      WITH participant_reads AS (
        SELECT "conversationId", COALESCE("lastReadAt", ${new Date(0)}) AS "lastReadAt"
        FROM "ConversationParticipant"
        WHERE "userId" = ${userId}
      )
      SELECT m."conversationId" AS "conversationId", COUNT(*)::int AS "unreadCount"
      FROM "Message" m
      INNER JOIN participant_reads pr ON pr."conversationId" = m."conversationId"
      WHERE m."senderId" != ${userId}
        AND m."createdAt" > pr."lastReadAt"
        AND m."conversationId" IN (${Prisma.join(conversations.map((c) => c.id))})
      GROUP BY m."conversationId"
    `;
  return new Map(
    unreadCounts.map((row) => [row.conversationId, Number(row.unreadCount)]),
  );
}

// ⚡ INFINITE SCROLL: Inbox loads `limit` conversations at a time (10 by
// default), newest first. Pass the last conversation's id as `cursor` to
// fetch the next page.
export async function getInbox(
  userId: string,
  limit: number = 10,
  cursor?: string,
) {
  const currentUser = await requireCurrentUser("Please log in to view messages.");
  if (currentUser.id !== userId) throw new Error("Not authorized.");

  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    orderBy: { lastMessageAt: "desc" },
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: limit,
    select: directConversationSelect,
  });

  const unreadCountMap = await attachUnreadCounts(userId, conversations);

  return conversations.map((conversation) => ({
    ...conversation,
    unreadCount: unreadCountMap.get(conversation.id) ?? 0,
  }));
}

// ⚡ SERVER-SIDE SEARCH: Searches ALL of the user's conversations in the
// database by the other participant's name or handle — not just the 10
// currently loaded in the sidebar.
// ⚡ SIDEBAR SYNC: single-row fetch for a just-created conversation.
// The sender's sidebar is missing this ID (its `getInbox` page predates the
// insert), so after `startConversation` it fetches exactly one PK row — never
// a page, never a scan. Membership is enforced (`participants.some`); a
// stranger's ID yields `null`. `unreadCount` is hardcoded 0 because the
// creator's `lastReadAt` was just set inside the same transaction.
export async function getConversationPreview(conversationId: string) {
  const currentUser = await requireCurrentUser("Please log in to view messages.");

  // `findFirst` (not `findUnique`): the membership check is a relation
  // filter, which Prisma only allows alongside a non-unique lookup.
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      participants: { some: { userId: currentUser.id } },
    },
    select: directConversationSelect,
  });

  if (!conversation) return null;

  return { ...conversation, unreadCount: 0 };
}

export async function searchInbox(userId: string, query: string, limit = 30) {
  const currentUser = await requireCurrentUser("Please log in to view messages.");
  if (currentUser.id !== userId) throw new Error("Not authorized.");

  const q = query.trim();
  // P0-3: same floor as every other search, and a throttle — this scans the
  // caller's whole conversation list. Authenticated and self-scoped, so it is
  // the lowest-risk search surface, but still unbounded.
  if (!isSearchableQuery(q)) return [];
  if (!(await allowSearchRequest("messages:inbox", currentUser.id))) return [];

  const conversations = await prisma.conversation.findMany({
    where: {
      participants: { some: { userId } },
      AND: [
        {
          participants: {
            some: {
              user: {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { handle: { contains: q, mode: "insensitive" } },
                ],
              },
            },
          },
        },
      ],
    },
    orderBy: { lastMessageAt: "desc" },
    take: limit,
    select: directConversationSelect,
  });

  const unreadCountMap = await attachUnreadCounts(userId, conversations);

  return conversations.map((conversation) => ({
    ...conversation,
    unreadCount: unreadCountMap.get(conversation.id) ?? 0,
  }));
}

export async function getUnreadMessageCount() {
  const currentUser = await requireCurrentUser("Please log in to view messages.");
  const userId = currentUser.id;

  const result = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::int AS count
    FROM "Message" m
    INNER JOIN "ConversationParticipant" cp ON m."conversationId" = cp."conversationId"
    WHERE cp."userId" = ${userId}
      AND m."senderId" != ${userId}
      AND m."createdAt" > COALESCE(cp."lastReadAt", ${new Date(0)})
  `;
  return Number(result[0]?.count ?? 0);
}

export async function getUnreadCounts() {
  const currentUser = await requireCurrentUser("Please log in to view your inbox.");
  const userId = currentUser.id;

  const rows = await prisma.$queryRaw<{ unreadMessages: bigint; unreadNotifications: bigint }[]>`
    WITH message_counts AS (
      SELECT COUNT(*)::int AS "unreadMessages"
      FROM "Message" m
      INNER JOIN "ConversationParticipant" cp
        ON m."conversationId" = cp."conversationId"
      WHERE cp."userId" = ${userId}
        AND m."senderId" != ${userId}
        AND m."createdAt" > COALESCE(cp."lastReadAt", ${new Date(0)})
    ),
    notification_counts AS (
      SELECT COUNT(*)::int AS "unreadNotifications"
      FROM "Notification"
      WHERE "recipientId" = ${userId}
        AND "readAt" IS NULL
    )
    SELECT
      (SELECT "unreadMessages" FROM message_counts) AS "unreadMessages",
      (SELECT "unreadNotifications" FROM notification_counts) AS "unreadNotifications";
  `;

  const row = rows[0];
  return {
    unreadMessages: Number(row?.unreadMessages ?? 0),
    unreadNotifications: Number(row?.unreadNotifications ?? 0),
  };
}

export async function findDirectConversation(otherUserId: string) {
  const currentUser = await requireCurrentUser("Please log in to view messages.");

  const conversation = await prisma.conversation.findFirst({
    where: {
      type: "DIRECT",
      AND: [
        { participants: { some: { userId: currentUser.id } } },
        { participants: { some: { userId: otherUserId } } },
      ],
    },
    select: { id: true },
  });
  return conversation?.id ?? null;
}

export async function getConversation(conversationId: string) {
  const currentUser = await requireCurrentUser("Please log in to view messages.");
  const userId = currentUser.id;

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      participants: { some: { userId } },
    },
    select: {
      id: true,
      lastMessageAt: true,
      participants: {
        select: {
          user: { select: sidebarUserSelect },
          lastReadAt: true,
        },
      },
      messages: {
        take: MESSAGE_THREAD_PAGE_SIZE, // ⚡ Initial thread is enough for the first screen; older history loads on demand.
        orderBy: { createdAt: "desc" },
        select: messageSelect,
      },
    },
  });

  if (!conversation) return null;

  // ⚡ BLOCK STATE: Resolve block relationships in the same action so the chat
  // UI can disable the composer and render the correct notice banner.
  const otherParticipantId = conversation.participants.find(
    (p) => p.user.id !== userId,
  )?.user.id;

  if (!otherParticipantId) return conversation;

  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: otherParticipantId },
        { blockerId: otherParticipantId, blockedId: userId },
      ],
    },
    select: { blockerId: true },
  });

  return {
    ...conversation,
    blockedByMe: block?.blockerId === userId,
    blockedMe: block ? block.blockerId !== userId : false,
  };
}

// ⚡ INFINITE SCROLL: Fetch older messages using a cursor
export async function getMoreMessages(
  conversationId: string,
  cursorId: string,
) {
  const supabaseUser = await requireCurrentUser(
    "Please log in to view messages.",
  );

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      conversation: { participants: { some: { userId: supabaseUser.id } } },
    },
    take: MESSAGE_THREAD_PAGE_SIZE,
    skip: 1, // Skip the cursor message itself
    cursor: { id: cursorId },
    orderBy: { createdAt: "desc" },
    select: messageSelect,
  });
  return messages;
}

export async function startConversation(
  formData: FormData,
): Promise<SubmitResult> {
  const auth = await getActiveUser("Please log in to send a message.");
  if (auth.frozen) return { success: false, error: auth.message };
  const supabaseUser = auth.user;

  const rateLimit = await checkRateLimit({
    namespace: "message:start",
    key: supabaseUser.id,
    limit: 15,
    window: "1 m",
    onDegraded: "closed",
  });

  if (!rateLimit.allowed) {
    return { success: false, error: rateLimit.degraded ? RATE_LIMIT_DEGRADED_ERROR : RATE_LIMIT_ERROR };
  }

  const recipientId = readFormValue(formData, "recipientId");
  const body = normalizeMessageBody(readFormValue(formData, "body"));

  if (!recipientId || !body)
    return { success: false, error: "Recipient and message are required." };

  // ⚡ SERVER-SIDE LENGTH CAP: `maxLength` on the textarea is bypassable —
  // never trust the client to enforce it (defense-in-depth). Measured after
  // CRLF normalisation so the cap matches the composer's character count.
  if (body.length > MAX_MESSAGE_BODY)
    return {
      success: false,
      error: `Message exceeds the ${MAX_MESSAGE_BODY}-character limit.`,
    };
  if (recipientId === supabaseUser.id)
    return { success: false, error: "You cannot message yourself." };

  // ⚡ RECIPIENT STATUS: mirrors `sendMessage` — a frozen/deleted scholar can
  // neither be started fresh with nor replied to. Checked up-front so no
  // conversation row is created for an undeliverable thread.
  const recipientStatus = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { id: true, isFrozen: true, isDeleted: true },
  });

  if (!recipientStatus) {
    return { success: false, error: "Recipient not found." };
  }

  if (recipientStatus.isFrozen) {
    return {
      success: false,
      error: "RECIPIENT_FROZEN: This scholar's account is currently frozen.",
    };
  }

  if (recipientStatus.isDeleted) {
    return {
      success: false,
      error: "CONVERSATION_DELETED: This conversation is no longer available.",
    };
  }

  // ⚡ BLOCK ENFORCEMENT (Issue 5): Check BOTH directions — the recipient may
  // have blocked the sender, or the sender may have blocked the recipient.
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: supabaseUser.id, blockedId: recipientId },
        { blockerId: recipientId, blockedId: supabaseUser.id },
      ],
    },
    select: { blockerId: true },
  });

  if (block) {
    return { success: false, error: "You cannot message this scholar." };
  }

  const user = await prisma.user.findUnique({
    where: { id: supabaseUser.id },
    select: { id: true, name: true },
  });
  if (!user) return { success: false, error: "User not found." };

  const existingConversation = await prisma.conversation.findFirst({
    where: {
      type: "DIRECT",
      AND: [
        { participants: { some: { userId: user.id } } },
        { participants: { some: { userId: recipientId } } },
      ],
    },
    select: { id: true },
  });

  const conversationId =
    existingConversation?.id ??
    (
      await prisma.conversation.create({
        data: {
          createdById: user.id,
          type: "DIRECT",
          participants: {
            create: [{ userId: user.id }, { userId: recipientId }],
          },
        },
        select: { id: true },
      })
    ).id;

  // ⚡ ATOMIC (Rule 3): message insert + `lastMessageAt` bump + sender
  // `lastReadAt` must commit together — a crash between them would leave an
  // orphan conversation row or a stale sidebar timestamp. All three ride one
  // pooled connection inside `$transaction`.
  const createdMessage = await prisma.$transaction(async (tx) => {
    const newMessage = await tx.message.create({
      data: { conversationId, senderId: user.id, body },
      select: { id: true },
    });

    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    await tx.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: user.id } },
      data: { lastReadAt: new Date() },
    });

    return newMessage;
  });

  // ⚡ `after()`: runs after the response is sent, so messaging stays instant,
  // but — unlike a bare `void` promise — the platform keeps the runtime alive
  // until the QStash publish finishes. QStash `deduplicationId` + SW
  // `messageId` dedupe make a double-enqueue a no-op, never a double buzz.
  after(() =>
    queueMessagePush({
      messageId: createdMessage.id,
      recipientId,
      conversationId,
      senderName: (user.name?.trim() || "A researcher").slice(0, 120),
      body,
    }).catch((error) => console.error("Message push enqueue error:", error)),
  );

  return {
    success: true,
    redirect: `/messages/${conversationId}`,
    // ⚡ RULE 1: return the created row so the sender's sidebar can surgically
    // prepend it (`setInbox`) instead of refetching or waiting for realtime.
    // The sender just marked themselves read, so `unreadCount` is provably 0 —
    // no `attachUnreadCounts` query needed (zero-compute, Rule 2).
    data: {
      id: conversationId,
      messageId: createdMessage.id,
      body,
    },
  };
}

export interface CreatedMessage {
  id: string;
  body: string;
  createdAt: Date;
  senderId: string;
  conversationId: string;
  replyToId: string | null;
  sender: {
    id: string;
    name: string | null;
    handle: string | null;
    avatarUrl: string | null;
  };
  replyTo: {
    id: string;
    body: string;
    isDeleted: boolean | null;
    sender: {
      id: string;
      name: string | null;
      handle: string | null;
    };
  } | null;
}

export type MessageFailureCode =
  | "BLOCKED"
  | "FROZEN"
  | "RECIPIENT_FROZEN"
  | "VALIDATION"
  | "CONVERSATION_DELETED"
  | "UNKNOWN";

export type SendMessageFailure = {
  success: false;
  error: string;
  code: MessageFailureCode;
};

export async function sendMessage(
  conversationId: string,
  formData: FormData,
): Promise<SendMessageFailure | CreatedMessage> {
  const auth = await getActiveUser(
    "Please log in to message a scholar.",
  );
  if (auth.frozen) {
    return {
      success: false,
      error: "Your account is frozen. Messaging is disabled.",
      code: "FROZEN",
    };
  }
  const supabaseUser = auth.user;

  const rateLimit = await checkRateLimit({
    namespace: "message:send",
    key: supabaseUser.id,
    limit: 60,
    window: "1 m",
    onDegraded: "closed",
  });

  if (!rateLimit.allowed) {
    return { success: false, error: rateLimit.degraded ? RATE_LIMIT_DEGRADED_ERROR : RATE_LIMIT_ERROR, code: "UNKNOWN" };
  }

  const body = normalizeMessageBody(readFormValue(formData, "body"));
  const replyToId = readOptionalFormValue(formData, "replyToId");

  if (!body) return { success: false, error: "Message body is required.", code: "VALIDATION" };

  // ⚡ SERVER-SIDE LENGTH CAP: `maxLength` on the composer is bypassable —
  // never trust the client to enforce it (defense-in-depth). Measured after
  // CRLF normalisation so the cap matches the composer's character count.
  if (body.length > MAX_MESSAGE_BODY)
    return {
      success: false,
      error: `Message exceeds the ${MAX_MESSAGE_BODY}-character limit.`,
      code: "VALIDATION",
    };

  const user = await prisma.user.findUnique({
    where: { id: supabaseUser.id },
    select: { id: true, name: true },
  });
  if (!user) return { success: false, error: "User not found.", code: "UNKNOWN" };

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      participants: { some: { userId: user.id } },
    },
    select: {
      id: true,
      participants: {
        select: {
          userId: true,
          user: { select: { id: true, isFrozen: true, isDeleted: true } },
        },
      },
    },
  });

  if (!conversation)
    return { success: false, error: "Conversation not found.", code: "CONVERSATION_DELETED" };

  // ⚡ BLOCK ENFORCEMENT (Issue 5): Dual-direction check — a block in either
  // direction must prevent the message from being created.
  const otherParticipant = conversation.participants.find(
    (p) => p.userId !== user.id,
  );
  if (otherParticipant) {
    if (otherParticipant.user.isDeleted) {
      return {
        success: false,
        error: "This conversation is no longer available.",
        code: "CONVERSATION_DELETED",
      };
    }
    if (otherParticipant.user.isFrozen) {
      return {
        success: false,
        error: "This scholar's account is currently frozen. Messaging is unavailable.",
        code: "RECIPIENT_FROZEN",
      };
    }
    const block = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: user.id, blockedId: otherParticipant.userId },
          { blockerId: otherParticipant.userId, blockedId: user.id },
        ],
      },
      select: { blockerId: true },
    });

    if (block) {
      return {
        success: false,
        error:
          block.blockerId === user.id
            ? "You have blocked this scholar. Unblock them to send messages."
            : "You cannot message this scholar.",
        code: "BLOCKED",
      };
    }
  }

  const createdMessage = await prisma.$transaction(async (tx) => {
    const newMessage = await tx.message.create({
      data: { conversationId, senderId: user.id, body, replyToId: replyToId ?? null },
      select: messageSelect,
    });

    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    await tx.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: user.id } },
      data: { lastReadAt: new Date() },
    });

    return newMessage;
  });

  // ⚡ `after()`: mirrors `startConversation`. Only the *other* participant is
  // notified, and only after the transaction above committed. Runs after the
  // response, so the send stays instant, and survives serverless freeze.
  if (otherParticipant) {
    after(() =>
      queueMessagePush({
        messageId: createdMessage.id,
        recipientId: otherParticipant.userId,
        conversationId,
        senderName: (createdMessage.sender.name?.trim() || "A researcher").slice(0, 120),
        body: createdMessage.body,
      }).catch((error) => console.error("Message push enqueue error:", error)),
    );
  }

  return createdMessage;
}

/**
 * Block enforcement for writes to an existing thread.
 *
 * `sendMessage` already refuses new messages when either side has blocked the
 * other. Editing and deleting must follow the same rule: otherwise the blocked
 * party keeps rewriting history that the blocker still receives over Realtime.
 * A block in either direction is decisive — the conversation is closed.
 *
 * Returns the user-facing error, or `null` when the write is allowed.
 */
async function blockedMessageWriteError(
  conversation: {
    type: string;
    participants: { userId: string }[];
  } | null,
  viewerId: string,
  action: "edit" | "delete",
): Promise<string | null> {
  if (!conversation || conversation.type !== "DIRECT") return null;

  const peerId = conversation.participants.find(
    (participant) => participant.userId !== viewerId,
  )?.userId;
  if (!peerId) return null;

  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: viewerId, blockedId: peerId },
        { blockerId: peerId, blockedId: viewerId },
      ],
    },
    select: { id: true },
  });

  return block
    ? `You cannot ${action} this message because this conversation is blocked.`
    : null;
}

export async function editMessage(
  messageId: string,
  newBody: string,
): Promise<SubmitResult | (CreatedMessage & { editedAt: Date | null })> {
  // Frozen accounts cannot rewrite message history — the composer is disabled,
  // and the per-message action menu hides Edit/Delete.
  const auth = await getActiveUser("Please log in to edit a message.");
  if (auth.frozen) return { success: false, error: auth.message };
  const supabaseUser = auth.user;

  const rateLimit = await checkRateLimit({
    namespace: "message:edit",
    key: supabaseUser.id,
    limit: 30,
    window: "1 m",
    onDegraded: "closed",
  });

  if (!rateLimit.allowed) {
    return { success: false, error: rateLimit.degraded ? RATE_LIMIT_DEGRADED_ERROR : RATE_LIMIT_ERROR };
  }

  const trimmed = normalizeMessageBody(newBody).trim();
  if (!trimmed) return { success: false, error: "Message body is required." };

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      senderId: true,
      conversationId: true,
      isDeleted: true,
      conversation: {
        select: { type: true, participants: { select: { userId: true } } },
      },
    },
  });

  // ⚡ ACADEMIC INTEGRITY: only the author may edit their own message.
  if (!message || message.senderId !== supabaseUser.id) {
    return { success: false, error: "You can only edit your own messages." };
  }

  if (message.isDeleted) {
    return { success: false, error: "Deleted messages cannot be edited." };
  }

  const blocked = await blockedMessageWriteError(
    message.conversation,
    supabaseUser.id,
    "edit",
  );
  if (blocked) return { success: false, error: blocked };

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { body: trimmed, editedAt: new Date() },
    select: {
      id: true,
      body: true,
      createdAt: true,
      editedAt: true,
      senderId: true,
      conversationId: true,
      replyToId: true,
      sender: {
        select: { id: true, name: true, handle: true, avatarUrl: true, institutionVerifiedAt: true },
      },
      replyTo: {
        select: {
          id: true,
          body: true,
          isDeleted: true,
          sender: {
            select: { id: true, name: true, handle: true },
          },
        },
      },
    },
  });

  // Realtime propagation happens via the Postgres Changes UPDATE listener in
  // MessageList — no extra broadcast plumbing required.
  return updated;
}

export async function deleteMessage(
  messageId: string,
): Promise<SubmitResult> {
  // Frozen accounts keep read-only access to their threads: no edit or delete
  // actions, matching the blocked-conversation policy (the UI hides both).
  const auth = await getActiveUser("Please log in to delete a message.");
  if (auth.frozen) return { success: false, error: auth.message };
  const supabaseUser = auth.user;

  const rateLimit = await checkRateLimit({
    namespace: "message:delete",
    key: supabaseUser.id,
    limit: 30,
    window: "1 m",
    onDegraded: "closed",
  });

  if (!rateLimit.allowed) {
    return { success: false, error: rateLimit.degraded ? RATE_LIMIT_DEGRADED_ERROR : RATE_LIMIT_ERROR };
  }

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      senderId: true,
      isDeleted: true,
      conversation: {
        select: { type: true, participants: { select: { userId: true } } },
      },
    },
  });

  // ⚡ ACADEMIC INTEGRITY: only the author may delete their own message.
  if (!message || message.senderId !== supabaseUser.id) {
    return { success: false, error: "You can only delete your own messages." };
  }

  if (message.isDeleted) {
    return { success: true };
  }

  const blocked = await blockedMessageWriteError(
    message.conversation,
    supabaseUser.id,
    "delete",
  );
  if (blocked) return { success: false, error: blocked };

  // ⚡ TOMBSTONE (RULE 4): Soft delete — blank the body for privacy and flag
  // the row so both clients render "This message was deleted".
  await prisma.message.update({
    where: { id: messageId },
    data: { isDeleted: true, body: "" },
  });

  return { success: true };
}

export async function isUserBlocked(
  blockerId: string,
  blockedId: string,
): Promise<boolean> {
  const currentUser = await requireCurrentUser();
  if (currentUser.id !== blockerId) throw new Error("Not authorized.");

  const block = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    select: { id: true },
  });
  return !!block;
}

export async function blockUser(blockedId: string): Promise<SubmitResult> {
  const user = await requireCurrentUser("Please log in to block a scholar.");
  const rateLimit = await checkRateLimit({
    namespace: "message:block",
    key: user.id,
    limit: 20,
    window: "1 m",
    onDegraded: "closed",
  });

  if (!rateLimit.allowed) {
    return { success: false, error: rateLimit.degraded ? RATE_LIMIT_DEGRADED_ERROR : RATE_LIMIT_ERROR };
  }

  if (user.id === blockedId) {
    return { success: false, error: "You cannot block yourself." };
  }

  try {
    await prisma.block.create({ data: { blockerId: user.id, blockedId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: true };
    }
    console.error("[BlockUser Error]:", error);
    return { success: false, error: "Could not update block status. Please try again." };
  }

  return { success: true };
}

export async function unblockUser(blockedId: string): Promise<SubmitResult> {
  // Unblocking must remain available to frozen users so they can restore a
  // conversation. This is a recovery action, not a messaging mutation.
  const user = await requireCurrentUser("Please log in to unblock a scholar.");
  const rateLimit = await checkRateLimit({
    namespace: "message:unblock",
    key: user.id,
    limit: 20,
    window: "1 m",
    onDegraded: "closed",
  });

  if (!rateLimit.allowed) {
    return { success: false, error: rateLimit.degraded ? RATE_LIMIT_DEGRADED_ERROR : RATE_LIMIT_ERROR };
  }

  await prisma.block.deleteMany({
    where: { blockerId: user.id, blockedId },
  });

  return { success: true };
}

export async function getBlockedUserIds(blockerId: string): Promise<string[]> {
  const currentUser = await requireCurrentUser();
  if (currentUser.id !== blockerId) throw new Error("Not authorized.");

  const blocks = await prisma.block.findMany({
    where: { blockerId },
    select: { blockedId: true },
  });
  return blocks.map((b) => b.blockedId);
}

// ⚡ NEW: Automatically mark conversation as read when opened
export async function markConversationAsRead(conversationId: string) {
  // Read receipts are private state, not a community mutation, and this runs
  // automatically when a conversation is opened. Frozen users must still be
  // able to read their conversations, so do NOT use requireActiveUser (which
  // throws ACCOUNT_FROZEN). Only deleted accounts are skipped — silently.
  const supabaseUser = await requireCurrentUser();
  if (!supabaseUser) return;

  const accountState = await prisma.user.findUnique({
    where: { id: supabaseUser.id },
    select: { isDeleted: true },
  });
  if (accountState?.isDeleted) return;

  const rateLimit = await checkRateLimit({
    namespace: "message:read",
    key: supabaseUser.id,
    limit: 120,
    window: "1 m",
  });

  if (!rateLimit.allowed) {
    return;
  }

  const lastReadAt = new Date();
  const result = await prisma.conversationParticipant
    .updateMany({
      where: {
        conversationId,
        userId: supabaseUser.id,
        OR: [
          { lastReadAt: null },
          { lastReadAt: { lt: lastReadAt } },
        ],
      },
      data: { lastReadAt },
    })
    .catch(() => ({ count: 0 }));

  return { lastReadAt, updated: result.count > 0 };
}
