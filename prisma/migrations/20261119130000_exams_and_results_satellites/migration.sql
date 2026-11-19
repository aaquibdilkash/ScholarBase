-- Exams & Results satellites: finish the module rename for the bookmark,
-- vote, comment and comment-vote tables.
--
-- The parent table became "ExamsAndResults" in the previous migration. These
-- statements carry the same identity to its satellites and to the FK column
-- that points at the parent, so a future `prisma migrate diff` does not report
-- the renamed models as drop/create pairs.

-- Bookmarks
ALTER TABLE "public"."ResultBookmark" RENAME TO "ExamsAndResultsBookmark";

ALTER TABLE "public"."ExamsAndResultsBookmark"
  RENAME COLUMN "resultId" TO "examsAndResultsId";

ALTER TABLE "public"."ExamsAndResultsBookmark"
  RENAME CONSTRAINT "ResultBookmark_pkey" TO "ExamsAndResultsBookmark_pkey";

ALTER TABLE "public"."ExamsAndResultsBookmark"
  RENAME CONSTRAINT "ResultBookmark_resultId_fkey" TO "ExamsAndResultsBookmark_examsAndResultsId_fkey";

ALTER TABLE "public"."ExamsAndResultsBookmark"
  RENAME CONSTRAINT "ResultBookmark_userId_fkey" TO "ExamsAndResultsBookmark_userId_fkey";

ALTER INDEX IF EXISTS "ResultBookmark_resultId_userId_key"
  RENAME TO "ExamsAndResultsBookmark_examsAndResultsId_userId_key";

ALTER INDEX IF EXISTS "ResultBookmark_userId_createdAt_idx"
  RENAME TO "ExamsAndResultsBookmark_userId_createdAt_idx";

-- Votes
ALTER TABLE "public"."ResultVote" RENAME TO "ExamsAndResultsVote";

ALTER TABLE "public"."ExamsAndResultsVote"
  RENAME COLUMN "resultId" TO "examsAndResultsId";

ALTER TABLE "public"."ExamsAndResultsVote"
  RENAME CONSTRAINT "ResultVote_pkey" TO "ExamsAndResultsVote_pkey";

ALTER TABLE "public"."ExamsAndResultsVote"
  RENAME CONSTRAINT "ResultVote_resultId_fkey" TO "ExamsAndResultsVote_examsAndResultsId_fkey";

ALTER TABLE "public"."ExamsAndResultsVote"
  RENAME CONSTRAINT "ResultVote_userId_fkey" TO "ExamsAndResultsVote_userId_fkey";

ALTER INDEX IF EXISTS "ResultVote_resultId_userId_key"
  RENAME TO "ExamsAndResultsVote_examsAndResultsId_userId_key";

-- Comments
ALTER TABLE "public"."ResultComment" RENAME TO "ExamsAndResultsComment";

ALTER TABLE "public"."ExamsAndResultsComment"
  RENAME COLUMN "resultId" TO "examsAndResultsId";

ALTER TABLE "public"."ExamsAndResultsComment"
  RENAME CONSTRAINT "ResultComment_pkey" TO "ExamsAndResultsComment_pkey";

ALTER TABLE "public"."ExamsAndResultsComment"
  RENAME CONSTRAINT "ResultComment_resultId_fkey" TO "ExamsAndResultsComment_examsAndResultsId_fkey";

ALTER TABLE "public"."ExamsAndResultsComment"
  RENAME CONSTRAINT "ResultComment_authorId_fkey" TO "ExamsAndResultsComment_authorId_fkey";

ALTER TABLE "public"."ExamsAndResultsComment"
  RENAME CONSTRAINT "ResultComment_parentId_fkey" TO "ExamsAndResultsComment_parentId_fkey";

ALTER INDEX IF EXISTS "ResultComment_resultId_createdAt_idx"
  RENAME TO "ExamsAndResultsComment_examsAndResultsId_createdAt_idx";

-- Comment votes
ALTER TABLE "public"."ResultCommentVote" RENAME TO "ExamsAndResultsCommentVote";

ALTER TABLE "public"."ExamsAndResultsCommentVote"
  RENAME CONSTRAINT "ResultCommentVote_pkey" TO "ExamsAndResultsCommentVote_pkey";

ALTER TABLE "public"."ExamsAndResultsCommentVote"
  RENAME CONSTRAINT "ResultCommentVote_commentId_fkey" TO "ExamsAndResultsCommentVote_commentId_fkey";

ALTER TABLE "public"."ExamsAndResultsCommentVote"
  RENAME CONSTRAINT "ResultCommentVote_userId_fkey" TO "ExamsAndResultsCommentVote_userId_fkey";

ALTER INDEX IF EXISTS "ResultCommentVote_commentId_userId_key"
  RENAME TO "ExamsAndResultsCommentVote_commentId_userId_key";
