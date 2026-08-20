/*
  Warnings:

  - You are about to drop the column `mentions` on the `ArticleComment` table. All the data in the column will be lost.
  - You are about to drop the column `content` on the `Contribution` table. All the data in the column will be lost.
  - You are about to drop the column `mentions` on the `ContributionComment` table. All the data in the column will be lost.
  - The primary key for the `ConversationParticipant` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `ConversationParticipant` table. All the data in the column will be lost.
  - You are about to drop the column `code` on the `Course` table. All the data in the column will be lost.
  - You are about to drop the column `mentions` on the `CourseComment` table. All the data in the column will be lost.
  - You are about to drop the column `content` on the `HelpPost` table. All the data in the column will be lost.
  - You are about to drop the column `mentions` on the `HelpPostComment` table. All the data in the column will be lost.
  - You are about to drop the column `mentions` on the `JobVacancyComment` table. All the data in the column will be lost.
  - You are about to drop the column `mentions` on the `JournalComment` table. All the data in the column will be lost.
  - You are about to drop the column `content` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `read` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `isRead` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `message` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `relatedId` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `programName` on the `PhdAdmission` table. All the data in the column will be lost.
  - You are about to drop the column `mentions` on the `PhdAdmissionComment` table. All the data in the column will be lost.
  - You are about to drop the column `mentions` on the `PublicationComment` table. All the data in the column will be lost.
  - You are about to drop the column `content` on the `Recommendation` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Recommendation` table. All the data in the column will be lost.
  - You are about to drop the column `mentions` on the `RecommendationComment` table. All the data in the column will be lost.
  - You are about to drop the column `eventDate` on the `ResearchEvent` table. All the data in the column will be lost.
  - You are about to drop the column `mentions` on the `ResearchEventComment` table. All the data in the column will be lost.
  - You are about to drop the column `institution` on the `ResearchGrant` table. All the data in the column will be lost.
  - You are about to drop the column `mentions` on the `ResearchGrantComment` table. All the data in the column will be lost.
  - The `status` column on the `ResearchSurvey` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `mentions` on the `ResearchSurveyComment` table. All the data in the column will be lost.
  - You are about to drop the column `mentions` on the `ResearchToolComment` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `Result` table. All the data in the column will be lost.
  - You are about to drop the column `mentions` on the `ResultComment` table. All the data in the column will be lost.
  - You are about to drop the column `mentions` on the `SocialComment` table. All the data in the column will be lost.
  - You are about to drop the column `mentions` on the `SupervisorComment` table. All the data in the column will be lost.
  - You are about to drop the `Follow` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SurveyComment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SurveyCommentVote` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SurveyQuestion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SurveyQuestionOption` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SurveyResponse` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SurveyVote` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[authorId,supervisorId]` on the table `Recommendation` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[handle]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `message` to the `Contribution` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdById` to the `Conversation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Conversation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ConversationParticipant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `link` to the `Course` table without a default value. This is not possible if the table is not empty.
  - Made the column `description` on table `Course` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `category` to the `HelpPost` table without a default value. This is not possible if the table is not empty.
  - Added the required column `message` to the `HelpPost` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subject` to the `HelpPost` table without a default value. This is not possible if the table is not empty.
  - Added the required column `body` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `actorId` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `body` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recipientId` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `description` to the `PhdAdmission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `university` to the `PhdAdmission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `authors` to the `Publication` table without a default value. This is not possible if the table is not empty.
  - Added the required column `feedback` to the `Recommendation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `guidanceScore` to the `Recommendation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rating` to the `Recommendation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `responsivenessScore` to the `Recommendation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `supervisorId` to the `Recommendation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `turnaroundTimeDays` to the `Recommendation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `date` to the `ResearchEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `location` to the `ResearchEvent` table without a default value. This is not possible if the table is not empty.
  - Made the column `description` on table `ResearchEvent` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `description` to the `ResearchGrant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `use` to the `ResearchTool` table without a default value. This is not possible if the table is not empty.
  - Added the required column `website` to the `ResearchTool` table without a default value. This is not possible if the table is not empty.
  - Made the column `description` on table `ResearchTool` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `description` to the `Result` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Result` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ResearchSurveyQuestionType" AS ENUM ('SHORT_TEXT', 'LONG_TEXT', 'MULTIPLE_CHOICE', 'CHECKBOXES', 'DROPDOWN', 'RATING', 'LINEAR_SCALE', 'DATE', 'LIKERT_SCALE');

-- CreateEnum
CREATE TYPE "ResearchSurveyPrivacy" AS ENUM ('ANONYMOUS', 'NON_ANONYMOUS', 'HYBRID');

-- CreateEnum
CREATE TYPE "ResearchSurveyStatus" AS ENUM ('OPEN', 'CLOSED');

-- DropForeignKey
ALTER TABLE "ArticleComment" DROP CONSTRAINT "ArticleComment_parentId_fkey";

-- DropForeignKey
ALTER TABLE "ContributionComment" DROP CONSTRAINT "ContributionComment_parentId_fkey";

-- DropForeignKey
ALTER TABLE "CourseComment" DROP CONSTRAINT "CourseComment_parentId_fkey";

-- DropForeignKey
ALTER TABLE "Follow" DROP CONSTRAINT "Follow_followerId_fkey";

-- DropForeignKey
ALTER TABLE "Follow" DROP CONSTRAINT "Follow_followingId_fkey";

-- DropForeignKey
ALTER TABLE "HelpPostComment" DROP CONSTRAINT "HelpPostComment_parentId_fkey";

-- DropForeignKey
ALTER TABLE "JobVacancyComment" DROP CONSTRAINT "JobVacancyComment_parentId_fkey";

-- DropForeignKey
ALTER TABLE "JournalComment" DROP CONSTRAINT "JournalComment_parentId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_userId_fkey";

-- DropForeignKey
ALTER TABLE "PhdAdmissionComment" DROP CONSTRAINT "PhdAdmissionComment_parentId_fkey";

-- DropForeignKey
ALTER TABLE "PublicationComment" DROP CONSTRAINT "PublicationComment_parentId_fkey";

-- DropForeignKey
ALTER TABLE "RecommendationComment" DROP CONSTRAINT "RecommendationComment_parentId_fkey";

-- DropForeignKey
ALTER TABLE "ResearchEventComment" DROP CONSTRAINT "ResearchEventComment_parentId_fkey";

-- DropForeignKey
ALTER TABLE "ResearchGrantComment" DROP CONSTRAINT "ResearchGrantComment_parentId_fkey";

-- DropForeignKey
ALTER TABLE "ResearchSurveyComment" DROP CONSTRAINT "ResearchSurveyComment_parentId_fkey";

-- DropForeignKey
ALTER TABLE "ResearchToolComment" DROP CONSTRAINT "ResearchToolComment_parentId_fkey";

-- DropForeignKey
ALTER TABLE "ResultComment" DROP CONSTRAINT "ResultComment_parentId_fkey";

-- DropForeignKey
ALTER TABLE "SocialComment" DROP CONSTRAINT "SocialComment_parentId_fkey";

-- DropForeignKey
ALTER TABLE "SupervisorComment" DROP CONSTRAINT "SupervisorComment_parentId_fkey";

-- DropForeignKey
ALTER TABLE "SurveyComment" DROP CONSTRAINT "SurveyComment_authorId_fkey";

-- DropForeignKey
ALTER TABLE "SurveyComment" DROP CONSTRAINT "SurveyComment_parentId_fkey";

-- DropForeignKey
ALTER TABLE "SurveyComment" DROP CONSTRAINT "SurveyComment_surveyResponseId_fkey";

-- DropForeignKey
ALTER TABLE "SurveyCommentVote" DROP CONSTRAINT "SurveyCommentVote_commentId_fkey";

-- DropForeignKey
ALTER TABLE "SurveyCommentVote" DROP CONSTRAINT "SurveyCommentVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "SurveyQuestion" DROP CONSTRAINT "SurveyQuestion_surveyId_fkey";

-- DropForeignKey
ALTER TABLE "SurveyQuestionOption" DROP CONSTRAINT "SurveyQuestionOption_questionId_fkey";

-- DropForeignKey
ALTER TABLE "SurveyResponse" DROP CONSTRAINT "SurveyResponse_questionId_fkey";

-- DropForeignKey
ALTER TABLE "SurveyResponse" DROP CONSTRAINT "SurveyResponse_surveyId_fkey";

-- DropForeignKey
ALTER TABLE "SurveyResponse" DROP CONSTRAINT "SurveyResponse_userId_fkey";

-- DropForeignKey
ALTER TABLE "SurveyVote" DROP CONSTRAINT "SurveyVote_surveyResponseId_fkey";

-- DropForeignKey
ALTER TABLE "SurveyVote" DROP CONSTRAINT "SurveyVote_userId_fkey";

-- DropIndex
DROP INDEX "Notification_userId_isRead_createdAt_idx";

-- AlterTable
ALTER TABLE "ArticleComment" DROP COLUMN "mentions";

-- AlterTable
ALTER TABLE "Contribution" DROP COLUMN "content",
ADD COLUMN     "amount" DOUBLE PRECISION,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "message" TEXT NOT NULL,
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "screenshotUrl" TEXT,
ADD COLUMN     "upiId" TEXT;

-- AlterTable
ALTER TABLE "ContributionComment" DROP COLUMN "mentions";

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "type" SET DEFAULT 'DIRECT';

-- AlterTable
ALTER TABLE "ConversationParticipant" DROP CONSTRAINT "ConversationParticipant_pkey",
DROP COLUMN "id",
ADD COLUMN     "lastReadAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("conversationId", "userId");

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "code",
ADD COLUMN     "duration" TEXT,
ADD COLUMN     "format" TEXT,
ADD COLUMN     "instructor" TEXT,
ADD COLUMN     "level" TEXT,
ADD COLUMN     "link" TEXT NOT NULL,
ADD COLUMN     "price" TEXT,
ADD COLUMN     "provider" TEXT,
ALTER COLUMN "description" SET NOT NULL;

-- AlterTable
ALTER TABLE "CourseComment" DROP COLUMN "mentions";

-- AlterTable
ALTER TABLE "HelpPost" DROP COLUMN "content",
ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "message" TEXT NOT NULL,
ADD COLUMN     "subject" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "HelpPostComment" DROP COLUMN "mentions";

-- AlterTable
ALTER TABLE "JobVacancy" ADD COLUMN     "applyLink" TEXT,
ADD COLUMN     "notificationLink" TEXT;

-- AlterTable
ALTER TABLE "JobVacancyComment" DROP COLUMN "mentions";

-- AlterTable
ALTER TABLE "Journal" ADD COLUMN     "abdcCategory" TEXT,
ADD COLUMN     "about" TEXT,
ADD COLUMN     "impactFactor" DOUBLE PRECISION,
ADD COLUMN     "publisher" TEXT,
ADD COLUMN     "scopus" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "JournalComment" DROP COLUMN "mentions";

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "content",
DROP COLUMN "read",
ADD COLUMN     "body" TEXT NOT NULL,
ADD COLUMN     "readAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "isRead",
DROP COLUMN "message",
DROP COLUMN "relatedId",
DROP COLUMN "userId",
ADD COLUMN     "actorId" TEXT NOT NULL,
ADD COLUMN     "body" TEXT NOT NULL,
ADD COLUMN     "readAt" TIMESTAMP(3),
ADD COLUMN     "recipientId" TEXT NOT NULL,
ADD COLUMN     "targetId" TEXT,
ADD COLUMN     "targetType" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "PhdAdmission" DROP COLUMN "programName",
ADD COLUMN     "applyLink" TEXT,
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "notificationLink" TEXT,
ADD COLUMN     "university" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PhdAdmissionComment" DROP COLUMN "mentions";

-- AlterTable
ALTER TABLE "Publication" ADD COLUMN     "abstract" TEXT,
ADD COLUMN     "authors" TEXT NOT NULL,
ADD COLUMN     "doi" TEXT,
ADD COLUMN     "domain" TEXT,
ADD COLUMN     "isUserAuthor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isbn" TEXT,
ADD COLUMN     "issue" TEXT,
ADD COLUMN     "journalOrConference" TEXT,
ADD COLUMN     "keywords" TEXT,
ADD COLUMN     "pages" TEXT,
ADD COLUMN     "publisher" TEXT,
ADD COLUMN     "url" TEXT,
ADD COLUMN     "volume" TEXT,
ADD COLUMN     "year" INTEGER,
ALTER COLUMN "publicationType" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PublicationComment" DROP COLUMN "mentions";

-- AlterTable
ALTER TABLE "Recommendation" DROP COLUMN "content",
DROP COLUMN "title",
ADD COLUMN     "feedback" TEXT NOT NULL,
ADD COLUMN     "guidanceScore" INTEGER NOT NULL,
ADD COLUMN     "rating" INTEGER NOT NULL,
ADD COLUMN     "responsivenessScore" INTEGER NOT NULL,
ADD COLUMN     "supervisorId" TEXT NOT NULL,
ADD COLUMN     "turnaroundTimeDays" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "RecommendationComment" DROP COLUMN "mentions";

-- AlterTable
ALTER TABLE "ResearchEvent" DROP COLUMN "eventDate",
ADD COLUMN     "applyLink" TEXT,
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "deadline" TIMESTAMP(3),
ADD COLUMN     "location" TEXT NOT NULL,
ADD COLUMN     "notificationLink" TEXT,
ALTER COLUMN "description" SET NOT NULL;

-- AlterTable
ALTER TABLE "ResearchEventComment" DROP COLUMN "mentions";

-- AlterTable
ALTER TABLE "ResearchGrant" DROP COLUMN "institution",
ADD COLUMN     "applyLink" TEXT,
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "infoLink" TEXT,
ALTER COLUMN "amount" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "ResearchGrantComment" DROP COLUMN "mentions";

-- AlterTable
ALTER TABLE "ResearchSurvey" ADD COLUMN     "privacy" "ResearchSurveyPrivacy" NOT NULL DEFAULT 'HYBRID',
ADD COLUMN     "shareData" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "status",
ADD COLUMN     "status" "ResearchSurveyStatus" NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "ResearchSurveyComment" DROP COLUMN "mentions";

-- AlterTable
ALTER TABLE "ResearchTool" ADD COLUMN     "use" TEXT NOT NULL,
ADD COLUMN     "website" TEXT NOT NULL,
ALTER COLUMN "description" SET NOT NULL;

-- AlterTable
ALTER TABLE "ResearchToolComment" DROP COLUMN "mentions";

-- AlterTable
ALTER TABLE "Result" DROP COLUMN "value",
ADD COLUMN     "category" TEXT,
ADD COLUMN     "conductingBody" TEXT,
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "notificationLink" TEXT,
ADD COLUMN     "resultLink" TEXT,
ADD COLUMN     "session" TEXT,
ADD COLUMN     "type" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ResultComment" DROP COLUMN "mentions";

-- AlterTable
ALTER TABLE "SocialComment" DROP COLUMN "mentions";

-- AlterTable
ALTER TABLE "SupervisorComment" DROP COLUMN "mentions";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "githubUrl" TEXT,
ADD COLUMN     "googleScholarUrl" TEXT,
ADD COLUMN     "handle" TEXT,
ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isFrozen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "linkedinUrl" TEXT,
ADD COLUMN     "orcidUrl" TEXT,
ADD COLUMN     "reputation" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "Follow";

-- DropTable
DROP TABLE "SurveyComment";

-- DropTable
DROP TABLE "SurveyCommentVote";

-- DropTable
DROP TABLE "SurveyQuestion";

-- DropTable
DROP TABLE "SurveyQuestionOption";

-- DropTable
DROP TABLE "SurveyResponse";

-- DropTable
DROP TABLE "SurveyVote";

-- DropEnum
DROP TYPE "SurveyPrivacy";

-- DropEnum
DROP TYPE "SurveyQuestionType";

-- DropEnum
DROP TYPE "SurveyStatus";

-- CreateTable
CREATE TABLE "Follows" (
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follows_pkey" PRIMARY KEY ("followerId","followingId")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchSurveyQuestion" (
    "id" TEXT NOT NULL,
    "researchSurveyId" TEXT NOT NULL,
    "type" "ResearchSurveyQuestionType" NOT NULL,
    "title" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "minValue" INTEGER,
    "maxValue" INTEGER,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchSurveyQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchSurveyQuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchSurveyQuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchSurveyResponse" (
    "id" TEXT NOT NULL,
    "researchSurveyId" TEXT NOT NULL,
    "respondentId" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchSurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchSurveyAnswer" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "ResearchSurveyAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Follows_followerId_createdAt_idx" ON "Follows"("followerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Follows_followingId_createdAt_idx" ON "Follows"("followingId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Block_blockedId_idx" ON "Block"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "Block_blockerId_blockedId_key" ON "Block"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX "ArticleCommentVote_commentId_voteType_idx" ON "ArticleCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE INDEX "ArticleVote_articleId_voteType_idx" ON "ArticleVote"("articleId", "voteType");

-- CreateIndex
CREATE INDEX "ContributionCommentVote_commentId_voteType_idx" ON "ContributionCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE INDEX "ContributionVote_contributionId_voteType_idx" ON "ContributionVote"("contributionId", "voteType");

-- CreateIndex
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_createdById_lastMessageAt_idx" ON "Conversation"("createdById", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_lastReadAt_idx" ON "ConversationParticipant"("userId", "lastReadAt");

-- CreateIndex
CREATE INDEX "CourseCommentVote_commentId_voteType_idx" ON "CourseCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE INDEX "CourseVote_courseId_voteType_idx" ON "CourseVote"("courseId", "voteType");

-- CreateIndex
CREATE INDEX "HelpPostCommentVote_commentId_voteType_idx" ON "HelpPostCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE INDEX "HelpPostVote_helpPostId_voteType_idx" ON "HelpPostVote"("helpPostId", "voteType");

-- CreateIndex
CREATE INDEX "JobVacancyCommentVote_commentId_voteType_idx" ON "JobVacancyCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE INDEX "JobVacancyVote_jobVacancyId_voteType_idx" ON "JobVacancyVote"("jobVacancyId", "voteType");

-- CreateIndex
CREATE INDEX "JournalCommentVote_commentId_voteType_idx" ON "JournalCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE INDEX "JournalVote_journalId_voteType_idx" ON "JournalVote"("journalId", "voteType");

-- CreateIndex
CREATE INDEX "Notification_recipientId_createdAt_idx" ON "Notification"("recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_recipientId_readAt_idx" ON "Notification"("recipientId", "readAt");

-- CreateIndex
CREATE INDEX "PhdAdmissionCommentVote_commentId_voteType_idx" ON "PhdAdmissionCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE INDEX "PhdAdmissionVote_phdAdmissionId_voteType_idx" ON "PhdAdmissionVote"("phdAdmissionId", "voteType");

-- CreateIndex
CREATE INDEX "PublicationCommentVote_commentId_voteType_idx" ON "PublicationCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE INDEX "PublicationVote_publicationId_voteType_idx" ON "PublicationVote"("publicationId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "Recommendation_authorId_supervisorId_key" ON "Recommendation"("authorId", "supervisorId");

-- CreateIndex
CREATE INDEX "RecommendationCommentVote_commentId_voteType_idx" ON "RecommendationCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE INDEX "RecommendationVote_recommendationId_voteType_idx" ON "RecommendationVote"("recommendationId", "voteType");

-- CreateIndex
CREATE INDEX "ResearchEventCommentVote_commentId_voteType_idx" ON "ResearchEventCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE INDEX "ResearchEventVote_researchEventId_voteType_idx" ON "ResearchEventVote"("researchEventId", "voteType");

-- CreateIndex
CREATE INDEX "ResearchGrantCommentVote_commentId_voteType_idx" ON "ResearchGrantCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE INDEX "ResearchGrantVote_researchGrantId_voteType_idx" ON "ResearchGrantVote"("researchGrantId", "voteType");

-- CreateIndex
CREATE INDEX "ResearchSurveyCommentVote_commentId_voteType_idx" ON "ResearchSurveyCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE INDEX "ResearchSurveyVote_researchSurveyId_voteType_idx" ON "ResearchSurveyVote"("researchSurveyId", "voteType");

-- CreateIndex
CREATE INDEX "ResearchToolCommentVote_commentId_voteType_idx" ON "ResearchToolCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE INDEX "ResearchToolVote_researchToolId_voteType_idx" ON "ResearchToolVote"("researchToolId", "voteType");

-- CreateIndex
CREATE INDEX "ResultCommentVote_commentId_voteType_idx" ON "ResultCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE INDEX "ResultVote_resultId_voteType_idx" ON "ResultVote"("resultId", "voteType");

-- CreateIndex
CREATE INDEX "SocialCommentVote_commentId_voteType_idx" ON "SocialCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE INDEX "SocialVote_socialPostId_voteType_idx" ON "SocialVote"("socialPostId", "voteType");

-- CreateIndex
CREATE INDEX "SupervisorCommentVote_commentId_voteType_idx" ON "SupervisorCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE INDEX "SupervisorVote_supervisorId_voteType_idx" ON "SupervisorVote"("supervisorId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");

-- AddForeignKey
ALTER TABLE "Follows" ADD CONSTRAINT "Follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follows" ADD CONSTRAINT "Follows_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Supervisor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSurveyQuestion" ADD CONSTRAINT "ResearchSurveyQuestion_researchSurveyId_fkey" FOREIGN KEY ("researchSurveyId") REFERENCES "ResearchSurvey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSurveyQuestionOption" ADD CONSTRAINT "ResearchSurveyQuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ResearchSurveyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSurveyResponse" ADD CONSTRAINT "ResearchSurveyResponse_researchSurveyId_fkey" FOREIGN KEY ("researchSurveyId") REFERENCES "ResearchSurvey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSurveyResponse" ADD CONSTRAINT "ResearchSurveyResponse_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSurveyAnswer" ADD CONSTRAINT "ResearchSurveyAnswer_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "ResearchSurveyResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSurveyAnswer" ADD CONSTRAINT "ResearchSurveyAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ResearchSurveyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleComment" ADD CONSTRAINT "ArticleComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ArticleComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialComment" ADD CONSTRAINT "SocialComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SocialComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpPostComment" ADD CONSTRAINT "HelpPostComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "HelpPostComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionComment" ADD CONSTRAINT "ContributionComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ContributionComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationComment" ADD CONSTRAINT "PublicationComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PublicationComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchToolComment" ADD CONSTRAINT "ResearchToolComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ResearchToolComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchGrantComment" ADD CONSTRAINT "ResearchGrantComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ResearchGrantComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseComment" ADD CONSTRAINT "CourseComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CourseComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalComment" ADD CONSTRAINT "JournalComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "JournalComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultComment" ADD CONSTRAINT "ResultComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ResultComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchEventComment" ADD CONSTRAINT "ResearchEventComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ResearchEventComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhdAdmissionComment" ADD CONSTRAINT "PhdAdmissionComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PhdAdmissionComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobVacancyComment" ADD CONSTRAINT "JobVacancyComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "JobVacancyComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisorComment" ADD CONSTRAINT "SupervisorComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SupervisorComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationComment" ADD CONSTRAINT "RecommendationComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "RecommendationComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSurveyComment" ADD CONSTRAINT "ResearchSurveyComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ResearchSurveyComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
