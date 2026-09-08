-- DropIndex
DROP INDEX "Message_conversationId_createdAt_idx";

-- DropIndex
DROP INDEX "Notification_recipientId_readAt_idx";

-- CreateIndex
CREATE INDEX "Article_authorId_createdAt_idx" ON "Article"("authorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Contribution_authorId_createdAt_idx" ON "Contribution"("authorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Course_authorId_createdAt_idx" ON "Course"("authorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "HelpPost_authorId_createdAt_idx" ON "HelpPost"("authorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "JobVacancy_authorId_createdAt_idx" ON "JobVacancy"("authorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Journal_authorId_createdAt_idx" ON "Journal"("authorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_recipientId_readAt_createdAt_idx" ON "Notification"("recipientId", "readAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PhdAdmission_authorId_createdAt_idx" ON "PhdAdmission"("authorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Publication_authorId_createdAt_idx" ON "Publication"("authorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Recommendation_authorId_createdAt_idx" ON "Recommendation"("authorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ResearchEvent_authorId_createdAt_idx" ON "ResearchEvent"("authorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ResearchGrant_authorId_createdAt_idx" ON "ResearchGrant"("authorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ResearchSurvey_authorId_createdAt_idx" ON "ResearchSurvey"("authorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ResearchTool_authorId_createdAt_idx" ON "ResearchTool"("authorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Result_authorId_createdAt_idx" ON "Result"("authorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SocialPost_authorId_createdAt_idx" ON "SocialPost"("authorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Supervisor_authorId_createdAt_idx" ON "Supervisor"("authorId", "createdAt" DESC);
