CREATE TABLE "OutreachEmailUnsubscribe" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachEmailUnsubscribe_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutreachEmailUnsubscribe_email_key" ON "OutreachEmailUnsubscribe"("email");
CREATE INDEX "OutreachEmailUnsubscribe_createdAt_idx" ON "OutreachEmailUnsubscribe"("createdAt" DESC);
