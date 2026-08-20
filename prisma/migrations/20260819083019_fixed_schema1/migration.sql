/*
  Warnings:

  - You are about to drop the column `role` on the `ConversationParticipant` table. All the data in the column will be lost.
  - You are about to drop the column `isDeleted` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `recipientId` on the `Message` table. All the data in the column will be lost.
  - The `privacy` column on the `ResearchSurvey` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `ResearchSurvey` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `emailDomain` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `emailVerified` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `ResearchSurveyAnswer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ResearchSurveyComment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ResearchSurveyCommentVote` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ResearchSurveyQuestion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ResearchSurveyQuestionOption` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ResearchSurveyResponse` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ResearchSurveyVote` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "SurveyQuestionType" AS ENUM ('SHORT_TEXT', 'LONG_TEXT', 'MULTIPLE_CHOICE', 'CHECKBOXES', 'DROPDOWN', 'RATING', 'LINEAR_SCALE', 'DATE', 'LIKERT_SCALE');

-- CreateEnum
CREATE TYPE "SurveyPrivacy" AS ENUM ('ANONYMOUS', 'NON_ANONYMOUS', 'HYBRID');

-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('OPEN', 'CLOSED');

-- DropForeignKey
ALTER TABLE "Article" DROP CONSTRAINT "Article_authorId_fkey";

-- DropForeignKey
ALTER TABLE "ArticleCommentVote" DROP CONSTRAINT "ArticleCommentVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "ArticleVote" DROP CONSTRAINT "ArticleVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "ContributionCommentVote" DROP CONSTRAINT "ContributionCommentVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "ContributionVote" DROP CONSTRAINT "ContributionVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "Course" DROP CONSTRAINT "Course_authorId_fkey";

-- DropForeignKey
ALTER TABLE "CourseCommentVote" DROP CONSTRAINT "CourseCommentVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "CourseVote" DROP CONSTRAINT "CourseVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "Follows" DROP CONSTRAINT "Follows_followerId_fkey";

-- DropForeignKey
ALTER TABLE "Follows" DROP CONSTRAINT "Follows_followingId_fkey";

-- DropForeignKey
ALTER TABLE "HelpPostCommentVote" DROP CONSTRAINT "HelpPostCommentVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "HelpPostVote" DROP CONSTRAINT "HelpPostVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "JobVacancy" DROP CONSTRAINT "JobVacancy_authorId_fkey";

-- DropForeignKey
ALTER TABLE "JobVacancyCommentVote" DROP CONSTRAINT "JobVacancyCommentVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "JobVacancyVote" DROP CONSTRAINT "JobVacancyVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "Journal" DROP CONSTRAINT "Journal_authorId_fkey";

-- DropForeignKey
ALTER TABLE "JournalCommentVote" DROP CONSTRAINT "JournalCommentVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "JournalVote" DROP CONSTRAINT "JournalVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_recipientId_fkey";

-- DropForeignKey
ALTER TABLE "PhdAdmission" DROP CONSTRAINT "PhdAdmission_authorId_fkey";

-- DropForeignKey
ALTER TABLE "PhdAdmissionCommentVote" DROP CONSTRAINT "PhdAdmissionCommentVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "PhdAdmissionVote" DROP CONSTRAINT "PhdAdmissionVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "PublicationCommentVote" DROP CONSTRAINT "PublicationCommentVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "PublicationVote" DROP CONSTRAINT "PublicationVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "Recommendation" DROP CONSTRAINT "Recommendation_authorId_fkey";

-- DropForeignKey
ALTER TABLE "RecommendationCommentVote" DROP CONSTRAINT "RecommendationCommentVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "RecommendationVote" DROP CONSTRAINT "RecommendationVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "ResearchEvent" DROP CONSTRAINT "ResearchEvent_authorId_fkey";

-- DropForeignKey
ALTER TABLE "ResearchEventCommentVote" DROP CONSTRAINT "ResearchEventCommentVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "ResearchEventVote" DROP CONSTRAINT "ResearchEventVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "ResearchGrant" DROP CONSTRAINT "ResearchGrant_authorId_fkey";

-- DropForeignKey
ALTER TABLE "ResearchGrantCommentVote" DROP CONSTRAINT "ResearchGrantCommentVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "ResearchGrantVote" DROP CONSTRAINT "ResearchGrantVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "ResearchSurveyAnswer" DROP CONSTRAINT "ResearchSurveyAnswer_questionId_fkey";

-- DropForeignKey
ALTER TABLE "ResearchSurveyAnswer" DROP CONSTRAINT "ResearchSurveyAnswer_responseId_fkey";

-- DropForeignKey
ALTER TABLE "ResearchSurveyComment" DROP CONSTRAINT "ResearchSurveyComment_authorId_fkey";

-- DropForeignKey
ALTER TABLE "ResearchSurveyComment" DROP CONSTRAINT "ResearchSurveyComment_parentId_fkey";

-- DropForeignKey
ALTER TABLE "ResearchSurveyComment" DROP CONSTRAINT "ResearchSurveyComment_researchSurveyId_fkey";

-- DropForeignKey
ALTER TABLE "ResearchSurveyCommentVote" DROP CONSTRAINT "ResearchSurveyCommentVote_commentId_fkey";

-- DropForeignKey
ALTER TABLE "ResearchSurveyCommentVote" DROP CONSTRAINT "ResearchSurveyCommentVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "ResearchSurveyQuestion" DROP CONSTRAINT "ResearchSurveyQuestion_researchSurveyId_fkey";

-- DropForeignKey
ALTER TABLE "ResearchSurveyQuestionOption" DROP CONSTRAINT "ResearchSurveyQuestionOption_questionId_fkey";

-- DropForeignKey
ALTER TABLE "ResearchSurveyResponse" DROP CONSTRAINT "ResearchSurveyResponse_researchSurveyId_fkey";

-- DropForeignKey
ALTER TABLE "ResearchSurveyResponse" DROP CONSTRAINT "ResearchSurveyResponse_respondentId_fkey";

-- DropForeignKey
ALTER TABLE "ResearchSurveyVote" DROP CONSTRAINT "ResearchSurveyVote_researchSurveyId_fkey";

-- DropForeignKey
ALTER TABLE "ResearchSurveyVote" DROP CONSTRAINT "ResearchSurveyVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "ResearchTool" DROP CONSTRAINT "ResearchTool_authorId_fkey";

-- DropForeignKey
ALTER TABLE "ResearchToolCommentVote" DROP CONSTRAINT "ResearchToolCommentVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "ResearchToolVote" DROP CONSTRAINT "ResearchToolVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "Result" DROP CONSTRAINT "Result_authorId_fkey";

-- DropForeignKey
ALTER TABLE "ResultCommentVote" DROP CONSTRAINT "ResultCommentVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "ResultVote" DROP CONSTRAINT "ResultVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "SocialCommentVote" DROP CONSTRAINT "SocialCommentVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "SocialPost" DROP CONSTRAINT "SocialPost_authorId_fkey";

-- DropForeignKey
ALTER TABLE "SocialVote" DROP CONSTRAINT "SocialVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "SupervisorCommentVote" DROP CONSTRAINT "SupervisorCommentVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "SupervisorVote" DROP CONSTRAINT "SupervisorVote_userId_fkey";

-- DropIndex
DROP INDEX "ConversationParticipant_conversationId_userId_key";

-- DropIndex
DROP INDEX "Message_conversationId_createdAt_idx";

-- DropIndex
DROP INDEX "Message_recipientId_createdAt_idx";

-- DropIndex
DROP INDEX "Message_senderId_createdAt_idx";

-- AlterTable
ALTER TABLE "ArticleComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "ContributionComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "ConversationParticipant" DROP COLUMN "role";

-- AlterTable
ALTER TABLE "CourseComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "HelpPostComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "JobVacancyComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "JournalComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "isDeleted",
DROP COLUMN "recipientId";

-- AlterTable
ALTER TABLE "PhdAdmissionComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "PublicationComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "Recommendation" ADD COLUMN     "isAnonymous" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RecommendationComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "ResearchEventComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "ResearchGrantComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "ResearchSurvey" DROP COLUMN "privacy",
ADD COLUMN     "privacy" "SurveyPrivacy" NOT NULL DEFAULT 'HYBRID',
DROP COLUMN "status",
ADD COLUMN     "status" "SurveyStatus" NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "ResearchToolComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "ResultComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "SocialComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "SupervisorComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "emailDomain",
DROP COLUMN "emailVerified",
DROP COLUMN "image",
DROP COLUMN "password";

-- DropTable
DROP TABLE "ResearchSurveyAnswer";

-- DropTable
DROP TABLE "ResearchSurveyComment";

-- DropTable
DROP TABLE "ResearchSurveyCommentVote";

-- DropTable
DROP TABLE "ResearchSurveyQuestion";

-- DropTable
DROP TABLE "ResearchSurveyQuestionOption";

-- DropTable
DROP TABLE "ResearchSurveyResponse";

-- DropTable
DROP TABLE "ResearchSurveyVote";

-- DropEnum
DROP TYPE "ResearchSurveyPrivacy";

-- DropEnum
DROP TYPE "ResearchSurveyQuestionType";

-- DropEnum
DROP TYPE "ResearchSurveyStatus";

-- CreateTable
CREATE TABLE "SurveyQuestion" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "type" "SurveyQuestionType" NOT NULL,
    "title" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "minValue" INTEGER,
    "maxValue" INTEGER,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyQuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyQuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "respondentId" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyAnswer" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "SurveyAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyVote" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,

    CONSTRAINT "SurveyComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SurveyVote_surveyId_voteType_idx" ON "SurveyVote"("surveyId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyVote_surveyId_userId_key" ON "SurveyVote"("surveyId", "userId");

-- CreateIndex
CREATE INDEX "SurveyComment_surveyId_createdAt_idx" ON "SurveyComment"("surveyId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SurveyCommentVote_commentId_voteType_idx" ON "SurveyCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyCommentVote_commentId_userId_key" ON "SurveyCommentVote"("commentId", "userId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_createdAt_idx" ON "Message"("senderId", "createdAt");

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleVote" ADD CONSTRAINT "ArticleVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleCommentVote" ADD CONSTRAINT "ArticleCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialCommentVote" ADD CONSTRAINT "SocialCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialVote" ADD CONSTRAINT "SocialVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpPostVote" ADD CONSTRAINT "HelpPostVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpPostCommentVote" ADD CONSTRAINT "HelpPostCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionVote" ADD CONSTRAINT "ContributionVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionCommentVote" ADD CONSTRAINT "ContributionCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationVote" ADD CONSTRAINT "PublicationVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationCommentVote" ADD CONSTRAINT "PublicationCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchTool" ADD CONSTRAINT "ResearchTool_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchToolVote" ADD CONSTRAINT "ResearchToolVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchToolCommentVote" ADD CONSTRAINT "ResearchToolCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchGrant" ADD CONSTRAINT "ResearchGrant_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchGrantVote" ADD CONSTRAINT "ResearchGrantVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchGrantCommentVote" ADD CONSTRAINT "ResearchGrantCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseVote" ADD CONSTRAINT "CourseVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCommentVote" ADD CONSTRAINT "CourseCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Journal" ADD CONSTRAINT "Journal_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalVote" ADD CONSTRAINT "JournalVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalCommentVote" ADD CONSTRAINT "JournalCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultVote" ADD CONSTRAINT "ResultVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultCommentVote" ADD CONSTRAINT "ResultCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyQuestion" ADD CONSTRAINT "SurveyQuestion_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "ResearchSurvey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyQuestionOption" ADD CONSTRAINT "SurveyQuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "SurveyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "ResearchSurvey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyAnswer" ADD CONSTRAINT "SurveyAnswer_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "SurveyResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyAnswer" ADD CONSTRAINT "SurveyAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "SurveyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyVote" ADD CONSTRAINT "SurveyVote_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "ResearchSurvey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyVote" ADD CONSTRAINT "SurveyVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyComment" ADD CONSTRAINT "SurveyComment_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "ResearchSurvey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyComment" ADD CONSTRAINT "SurveyComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyComment" ADD CONSTRAINT "SurveyComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SurveyComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyCommentVote" ADD CONSTRAINT "SurveyCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "SurveyComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyCommentVote" ADD CONSTRAINT "SurveyCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follows" ADD CONSTRAINT "Follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follows" ADD CONSTRAINT "Follows_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchEvent" ADD CONSTRAINT "ResearchEvent_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchEventVote" ADD CONSTRAINT "ResearchEventVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchEventCommentVote" ADD CONSTRAINT "ResearchEventCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhdAdmission" ADD CONSTRAINT "PhdAdmission_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhdAdmissionVote" ADD CONSTRAINT "PhdAdmissionVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhdAdmissionCommentVote" ADD CONSTRAINT "PhdAdmissionCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobVacancy" ADD CONSTRAINT "JobVacancy_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobVacancyVote" ADD CONSTRAINT "JobVacancyVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobVacancyCommentVote" ADD CONSTRAINT "JobVacancyCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisorVote" ADD CONSTRAINT "SupervisorVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisorCommentVote" ADD CONSTRAINT "SupervisorCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationVote" ADD CONSTRAINT "RecommendationVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationCommentVote" ADD CONSTRAINT "RecommendationCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
