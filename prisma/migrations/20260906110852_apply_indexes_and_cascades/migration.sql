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

-- DropForeignKey
ALTER TABLE "SurveyCommentVote" DROP CONSTRAINT "SurveyCommentVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "SurveyResponse" DROP CONSTRAINT "SurveyResponse_respondentId_fkey";

-- DropForeignKey
ALTER TABLE "SurveyVote" DROP CONSTRAINT "SurveyVote_userId_fkey";

-- DropIndex
DROP INDEX "ArticleCommentVote_commentId_voteType_idx";

-- DropIndex
DROP INDEX "ArticleVote_articleId_voteType_idx";

-- DropIndex
DROP INDEX "ContributionCommentVote_commentId_voteType_idx";

-- DropIndex
DROP INDEX "ContributionVote_contributionId_voteType_idx";

-- DropIndex
DROP INDEX "CourseCommentVote_commentId_voteType_idx";

-- DropIndex
DROP INDEX "CourseVote_courseId_voteType_idx";

-- DropIndex
DROP INDEX "HelpPostCommentVote_commentId_voteType_idx";

-- DropIndex
DROP INDEX "HelpPostVote_helpPostId_voteType_idx";

-- DropIndex
DROP INDEX "JobVacancyCommentVote_commentId_voteType_idx";

-- DropIndex
DROP INDEX "JobVacancyVote_jobVacancyId_voteType_idx";

-- DropIndex
DROP INDEX "JournalCommentVote_commentId_voteType_idx";

-- DropIndex
DROP INDEX "JournalVote_journalId_voteType_idx";

-- DropIndex
DROP INDEX "PhdAdmissionCommentVote_commentId_voteType_idx";

-- DropIndex
DROP INDEX "PhdAdmissionVote_phdAdmissionId_voteType_idx";

-- DropIndex
DROP INDEX "PublicationCommentVote_commentId_voteType_idx";

-- DropIndex
DROP INDEX "PublicationVote_publicationId_voteType_idx";

-- DropIndex
DROP INDEX "Recommendation_active_author_supervisor_unique";

-- DropIndex
DROP INDEX "RecommendationCommentVote_commentId_voteType_idx";

-- DropIndex
DROP INDEX "RecommendationVote_recommendationId_voteType_idx";

-- DropIndex
DROP INDEX "ResearchEventCommentVote_commentId_voteType_idx";

-- DropIndex
DROP INDEX "ResearchEventVote_researchEventId_voteType_idx";

-- DropIndex
DROP INDEX "ResearchGrantCommentVote_commentId_voteType_idx";

-- DropIndex
DROP INDEX "ResearchGrantVote_researchGrantId_voteType_idx";

-- DropIndex
DROP INDEX "ResearchToolCommentVote_commentId_voteType_idx";

-- DropIndex
DROP INDEX "ResearchToolVote_researchToolId_voteType_idx";

-- DropIndex
DROP INDEX "ResultCommentVote_commentId_voteType_idx";

-- DropIndex
DROP INDEX "ResultVote_resultId_voteType_idx";

-- DropIndex
DROP INDEX "SocialCommentVote_commentId_voteType_idx";

-- DropIndex
DROP INDEX "SocialVote_socialPostId_voteType_idx";

-- DropIndex
DROP INDEX "SupervisorCommentVote_commentId_voteType_idx";

-- DropIndex
DROP INDEX "SupervisorVote_supervisorId_voteType_idx";

-- DropIndex
DROP INDEX "SurveyCommentVote_commentId_voteType_idx";

-- DropIndex
DROP INDEX "SurveyVote_surveyId_voteType_idx";

-- CreateIndex
CREATE INDEX "Recommendation_supervisorId_isDeleted_createdAt_idx" ON "Recommendation"("supervisorId", "isDeleted", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Recommendation_supervisorId_authorId_idx" ON "Recommendation"("supervisorId", "authorId");

-- CreateIndex
CREATE INDEX "SurveyAnswer_responseId_idx" ON "SurveyAnswer"("responseId");

-- CreateIndex
CREATE INDEX "SurveyAnswer_questionId_idx" ON "SurveyAnswer"("questionId");

-- CreateIndex
CREATE INDEX "SurveyQuestion_surveyId_order_idx" ON "SurveyQuestion"("surveyId", "order" ASC);

-- CreateIndex
CREATE INDEX "SurveyQuestionOption_questionId_order_idx" ON "SurveyQuestionOption"("questionId", "order" ASC);

-- CreateIndex
CREATE INDEX "SurveyResponse_surveyId_respondentId_idx" ON "SurveyResponse"("surveyId", "respondentId");

-- CreateIndex
CREATE INDEX "SurveyResponse_surveyId_createdAt_idx" ON "SurveyResponse"("surveyId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "User_reputation_idx" ON "User"("reputation" DESC);

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleVote" ADD CONSTRAINT "ArticleVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleCommentVote" ADD CONSTRAINT "ArticleCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialCommentVote" ADD CONSTRAINT "SocialCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialVote" ADD CONSTRAINT "SocialVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpPostVote" ADD CONSTRAINT "HelpPostVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpPostCommentVote" ADD CONSTRAINT "HelpPostCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionVote" ADD CONSTRAINT "ContributionVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionCommentVote" ADD CONSTRAINT "ContributionCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationVote" ADD CONSTRAINT "PublicationVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationCommentVote" ADD CONSTRAINT "PublicationCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchTool" ADD CONSTRAINT "ResearchTool_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchToolVote" ADD CONSTRAINT "ResearchToolVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchToolCommentVote" ADD CONSTRAINT "ResearchToolCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchGrant" ADD CONSTRAINT "ResearchGrant_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchGrantVote" ADD CONSTRAINT "ResearchGrantVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchGrantCommentVote" ADD CONSTRAINT "ResearchGrantCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseVote" ADD CONSTRAINT "CourseVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCommentVote" ADD CONSTRAINT "CourseCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Journal" ADD CONSTRAINT "Journal_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalVote" ADD CONSTRAINT "JournalVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalCommentVote" ADD CONSTRAINT "JournalCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultVote" ADD CONSTRAINT "ResultVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultCommentVote" ADD CONSTRAINT "ResultCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyVote" ADD CONSTRAINT "SurveyVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyCommentVote" ADD CONSTRAINT "SurveyCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follows" ADD CONSTRAINT "Follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follows" ADD CONSTRAINT "Follows_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchEvent" ADD CONSTRAINT "ResearchEvent_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchEventVote" ADD CONSTRAINT "ResearchEventVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchEventCommentVote" ADD CONSTRAINT "ResearchEventCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhdAdmission" ADD CONSTRAINT "PhdAdmission_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhdAdmissionVote" ADD CONSTRAINT "PhdAdmissionVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhdAdmissionCommentVote" ADD CONSTRAINT "PhdAdmissionCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobVacancy" ADD CONSTRAINT "JobVacancy_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobVacancyVote" ADD CONSTRAINT "JobVacancyVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobVacancyCommentVote" ADD CONSTRAINT "JobVacancyCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisorVote" ADD CONSTRAINT "SupervisorVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisorCommentVote" ADD CONSTRAINT "SupervisorCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationVote" ADD CONSTRAINT "RecommendationVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationCommentVote" ADD CONSTRAINT "RecommendationCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
