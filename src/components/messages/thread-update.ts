import type { SentMessage } from "./MessageInputForm";

/**
 * Folds a Realtime `UPDATE` broadcast into the rendered thread.
 *
 * A reply stores a COPY of the quoted body (`replyTo`), so updating only the
 * edited row left every quote stale until a full reload — the editor's bubble
 * changed live, the quote on the recipient's screen did not. Returning to a
 * pure function keeps that reconciliation testable without a Realtime channel.
 */
export function applyMessageUpdate(
  messages: SentMessage[],
  row: Pick<SentMessage, "id" | "body"> & {
    editedAt?: Date | string | null;
    isDeleted?: boolean | null;
  },
): SentMessage[] {
  return messages.map((message) => {
    if (message.id === row.id) {
      return {
        ...message,
        body: row.isDeleted ? "" : row.body,
        editedAt: row.editedAt ?? message.editedAt,
        isDeleted: row.isDeleted,
      };
    }

    // ⚡ QUOTE SYNC: keep bubbles quoting the message accurate.
    if (message.replyToId === row.id && message.replyTo) {
      return {
        ...message,
        replyTo: {
          ...message.replyTo,
          body: row.isDeleted ? "" : row.body,
          isDeleted: row.isDeleted ?? message.replyTo.isDeleted,
        },
      };
    }

    return message;
  });
}
