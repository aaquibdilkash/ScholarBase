import type { SentMessage } from "./MessageInputForm";
import type { PendingMessage } from "@/utils/message-outbox";

/**
 * Fold ONE message into the rendered thread.
 *
 * Two duplicate sources are killed here:
 *
 *  1. The composer appends an optimistic bubble with a temp id, then the Server
 *     Action returns the persisted row. Without `replacesId` the two copies are
 *     reconciled by body + sender, so any difference in the stored text (CRLF
 *     normalisation, whitespace) left BOTH bubbles on screen until a refresh.
 *     The composer now hands over the temp id, which is an exact key.
 *  2. A message can also arrive twice over Realtime (broadcast retry) or via
 *     the action result *and* a broadcast. `incoming.id` is the database id, so
 *     an already-rendered row is never appended a second time.
 *
 * Matching on body + sender is kept as a fallback for messages that arrive
 * without a temp id (e.g. a broadcast while the POST is still in flight).
 */
export function appendMessage(
  current: SentMessage[],
  incoming: SentMessage,
  replacesId?: string,
): SentMessage[] {
  // A confirmation from the composer names the exact bubble it replaces, so
  // matching stays deterministic: two deliberate sendings of the same text must
  // not delete one another.
  const withoutReplaced = replacesId
    ? current.filter((message) => message.id !== replacesId)
    : current;

  // Without a temp id (a Realtime INSERT that beat the Server Action) fall back
  // to body + sender so the optimistic copy is not left behind. An optimistic
  // bubble itself is never folded: sending the same text twice must keep both.
  const withoutOptimisticEcho =
    replacesId || incoming.status === "sending"
      ? withoutReplaced
      : withoutReplaced.filter(
          (message) =>
            !(
              isOptimisticMessage(message) &&
              message.senderId === incoming.senderId &&
              sameMessageBody(message.body, incoming.body)
            ),
        );

  if (withoutOptimisticEcho.some((message) => message.id === incoming.id)) {
    return withoutOptimisticEcho;
  }

  return [...withoutOptimisticEcho, incoming];
}

/** An optimistic bubble that the server has not confirmed yet. */
export function isOptimisticMessage(
  message: Pick<SentMessage, "status">,
): boolean {
  return message.status === "sending" || message.status === "failed";
}

/**
 * Compare the text typed in the composer with the text stored by the server.
 *
 * `normalizeMessageBody` in the Server Action collapses CRLF to LF and the
 * multipart serializer rewrites line endings on the wire, so an exact string
 * comparison reports "different message" for the same message and the
 * optimistic copy is never removed. Line endings and outer whitespace are not
 * meaningful to the author, so they are ignored here too.
 */
export function sameMessageBody(a: string, b: string): boolean {
  return normalizeBody(a) === normalizeBody(b);
}

function normalizeBody(body: string): string {
  return body.replace(/\r\n?/g, "\n").trim();
}

/**
 * Prepend a page of older history without ever rendering a message twice.
 *
 * The intersection observer can fire twice before React re-renders (the
 * `isLoadingMore` state guard is not visible to the second call), so two
 * in-flight fetches returned the same page and every row in it was prepended
 * twice — visible until a refresh replaced the thread with the server's copy.
 */
export function prependOlderMessages(
  current: SentMessage[],
  older: SentMessage[],
): SentMessage[] {
  const existing = new Set(current.map((message) => message.id));
  const fresh = older.filter((message) => !existing.has(message.id));
  if (fresh.length === 0) return current;
  return [...fresh, ...current];
}

/**
 * How far apart a queued outbox entry and a stored row may be and still be the
 * same send. The entry is written immediately before the request, so the row is
 * always created at (or slightly after) `pending.createdAt`; ten minutes
 * absorbs clock skew and slow requests without treating a deliberately repeated
 * message sent much later as a duplicate.
 */
const OUTBOX_DELIVERY_WINDOW_MS = 10 * 60 * 1000;

/**
 * Was this queued message actually delivered, even though its confirmation
 * never reached the browser?
 *
 * The outbox entry is removed only after the Server Action responds. If the row
 * commits but the response is lost (reload, dropped connection, navigated away
 * mid-request), the next mount rehydrates the entry, shows it next to the
 * already-loaded row, and re-sends it — creating a real duplicate in the
 * database. Use this before hydrating or retrying.
 */
export function isPendingMessageDelivered(
  pending: Pick<PendingMessage, "body" | "senderId" | "createdAt">,
  delivered: ReadonlyArray<Pick<SentMessage, "body" | "senderId" | "createdAt">>,
): boolean {
  const queuedAt = Date.parse(pending.createdAt);

  return delivered.some((message) => {
    if (message.senderId !== pending.senderId) return false;
    if (!sameMessageBody(message.body, pending.body)) return false;
    if (Number.isNaN(queuedAt)) return true;

    const createdAt = new Date(message.createdAt).getTime();
    if (Number.isNaN(createdAt)) return true;

    return Math.abs(createdAt - queuedAt) <= OUTBOX_DELIVERY_WINDOW_MS;
  });
}
