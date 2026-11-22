ALTER TYPE "public"."ConversationType" ADD VALUE IF NOT EXISTS 'GROUP';

CREATE TYPE "public"."ConversationParticipantRole" AS ENUM ('OWNER', 'MEMBER');

ALTER TABLE "public"."Conversation"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "contextType" TEXT,
  ADD COLUMN "contextId" TEXT;

ALTER TABLE "public"."ConversationParticipant"
  ADD COLUMN "role" "public"."ConversationParticipantRole" NOT NULL DEFAULT 'MEMBER';

CREATE INDEX "Conversation_contextType_contextId_idx"
  ON "public"."Conversation"("contextType", "contextId");

CREATE INDEX "ConversationParticipant_userId_role_lastReadAt_idx"
  ON "public"."ConversationParticipant"("userId", "role", "lastReadAt");
