-- Outreach contact list (replaces the Excel file).
--
-- One row per cold-contact / prospect email. Admin-only writes via
-- `src/app/actions/outreach.ts`. `email` is unique so the same person is
-- never emailed twice by accident. `status` tracks the send lifecycle:
--   PENDING   -> queued to be emailed
--   OUTREACHED -> email sent successfully
--   BOUNCED   -> provider rejected / undeliverable
--   REPLIED   -> recipient replied
--   UNSUBSCRIBED -> opted out (mirrors OutreachEmailUnsubscribe)
--
-- `userId` optionally links the contact to a registered ScholarBase account
-- so we can track "cold contact -> signed up" conversion. `createdById`
-- records which admin added the contact.

CREATE TYPE "public"."OutreachStatus" AS ENUM ('PENDING', 'OUTREACHED', 'BOUNCED', 'REPLIED', 'UNSUBSCRIBED');

CREATE TABLE "public"."Outreach" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "institution" TEXT,
    "role" TEXT,
    "source" TEXT,
    "notes" TEXT,
    "status" "OutreachStatus" NOT NULL DEFAULT 'PENDING',
    "sendCount" INTEGER NOT NULL DEFAULT 0,
    "outreachedAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Outreach_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Outreach_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Outreach_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Outreach_email_key" ON "public"."Outreach"("email");
CREATE INDEX "Outreach_status_createdAt_idx" ON "public"."Outreach"("status", "createdAt" DESC);
CREATE INDEX "Outreach_createdById_createdAt_idx" ON "public"."Outreach"("createdById", "createdAt" DESC);
