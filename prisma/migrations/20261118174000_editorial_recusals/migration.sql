ALTER TYPE "ManuscriptEventType" ADD VALUE 'EDITORIAL_RECUSAL_DECLARED';

CREATE TABLE "ManuscriptRecusal" (
    "id" TEXT NOT NULL,
    "manuscriptId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManuscriptRecusal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManuscriptRecusal_manuscriptId_userId_key"
    ON "ManuscriptRecusal"("manuscriptId", "userId");
CREATE INDEX "ManuscriptRecusal_userId_createdAt_idx"
    ON "ManuscriptRecusal"("userId", "createdAt" DESC);

ALTER TABLE "ManuscriptRecusal"
    ADD CONSTRAINT "ManuscriptRecusal_manuscriptId_fkey"
    FOREIGN KEY ("manuscriptId") REFERENCES "Manuscript"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManuscriptRecusal"
    ADD CONSTRAINT "ManuscriptRecusal_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
