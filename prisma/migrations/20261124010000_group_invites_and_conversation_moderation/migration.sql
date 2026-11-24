-- Group invites + group moderation state.
--
-- Invites live in their own table so a pending invitee is NOT a participant.
-- `ConversationParticipant` membership drives every inbox, unread-count, send
-- and Realtime-authorization check, so keeping unaccepted invites out of it
-- means none of those paths needed to change.

CREATE TYPE "public"."ConversationInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

ALTER TABLE "public"."Conversation"
  ADD COLUMN "reportCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "isFrozen" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "public"."ConversationInvite" (
  "conversationId" TEXT NOT NULL,
  "inviteeId" TEXT NOT NULL,
  "inviterId" TEXT NOT NULL,
  "status" "public"."ConversationInviteStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  CONSTRAINT "ConversationInvite_pkey" PRIMARY KEY ("conversationId","inviteeId")
);

CREATE INDEX "ConversationInvite_inviteeId_status_createdAt_idx"
  ON "public"."ConversationInvite"("inviteeId", "status", "createdAt" DESC);

ALTER TABLE "public"."ConversationInvite"
  ADD CONSTRAINT "ConversationInvite_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ConversationInvite"
  ADD CONSTRAINT "ConversationInvite_inviteeId_fkey"
  FOREIGN KEY ("inviteeId") REFERENCES "public"."User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ConversationInvite"
  ADD CONSTRAINT "ConversationInvite_inviterId_fkey"
  FOREIGN KEY ("inviterId") REFERENCES "public"."User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
