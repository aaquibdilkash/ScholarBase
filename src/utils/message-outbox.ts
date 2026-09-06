/**
 * ⚡ Offline Outbox (Issue 4)
 *
 * Persists unsent/failed direct messages in localStorage, keyed by
 * conversationId, so optimistic pending messages survive a page refresh
 * while offline. Entries are removed only after the server confirms the
 * message was created.
 *
 * Client-only: every helper guards on `typeof window`.
 */

export type OutboxStatus = "PENDING" | "FAILED";

export interface PendingMessage {
  id: string; // temp client ID (stable across retries)
  conversationId: string;
  senderId: string;
  body: string;
  status: OutboxStatus;
  createdAt: string;
  senderName: string | null;
  senderHandle: string | null;
  senderAvatarUrl: string | null;
}

const OUTBOX_KEY = "sb-message-outbox";

function readOutbox(): Record<string, PendingMessage[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(OUTBOX_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeOutbox(outbox: Record<string, PendingMessage[]>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
  } catch {
    // Storage full / unavailable – outbox is best-effort.
  }
}

export function getOutboxForConversation(conversationId: string): PendingMessage[] {
  return readOutbox()[conversationId] ?? [];
}

export function getAllPendingMessages(): PendingMessage[] {
  const outbox = readOutbox();
  return Object.values(outbox).flat();
}

export function upsertPendingMessage(message: PendingMessage) {
  const outbox = readOutbox();
  const queue = outbox[message.conversationId] ?? [];
  const index = queue.findIndex((m) => m.id === message.id);
  if (index >= 0) {
    queue[index] = message;
  } else {
    queue.push(message);
  }
  outbox[message.conversationId] = queue;
  writeOutbox(outbox);
}

export function updatePendingMessageStatus(
  conversationId: string,
  id: string,
  status: OutboxStatus,
) {
  const outbox = readOutbox();
  const queue = outbox[conversationId];
  if (!queue) return;
  const message = queue.find((m) => m.id === id);
  if (!message) return;
  message.status = status;
  writeOutbox(outbox);
}

/** Removes an entry only after the server responds successfully. */
export function removePendingMessage(conversationId: string, id: string) {
  const outbox = readOutbox();
  const queue = outbox[conversationId];
  if (!queue) return;
  outbox[conversationId] = queue.filter((m) => m.id !== id);
  if (outbox[conversationId].length === 0) delete outbox[conversationId];
  writeOutbox(outbox);
}
