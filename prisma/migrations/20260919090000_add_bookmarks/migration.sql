ALTER TABLE "Article" ADD COLUMN "totalBookmarks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Supervisor" ADD COLUMN "totalBookmarks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SocialPost" ADD COLUMN "totalBookmarks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "HelpPost" ADD COLUMN "totalBookmarks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Contribution" ADD COLUMN "totalBookmarks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Publication" ADD COLUMN "totalBookmarks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ResearchTool" ADD COLUMN "totalBookmarks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ResearchGrant" ADD COLUMN "totalBookmarks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Course" ADD COLUMN "totalBookmarks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Journal" ADD COLUMN "totalBookmarks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Result" ADD COLUMN "totalBookmarks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ResearchSurvey" ADD COLUMN "totalBookmarks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ResearchEvent" ADD COLUMN "totalBookmarks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PhdAdmission" ADD COLUMN "totalBookmarks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "JobVacancy" ADD COLUMN "totalBookmarks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Recommendation" ADD COLUMN "totalBookmarks" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ArticleBookmark" (
  "id" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArticleBookmark_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupervisorBookmark" (
  "id" TEXT NOT NULL,
  "supervisorId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupervisorBookmark_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialPostBookmark" (
  "id" TEXT NOT NULL,
  "socialPostId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialPostBookmark_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HelpPostBookmark" (
  "id" TEXT NOT NULL,
  "helpPostId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HelpPostBookmark_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContributionBookmark" (
  "id" TEXT NOT NULL,
  "contributionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContributionBookmark_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublicationBookmark" (
  "id" TEXT NOT NULL,
  "publicationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicationBookmark_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchToolBookmark" (
  "id" TEXT NOT NULL,
  "researchToolId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResearchToolBookmark_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchGrantBookmark" (
  "id" TEXT NOT NULL,
  "researchGrantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResearchGrantBookmark_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseBookmark" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseBookmark_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JournalBookmark" (
  "id" TEXT NOT NULL,
  "journalId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JournalBookmark_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResultBookmark" (
  "id" TEXT NOT NULL,
  "resultId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResultBookmark_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SurveyBookmark" (
  "id" TEXT NOT NULL,
  "surveyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SurveyBookmark_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchEventBookmark" (
  "id" TEXT NOT NULL,
  "researchEventId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResearchEventBookmark_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PhdAdmissionBookmark" (
  "id" TEXT NOT NULL,
  "phdAdmissionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PhdAdmissionBookmark_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobVacancyBookmark" (
  "id" TEXT NOT NULL,
  "jobVacancyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobVacancyBookmark_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecommendationBookmark" (
  "id" TEXT NOT NULL,
  "recommendationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecommendationBookmark_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArticleBookmark_articleId_userId_key" ON "ArticleBookmark"("articleId", "userId");
CREATE UNIQUE INDEX "SupervisorBookmark_supervisorId_userId_key" ON "SupervisorBookmark"("supervisorId", "userId");
CREATE UNIQUE INDEX "SocialPostBookmark_socialPostId_userId_key" ON "SocialPostBookmark"("socialPostId", "userId");
CREATE UNIQUE INDEX "HelpPostBookmark_helpPostId_userId_key" ON "HelpPostBookmark"("helpPostId", "userId");
CREATE UNIQUE INDEX "ContributionBookmark_contributionId_userId_key" ON "ContributionBookmark"("contributionId", "userId");
CREATE UNIQUE INDEX "PublicationBookmark_publicationId_userId_key" ON "PublicationBookmark"("publicationId", "userId");
CREATE UNIQUE INDEX "ResearchToolBookmark_researchToolId_userId_key" ON "ResearchToolBookmark"("researchToolId", "userId");
CREATE UNIQUE INDEX "ResearchGrantBookmark_researchGrantId_userId_key" ON "ResearchGrantBookmark"("researchGrantId", "userId");
CREATE UNIQUE INDEX "CourseBookmark_courseId_userId_key" ON "CourseBookmark"("courseId", "userId");
CREATE UNIQUE INDEX "JournalBookmark_journalId_userId_key" ON "JournalBookmark"("journalId", "userId");
CREATE UNIQUE INDEX "ResultBookmark_resultId_userId_key" ON "ResultBookmark"("resultId", "userId");
CREATE UNIQUE INDEX "SurveyBookmark_surveyId_userId_key" ON "SurveyBookmark"("surveyId", "userId");
CREATE UNIQUE INDEX "ResearchEventBookmark_researchEventId_userId_key" ON "ResearchEventBookmark"("researchEventId", "userId");
CREATE UNIQUE INDEX "PhdAdmissionBookmark_phdAdmissionId_userId_key" ON "PhdAdmissionBookmark"("phdAdmissionId", "userId");
CREATE UNIQUE INDEX "JobVacancyBookmark_jobVacancyId_userId_key" ON "JobVacancyBookmark"("jobVacancyId", "userId");
CREATE UNIQUE INDEX "RecommendationBookmark_recommendationId_userId_key" ON "RecommendationBookmark"("recommendationId", "userId");

CREATE INDEX "ArticleBookmark_userId_createdAt_idx" ON "ArticleBookmark"("userId", "createdAt" DESC);
CREATE INDEX "SupervisorBookmark_userId_createdAt_idx" ON "SupervisorBookmark"("userId", "createdAt" DESC);
CREATE INDEX "SocialPostBookmark_userId_createdAt_idx" ON "SocialPostBookmark"("userId", "createdAt" DESC);
CREATE INDEX "HelpPostBookmark_userId_createdAt_idx" ON "HelpPostBookmark"("userId", "createdAt" DESC);
CREATE INDEX "ContributionBookmark_userId_createdAt_idx" ON "ContributionBookmark"("userId", "createdAt" DESC);
CREATE INDEX "PublicationBookmark_userId_createdAt_idx" ON "PublicationBookmark"("userId", "createdAt" DESC);
CREATE INDEX "ResearchToolBookmark_userId_createdAt_idx" ON "ResearchToolBookmark"("userId", "createdAt" DESC);
CREATE INDEX "ResearchGrantBookmark_userId_createdAt_idx" ON "ResearchGrantBookmark"("userId", "createdAt" DESC);
CREATE INDEX "CourseBookmark_userId_createdAt_idx" ON "CourseBookmark"("userId", "createdAt" DESC);
CREATE INDEX "JournalBookmark_userId_createdAt_idx" ON "JournalBookmark"("userId", "createdAt" DESC);
CREATE INDEX "ResultBookmark_userId_createdAt_idx" ON "ResultBookmark"("userId", "createdAt" DESC);
CREATE INDEX "SurveyBookmark_userId_createdAt_idx" ON "SurveyBookmark"("userId", "createdAt" DESC);
CREATE INDEX "ResearchEventBookmark_userId_createdAt_idx" ON "ResearchEventBookmark"("userId", "createdAt" DESC);
CREATE INDEX "PhdAdmissionBookmark_userId_createdAt_idx" ON "PhdAdmissionBookmark"("userId", "createdAt" DESC);
CREATE INDEX "JobVacancyBookmark_userId_createdAt_idx" ON "JobVacancyBookmark"("userId", "createdAt" DESC);
CREATE INDEX "RecommendationBookmark_userId_createdAt_idx" ON "RecommendationBookmark"("userId", "createdAt" DESC);

ALTER TABLE "ArticleBookmark" ADD CONSTRAINT "ArticleBookmark_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArticleBookmark" ADD CONSTRAINT "ArticleBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupervisorBookmark" ADD CONSTRAINT "SupervisorBookmark_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Supervisor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupervisorBookmark" ADD CONSTRAINT "SupervisorBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialPostBookmark" ADD CONSTRAINT "SocialPostBookmark_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialPostBookmark" ADD CONSTRAINT "SocialPostBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HelpPostBookmark" ADD CONSTRAINT "HelpPostBookmark_helpPostId_fkey" FOREIGN KEY ("helpPostId") REFERENCES "HelpPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HelpPostBookmark" ADD CONSTRAINT "HelpPostBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContributionBookmark" ADD CONSTRAINT "ContributionBookmark_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "Contribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContributionBookmark" ADD CONSTRAINT "ContributionBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationBookmark" ADD CONSTRAINT "PublicationBookmark_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationBookmark" ADD CONSTRAINT "PublicationBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchToolBookmark" ADD CONSTRAINT "ResearchToolBookmark_researchToolId_fkey" FOREIGN KEY ("researchToolId") REFERENCES "ResearchTool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchToolBookmark" ADD CONSTRAINT "ResearchToolBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchGrantBookmark" ADD CONSTRAINT "ResearchGrantBookmark_researchGrantId_fkey" FOREIGN KEY ("researchGrantId") REFERENCES "ResearchGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchGrantBookmark" ADD CONSTRAINT "ResearchGrantBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseBookmark" ADD CONSTRAINT "CourseBookmark_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseBookmark" ADD CONSTRAINT "CourseBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JournalBookmark" ADD CONSTRAINT "JournalBookmark_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JournalBookmark" ADD CONSTRAINT "JournalBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResultBookmark" ADD CONSTRAINT "ResultBookmark_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResultBookmark" ADD CONSTRAINT "ResultBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveyBookmark" ADD CONSTRAINT "SurveyBookmark_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "ResearchSurvey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveyBookmark" ADD CONSTRAINT "SurveyBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchEventBookmark" ADD CONSTRAINT "ResearchEventBookmark_researchEventId_fkey" FOREIGN KEY ("researchEventId") REFERENCES "ResearchEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchEventBookmark" ADD CONSTRAINT "ResearchEventBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhdAdmissionBookmark" ADD CONSTRAINT "PhdAdmissionBookmark_phdAdmissionId_fkey" FOREIGN KEY ("phdAdmissionId") REFERENCES "PhdAdmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhdAdmissionBookmark" ADD CONSTRAINT "PhdAdmissionBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobVacancyBookmark" ADD CONSTRAINT "JobVacancyBookmark_jobVacancyId_fkey" FOREIGN KEY ("jobVacancyId") REFERENCES "JobVacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobVacancyBookmark" ADD CONSTRAINT "JobVacancyBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationBookmark" ADD CONSTRAINT "RecommendationBookmark_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationBookmark" ADD CONSTRAINT "RecommendationBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
