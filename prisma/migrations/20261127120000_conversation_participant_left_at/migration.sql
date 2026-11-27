-- Leaving a group keeps the thread as a read-only archive.
--
-- Deleting the participant row made the conversation disappear from the inbox
-- but left a dead sidebar row that opened `/not-found`, and it threw away the
-- history. `leftAt` marks the row inactive instead: `getInbox` still returns the
-- thread, while unread counts, `sendMessage`, push fan-out and the Realtime
-- policies all require `leftAt IS NULL`. Existing rows are active (NULL).

ALTER TABLE "ConversationParticipant"
  ADD COLUMN "leftAt" TIMESTAMP(3);

CREATE INDEX "ConversationParticipant_userId_leftAt_idx"
  ON "ConversationParticipant"("userId", "leftAt");
