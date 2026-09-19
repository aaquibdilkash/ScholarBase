-- Journal Reviews: structured peer-review-experience reports attached to a
-- Journal, mirroring the Supervisor Recommendation architecture.
-- RULE 2/3: rating aggregates are materialized on "Journal" (reviewCount /
-- ratingSum) and counters live on "JournalReview" so reads never aggregate.
-- RULE 5: B-Tree indexes on (journalId, isDeleted, createdAt DESC),
-- (authorId, createdAt DESC) and trendingScore keep feeds zero-compute.

-- CreateEnum
CREATE TYPE "JournalOutcome" AS ENUM ('ACCEPTED', 'MINOR_REVISION', 'MAJOR_REVISION', 'REJECTED', 'WITHDRAWN');

-- AlterTable (materialized review aggregates on the parent Journal)
ALTER TABLE "Journal" ADD COLUMN "reviewCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Journal" ADD COLUMN "ratingSum" INTEGER NOT NULL DEFAULT 0;

-- AlterTable (profile content counter for non-anonymous reviews)
ALTER TABLE "User" ADD COLUMN "journalReviewCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "JournalReview" (
  "id" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "feedback" TEXT NOT NULL,
  "outcome" "JournalOutcome" NOT NULL,
  "turnaroundTimeDays" INTEGER NOT NULL,
  "editorialQualityScore" INTEGER NOT NULL,
  "peerReviewRigorScore" INTEGER NOT NULL,
  "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
  "journalId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "editedAt" TIMESTAMP(3),
  "isFrozen" BOOLEAN NOT NULL DEFAULT false,
  "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,
  "totalVotes" INTEGER NOT NULL DEFAULT 0,
  "totalBookmarks" INTEGER NOT NULL DEFAULT 0,
  "totalComments" INTEGER NOT NULL DEFAULT 0,
  "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedByType" "DeletedByType",
  "deletedById" TEXT,
  "reportCount" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "JournalReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalReviewVote" (
  "id" TEXT NOT NULL,
  "journalReviewId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "voteType" "VoteType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "JournalReviewVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalReviewComment" (
  "id" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "journalReviewId" TEXT NOT NULL,
  "parentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "editedAt" TIMESTAMP(3),
  "authorId" TEXT NOT NULL,
  "totalVotes" INTEGER NOT NULL DEFAULT 0,
  "totalReplies" INTEGER NOT NULL DEFAULT 0,
  "reportCount" INTEGER NOT NULL DEFAULT 0,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedByType" "DeletedByType",
  "deletedById" TEXT,
  "isFrozen" BOOLEAN NOT NULL DEFAULT false,
  "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,
  "mentions" JSONB,

  CONSTRAINT "JournalReviewComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalReviewCommentVote" (
  "id" TEXT NOT NULL,
  "commentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "voteType" "VoteType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "JournalReviewCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalReviewBookmark" (
  "id" TEXT NOT NULL,
  "journalReviewId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "JournalReviewBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JournalReviewVote_journalReviewId_userId_key" ON "JournalReviewVote"("journalReviewId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalReviewCommentVote_commentId_userId_key" ON "JournalReviewCommentVote"("commentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalReviewBookmark_journalReviewId_userId_key" ON "JournalReviewBookmark"("journalReviewId", "userId");

-- CreateIndex
CREATE INDEX "JournalReview_journalId_isDeleted_createdAt_idx" ON "JournalReview"("journalId", "isDeleted", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "JournalReview_journalId_authorId_idx" ON "JournalReview"("journalId", "authorId");

-- CreateIndex
CREATE INDEX "JournalReview_createdAt_idx" ON "JournalReview"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "JournalReview_authorId_createdAt_idx" ON "JournalReview"("authorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "JournalReview_trendingScore_idx" ON "JournalReview"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "JournalReviewComment_journalReviewId_createdAt_idx" ON "JournalReviewComment"("journalReviewId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "JournalReviewBookmark_userId_createdAt_idx" ON "JournalReviewBookmark"("userId", "createdAt" DESC);

-- CreateIndex (partial): one ACTIVE review per (author, journal). Soft-deleted
-- tombstones are excluded so re-submission after a delete stays possible.
CREATE UNIQUE INDEX "JournalReview_authorId_journalId_active_key" ON "JournalReview"("authorId", "journalId") WHERE "isDeleted" = false;

-- AddForeignKey
ALTER TABLE "JournalReview" ADD CONSTRAINT "JournalReview_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalReview" ADD CONSTRAINT "JournalReview_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalReviewVote" ADD CONSTRAINT "JournalReviewVote_journalReviewId_fkey" FOREIGN KEY ("journalReviewId") REFERENCES "JournalReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalReviewVote" ADD CONSTRAINT "JournalReviewVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalReviewComment" ADD CONSTRAINT "JournalReviewComment_journalReviewId_fkey" FOREIGN KEY ("journalReviewId") REFERENCES "JournalReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalReviewComment" ADD CONSTRAINT "JournalReviewComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalReviewComment" ADD CONSTRAINT "JournalReviewComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "JournalReviewComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalReviewCommentVote" ADD CONSTRAINT "JournalReviewCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "JournalReviewComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalReviewCommentVote" ADD CONSTRAINT "JournalReviewCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalReviewBookmark" ADD CONSTRAINT "JournalReviewBookmark_journalReviewId_fkey" FOREIGN KEY ("journalReviewId") REFERENCES "JournalReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalReviewBookmark" ADD CONSTRAINT "JournalReviewBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;