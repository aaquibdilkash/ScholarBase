-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "VoteType" AS ENUM ('UPVOTE', 'DOWNVOTE');

-- CreateEnum
CREATE TYPE "ContributionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PublicationType" AS ENUM ('RESEARCH_PAPER', 'CONFERENCE_PROCEEDING', 'PREPRINT', 'BOOK', 'BOOK_CHAPTER', 'THESIS', 'TECHNICAL_REPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "Quartile" AS ENUM ('NONE', 'Q1', 'Q2', 'Q3', 'Q4');

-- CreateEnum
CREATE TYPE "WosIndex" AS ENUM ('NONE', 'SCIE', 'SSCI', 'AHCI', 'ESCI');

-- CreateEnum
CREATE TYPE "AbdcTier" AS ENUM ('NONE', 'A*', 'A', 'B', 'C');

-- CreateEnum
CREATE TYPE "OpenAccessStatus" AS ENUM ('CLOSED', 'HYBRID', 'GOLD', 'DIAMOND', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SurveyQuestionType" AS ENUM ('SHORT_TEXT', 'LONG_TEXT', 'MULTIPLE_CHOICE', 'CHECKBOXES', 'DROPDOWN', 'RATING', 'LINEAR_SCALE', 'DATE', 'LIKERT_SCALE');

-- CreateEnum
CREATE TYPE "SurveyPrivacy" AS ENUM ('ANONYMOUS', 'NON_ANONYMOUS', 'HYBRID');

-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('DIRECT');

-- CreateEnum
CREATE TYPE "DigestPreference" AS ENUM ('DAILY', 'WEEKLY', 'NEVER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'DISMISSED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'PLAGIARISM', 'MISINFORMATION', 'OFF_TOPIC', 'COPYRIGHT', 'OTHER');

-- CreateTable
CREATE TABLE "UserActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "moduleType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityTitle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "reportCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supervisor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "about" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "recommendationCount" INTEGER NOT NULL DEFAULT 0,
    "ratingSum" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "reportCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Supervisor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "imageUrls" TEXT[],
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "reportCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "authorId" TEXT,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,

    CONSTRAINT "ArticleComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleVote" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "socialPostId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "authorId" TEXT,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,

    CONSTRAINT "SocialComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialVote" (
    "id" TEXT NOT NULL,
    "socialPostId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT,
    "reporterId" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpPost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "authorId" TEXT NOT NULL,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "reportCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HelpPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpPostVote" (
    "id" TEXT NOT NULL,
    "helpPostId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelpPostVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpPostComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "helpPostId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "authorId" TEXT,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,

    CONSTRAINT "HelpPostComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpPostCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelpPostCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contribution" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "upiId" TEXT,
    "message" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "screenshotUrl" TEXT,
    "status" "ContributionStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "reportCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContributionVote" (
    "id" TEXT NOT NULL,
    "contributionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContributionVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContributionComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contributionId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "authorId" TEXT,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,

    CONSTRAINT "ContributionComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContributionCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContributionCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT NOT NULL,
    "publicationType" "PublicationType" NOT NULL,
    "journalOrConference" TEXT,
    "publisher" TEXT,
    "year" INTEGER,
    "volume" TEXT,
    "issue" TEXT,
    "pages" TEXT,
    "doi" TEXT,
    "isbn" TEXT,
    "url" TEXT,
    "keywords" TEXT,
    "domain" TEXT,
    "abstract" TEXT,
    "isUserAuthor" BOOLEAN NOT NULL DEFAULT false,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "reportCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicationVote" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicationVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicationComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "authorId" TEXT,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,

    CONSTRAINT "PublicationComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicationCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicationCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "handle" TEXT,
    "bio" TEXT,
    "githubUrl" TEXT,
    "orcidUrl" TEXT,
    "linkedinUrl" TEXT,
    "googleScholarUrl" TEXT,
    "reputation" INTEGER NOT NULL DEFAULT 0,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "followersCount" INTEGER NOT NULL DEFAULT 0,
    "followingCount" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "articleCount" INTEGER NOT NULL DEFAULT 0,
    "socialPostCount" INTEGER NOT NULL DEFAULT 0,
    "jobVacancyCount" INTEGER NOT NULL DEFAULT 0,
    "phdAdmissionCount" INTEGER NOT NULL DEFAULT 0,
    "researchEventCount" INTEGER NOT NULL DEFAULT 0,
    "helpPostCount" INTEGER NOT NULL DEFAULT 0,
    "journalCount" INTEGER NOT NULL DEFAULT 0,
    "researchToolCount" INTEGER NOT NULL DEFAULT 0,
    "recommendationCount" INTEGER NOT NULL DEFAULT 0,
    "supervisorCount" INTEGER NOT NULL DEFAULT 0,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "contributionCount" INTEGER NOT NULL DEFAULT 0,
    "publicationCount" INTEGER NOT NULL DEFAULT 0,
    "surveyCount" INTEGER NOT NULL DEFAULT 0,
    "researchGrantCount" INTEGER NOT NULL DEFAULT 0,
    "courseCount" INTEGER NOT NULL DEFAULT 0,
    "digestPreference" "DigestPreference" NOT NULL DEFAULT 'DAILY',
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "isEmailed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "type" "ConversationType" NOT NULL DEFAULT 'DIRECT',
    "createdById" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("conversationId","userId")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchTool" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "use" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "reportCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ResearchTool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchToolVote" (
    "id" TEXT NOT NULL,
    "researchToolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchToolVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchToolComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "researchToolId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "authorId" TEXT,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,

    CONSTRAINT "ResearchToolComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchToolCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchToolCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchGrant" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" TEXT,
    "description" TEXT NOT NULL,
    "applyLink" TEXT,
    "infoLink" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "reportCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ResearchGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchGrantVote" (
    "id" TEXT NOT NULL,
    "researchGrantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchGrantVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchGrantComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "researchGrantId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "authorId" TEXT,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,

    CONSTRAINT "ResearchGrantComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchGrantCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchGrantCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "provider" TEXT,
    "instructor" TEXT,
    "format" TEXT,
    "level" TEXT,
    "price" TEXT,
    "duration" TEXT,
    "link" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "reportCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseVote" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "authorId" TEXT,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,

    CONSTRAINT "CourseComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Journal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "issn" TEXT,
    "impactFactor" DOUBLE PRECISION,
    "scopusQuartile" "Quartile" NOT NULL DEFAULT 'NONE',
    "abdcRanking" "AbdcTier" NOT NULL DEFAULT 'NONE',
    "wosIndex" "WosIndex" NOT NULL DEFAULT 'NONE',
    "wosQuartile" "Quartile" NOT NULL DEFAULT 'NONE',
    "sjrQuartile" "Quartile" NOT NULL DEFAULT 'NONE',
    "sjrScore" DOUBLE PRECISION,
    "citeScore" DOUBLE PRECISION,
    "publisher" TEXT,
    "website" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "subjectArea" TEXT,
    "frequency" TEXT,
    "openAccess" "OpenAccessStatus" NOT NULL DEFAULT 'UNKNOWN',
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "about" TEXT,

    CONSTRAINT "Journal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalVote" (
    "id" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "authorId" TEXT,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,

    CONSTRAINT "JournalComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "conductingBody" TEXT,
    "session" TEXT,
    "notificationLink" TEXT,
    "resultLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "authorId" TEXT NOT NULL,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "reportCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultVote" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "authorId" TEXT,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,

    CONSTRAINT "ResultComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchSurvey" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "privacy" "SurveyPrivacy" NOT NULL DEFAULT 'HYBRID',
    "status" "SurveyStatus" NOT NULL DEFAULT 'OPEN',
    "shareData" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "totalResponses" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "reportCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ResearchSurvey_pkey" PRIMARY KEY ("id")
);

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
    "editedAt" TIMESTAMP(3),
    "totalAnswers" INTEGER NOT NULL DEFAULT 0,

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
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "SurveyQuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "respondentId" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyAnswer" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" JSONB NOT NULL,

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
    "editedAt" TIMESTAMP(3),
    "authorId" TEXT,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
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
CREATE TABLE "ResearchEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "notificationLink" TEXT,
    "applyLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "authorId" TEXT NOT NULL,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "reportCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ResearchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchEventVote" (
    "id" TEXT NOT NULL,
    "researchEventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchEventVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchEventComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "researchEventId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "authorId" TEXT,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,

    CONSTRAINT "ResearchEventComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchEventCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchEventCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhdAdmission" (
    "id" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "notificationLink" TEXT,
    "applyLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "authorId" TEXT NOT NULL,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "reportCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PhdAdmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhdAdmissionVote" (
    "id" TEXT NOT NULL,
    "phdAdmissionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhdAdmissionVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhdAdmissionComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "phdAdmissionId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "authorId" TEXT,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,

    CONSTRAINT "PhdAdmissionComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhdAdmissionCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhdAdmissionCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobVacancy" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "notificationLink" TEXT,
    "applyLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "authorId" TEXT NOT NULL,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "reportCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "JobVacancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobVacancyVote" (
    "id" TEXT NOT NULL,
    "jobVacancyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobVacancyVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobVacancyComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "jobVacancyId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "authorId" TEXT,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,

    CONSTRAINT "JobVacancyComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobVacancyCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobVacancyCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupervisorVote" (
    "id" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupervisorVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupervisorComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "authorId" TEXT,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,

    CONSTRAINT "SupervisorComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupervisorCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupervisorCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "feedback" TEXT NOT NULL,
    "turnaroundTimeDays" INTEGER NOT NULL,
    "responsivenessScore" INTEGER NOT NULL,
    "guidanceScore" INTEGER NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "supervisorId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "reportCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationVote" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "authorId" TEXT,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,

    CONSTRAINT "RecommendationComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserActivity_userId_createdAt_idx" ON "UserActivity"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "UserActivity_userId_action_createdAt_idx" ON "UserActivity"("userId", "action", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");

-- CreateIndex
CREATE INDEX "Article_createdAt_idx" ON "Article"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Article_trendingScore_idx" ON "Article"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "Supervisor_createdAt_idx" ON "Supervisor"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Supervisor_trendingScore_idx" ON "Supervisor"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "SocialPost_createdAt_idx" ON "SocialPost"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "SocialPost_trendingScore_idx" ON "SocialPost"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "ArticleComment_articleId_createdAt_idx" ON "ArticleComment"("articleId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ArticleVote_articleId_voteType_idx" ON "ArticleVote"("articleId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleVote_articleId_userId_key" ON "ArticleVote"("articleId", "userId");

-- CreateIndex
CREATE INDEX "SocialComment_socialPostId_createdAt_idx" ON "SocialComment"("socialPostId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ArticleCommentVote_commentId_voteType_idx" ON "ArticleCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleCommentVote_commentId_userId_key" ON "ArticleCommentVote"("commentId", "userId");

-- CreateIndex
CREATE INDEX "SocialCommentVote_commentId_voteType_idx" ON "SocialCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "SocialCommentVote_commentId_userId_key" ON "SocialCommentVote"("commentId", "userId");

-- CreateIndex
CREATE INDEX "SocialVote_socialPostId_voteType_idx" ON "SocialVote"("socialPostId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "SocialVote_socialPostId_userId_key" ON "SocialVote"("socialPostId", "userId");

-- CreateIndex
CREATE INDEX "Report_entityId_status_idx" ON "Report"("entityId", "status");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "Report_module_status_idx" ON "Report"("module", "status");

-- CreateIndex
CREATE INDEX "Report_reporterId_createdAt_idx" ON "Report"("reporterId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "HelpPost_createdAt_idx" ON "HelpPost"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "HelpPost_trendingScore_idx" ON "HelpPost"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "HelpPostVote_helpPostId_voteType_idx" ON "HelpPostVote"("helpPostId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "HelpPostVote_helpPostId_userId_key" ON "HelpPostVote"("helpPostId", "userId");

-- CreateIndex
CREATE INDEX "HelpPostComment_helpPostId_createdAt_idx" ON "HelpPostComment"("helpPostId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "HelpPostCommentVote_commentId_voteType_idx" ON "HelpPostCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "HelpPostCommentVote_commentId_userId_key" ON "HelpPostCommentVote"("commentId", "userId");

-- CreateIndex
CREATE INDEX "Contribution_createdAt_idx" ON "Contribution"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Contribution_trendingScore_idx" ON "Contribution"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "ContributionVote_contributionId_voteType_idx" ON "ContributionVote"("contributionId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "ContributionVote_contributionId_userId_key" ON "ContributionVote"("contributionId", "userId");

-- CreateIndex
CREATE INDEX "ContributionComment_contributionId_createdAt_idx" ON "ContributionComment"("contributionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ContributionCommentVote_commentId_voteType_idx" ON "ContributionCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "ContributionCommentVote_commentId_userId_key" ON "ContributionCommentVote"("commentId", "userId");

-- CreateIndex
CREATE INDEX "Publication_createdAt_idx" ON "Publication"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Publication_trendingScore_idx" ON "Publication"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "PublicationVote_publicationId_voteType_idx" ON "PublicationVote"("publicationId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "PublicationVote_publicationId_userId_key" ON "PublicationVote"("publicationId", "userId");

-- CreateIndex
CREATE INDEX "PublicationComment_publicationId_createdAt_idx" ON "PublicationComment"("publicationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PublicationCommentVote_commentId_voteType_idx" ON "PublicationCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "PublicationCommentVote_commentId_userId_key" ON "PublicationCommentVote"("commentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");

-- CreateIndex
CREATE INDEX "User_trendingScore_idx" ON "User"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_recipientId_createdAt_idx" ON "Notification"("recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_recipientId_readAt_idx" ON "Notification"("recipientId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_recipientId_isEmailed_idx" ON "Notification"("recipientId", "isEmailed");

-- CreateIndex
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_createdById_lastMessageAt_idx" ON "Conversation"("createdById", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_lastReadAt_idx" ON "ConversationParticipant"("userId", "lastReadAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_createdAt_idx" ON "Message"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_readAt_idx" ON "Message"("conversationId", "readAt");

-- CreateIndex
CREATE INDEX "ResearchTool_createdAt_idx" ON "ResearchTool"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ResearchTool_trendingScore_idx" ON "ResearchTool"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "ResearchToolVote_researchToolId_voteType_idx" ON "ResearchToolVote"("researchToolId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchToolVote_researchToolId_userId_key" ON "ResearchToolVote"("researchToolId", "userId");

-- CreateIndex
CREATE INDEX "ResearchToolComment_researchToolId_createdAt_idx" ON "ResearchToolComment"("researchToolId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ResearchToolCommentVote_commentId_voteType_idx" ON "ResearchToolCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchToolCommentVote_commentId_userId_key" ON "ResearchToolCommentVote"("commentId", "userId");

-- CreateIndex
CREATE INDEX "ResearchGrant_createdAt_idx" ON "ResearchGrant"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ResearchGrant_trendingScore_idx" ON "ResearchGrant"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "ResearchGrantVote_researchGrantId_voteType_idx" ON "ResearchGrantVote"("researchGrantId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchGrantVote_researchGrantId_userId_key" ON "ResearchGrantVote"("researchGrantId", "userId");

-- CreateIndex
CREATE INDEX "ResearchGrantComment_researchGrantId_createdAt_idx" ON "ResearchGrantComment"("researchGrantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ResearchGrantCommentVote_commentId_voteType_idx" ON "ResearchGrantCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchGrantCommentVote_commentId_userId_key" ON "ResearchGrantCommentVote"("commentId", "userId");

-- CreateIndex
CREATE INDEX "Course_createdAt_idx" ON "Course"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Course_trendingScore_idx" ON "Course"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "CourseVote_courseId_voteType_idx" ON "CourseVote"("courseId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "CourseVote_courseId_userId_key" ON "CourseVote"("courseId", "userId");

-- CreateIndex
CREATE INDEX "CourseComment_courseId_createdAt_idx" ON "CourseComment"("courseId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "CourseCommentVote_commentId_voteType_idx" ON "CourseCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "CourseCommentVote_commentId_userId_key" ON "CourseCommentVote"("commentId", "userId");

-- CreateIndex
CREATE INDEX "Journal_createdAt_idx" ON "Journal"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Journal_trendingScore_idx" ON "Journal"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "JournalVote_journalId_voteType_idx" ON "JournalVote"("journalId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "JournalVote_journalId_userId_key" ON "JournalVote"("journalId", "userId");

-- CreateIndex
CREATE INDEX "JournalComment_journalId_createdAt_idx" ON "JournalComment"("journalId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "JournalCommentVote_commentId_voteType_idx" ON "JournalCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "JournalCommentVote_commentId_userId_key" ON "JournalCommentVote"("commentId", "userId");

-- CreateIndex
CREATE INDEX "Result_createdAt_idx" ON "Result"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Result_trendingScore_idx" ON "Result"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "ResultVote_resultId_voteType_idx" ON "ResultVote"("resultId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "ResultVote_resultId_userId_key" ON "ResultVote"("resultId", "userId");

-- CreateIndex
CREATE INDEX "ResultComment_resultId_createdAt_idx" ON "ResultComment"("resultId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ResultCommentVote_commentId_voteType_idx" ON "ResultCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "ResultCommentVote_commentId_userId_key" ON "ResultCommentVote"("commentId", "userId");

-- CreateIndex
CREATE INDEX "ResearchSurvey_createdAt_idx" ON "ResearchSurvey"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ResearchSurvey_trendingScore_idx" ON "ResearchSurvey"("trendingScore" DESC);

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
CREATE INDEX "Follows_followerId_createdAt_idx" ON "Follows"("followerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Follows_followingId_createdAt_idx" ON "Follows"("followingId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Block_blockedId_idx" ON "Block"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "Block_blockerId_blockedId_key" ON "Block"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX "ResearchEvent_createdAt_idx" ON "ResearchEvent"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ResearchEvent_trendingScore_idx" ON "ResearchEvent"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "ResearchEventVote_researchEventId_voteType_idx" ON "ResearchEventVote"("researchEventId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchEventVote_researchEventId_userId_key" ON "ResearchEventVote"("researchEventId", "userId");

-- CreateIndex
CREATE INDEX "ResearchEventComment_researchEventId_createdAt_idx" ON "ResearchEventComment"("researchEventId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ResearchEventCommentVote_commentId_voteType_idx" ON "ResearchEventCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchEventCommentVote_commentId_userId_key" ON "ResearchEventCommentVote"("commentId", "userId");

-- CreateIndex
CREATE INDEX "PhdAdmission_createdAt_idx" ON "PhdAdmission"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "PhdAdmission_trendingScore_idx" ON "PhdAdmission"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "PhdAdmissionVote_phdAdmissionId_voteType_idx" ON "PhdAdmissionVote"("phdAdmissionId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "PhdAdmissionVote_phdAdmissionId_userId_key" ON "PhdAdmissionVote"("phdAdmissionId", "userId");

-- CreateIndex
CREATE INDEX "PhdAdmissionComment_phdAdmissionId_createdAt_idx" ON "PhdAdmissionComment"("phdAdmissionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PhdAdmissionCommentVote_commentId_voteType_idx" ON "PhdAdmissionCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "PhdAdmissionCommentVote_commentId_userId_key" ON "PhdAdmissionCommentVote"("commentId", "userId");

-- CreateIndex
CREATE INDEX "JobVacancy_createdAt_idx" ON "JobVacancy"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "JobVacancy_trendingScore_idx" ON "JobVacancy"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "JobVacancyVote_jobVacancyId_voteType_idx" ON "JobVacancyVote"("jobVacancyId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "JobVacancyVote_jobVacancyId_userId_key" ON "JobVacancyVote"("jobVacancyId", "userId");

-- CreateIndex
CREATE INDEX "JobVacancyComment_jobVacancyId_createdAt_idx" ON "JobVacancyComment"("jobVacancyId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "JobVacancyCommentVote_commentId_voteType_idx" ON "JobVacancyCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "JobVacancyCommentVote_commentId_userId_key" ON "JobVacancyCommentVote"("commentId", "userId");

-- CreateIndex
CREATE INDEX "SupervisorVote_supervisorId_voteType_idx" ON "SupervisorVote"("supervisorId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "SupervisorVote_supervisorId_userId_key" ON "SupervisorVote"("supervisorId", "userId");

-- CreateIndex
CREATE INDEX "SupervisorComment_supervisorId_createdAt_idx" ON "SupervisorComment"("supervisorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SupervisorCommentVote_commentId_voteType_idx" ON "SupervisorCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "SupervisorCommentVote_commentId_userId_key" ON "SupervisorCommentVote"("commentId", "userId");

-- CreateIndex
CREATE INDEX "Recommendation_createdAt_idx" ON "Recommendation"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Recommendation_trendingScore_idx" ON "Recommendation"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "RecommendationVote_recommendationId_voteType_idx" ON "RecommendationVote"("recommendationId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationVote_recommendationId_userId_key" ON "RecommendationVote"("recommendationId", "userId");

-- CreateIndex
CREATE INDEX "RecommendationComment_recommendationId_createdAt_idx" ON "RecommendationComment"("recommendationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "RecommendationCommentVote_commentId_voteType_idx" ON "RecommendationCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationCommentVote_commentId_userId_key" ON "RecommendationCommentVote"("commentId", "userId");

-- AddForeignKey
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supervisor" ADD CONSTRAINT "Supervisor_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleComment" ADD CONSTRAINT "ArticleComment_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleComment" ADD CONSTRAINT "ArticleComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleComment" ADD CONSTRAINT "ArticleComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ArticleComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleVote" ADD CONSTRAINT "ArticleVote_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleVote" ADD CONSTRAINT "ArticleVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialComment" ADD CONSTRAINT "SocialComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialComment" ADD CONSTRAINT "SocialComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SocialComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialComment" ADD CONSTRAINT "SocialComment_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleCommentVote" ADD CONSTRAINT "ArticleCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "ArticleComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleCommentVote" ADD CONSTRAINT "ArticleCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialCommentVote" ADD CONSTRAINT "SocialCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "SocialComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialCommentVote" ADD CONSTRAINT "SocialCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialVote" ADD CONSTRAINT "SocialVote_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialVote" ADD CONSTRAINT "SocialVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpPost" ADD CONSTRAINT "HelpPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpPostVote" ADD CONSTRAINT "HelpPostVote_helpPostId_fkey" FOREIGN KEY ("helpPostId") REFERENCES "HelpPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpPostVote" ADD CONSTRAINT "HelpPostVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpPostComment" ADD CONSTRAINT "HelpPostComment_helpPostId_fkey" FOREIGN KEY ("helpPostId") REFERENCES "HelpPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpPostComment" ADD CONSTRAINT "HelpPostComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpPostComment" ADD CONSTRAINT "HelpPostComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "HelpPostComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpPostCommentVote" ADD CONSTRAINT "HelpPostCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "HelpPostComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpPostCommentVote" ADD CONSTRAINT "HelpPostCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionVote" ADD CONSTRAINT "ContributionVote_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "Contribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionVote" ADD CONSTRAINT "ContributionVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionComment" ADD CONSTRAINT "ContributionComment_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "Contribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionComment" ADD CONSTRAINT "ContributionComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionComment" ADD CONSTRAINT "ContributionComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ContributionComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionCommentVote" ADD CONSTRAINT "ContributionCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "ContributionComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionCommentVote" ADD CONSTRAINT "ContributionCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationVote" ADD CONSTRAINT "PublicationVote_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationVote" ADD CONSTRAINT "PublicationVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationComment" ADD CONSTRAINT "PublicationComment_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationComment" ADD CONSTRAINT "PublicationComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationComment" ADD CONSTRAINT "PublicationComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PublicationComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationCommentVote" ADD CONSTRAINT "PublicationCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "PublicationComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationCommentVote" ADD CONSTRAINT "PublicationCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchTool" ADD CONSTRAINT "ResearchTool_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchToolVote" ADD CONSTRAINT "ResearchToolVote_researchToolId_fkey" FOREIGN KEY ("researchToolId") REFERENCES "ResearchTool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchToolVote" ADD CONSTRAINT "ResearchToolVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchToolComment" ADD CONSTRAINT "ResearchToolComment_researchToolId_fkey" FOREIGN KEY ("researchToolId") REFERENCES "ResearchTool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchToolComment" ADD CONSTRAINT "ResearchToolComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchToolComment" ADD CONSTRAINT "ResearchToolComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ResearchToolComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchToolCommentVote" ADD CONSTRAINT "ResearchToolCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "ResearchToolComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchToolCommentVote" ADD CONSTRAINT "ResearchToolCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchGrant" ADD CONSTRAINT "ResearchGrant_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchGrantVote" ADD CONSTRAINT "ResearchGrantVote_researchGrantId_fkey" FOREIGN KEY ("researchGrantId") REFERENCES "ResearchGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchGrantVote" ADD CONSTRAINT "ResearchGrantVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchGrantComment" ADD CONSTRAINT "ResearchGrantComment_researchGrantId_fkey" FOREIGN KEY ("researchGrantId") REFERENCES "ResearchGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchGrantComment" ADD CONSTRAINT "ResearchGrantComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchGrantComment" ADD CONSTRAINT "ResearchGrantComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ResearchGrantComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchGrantCommentVote" ADD CONSTRAINT "ResearchGrantCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "ResearchGrantComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchGrantCommentVote" ADD CONSTRAINT "ResearchGrantCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseVote" ADD CONSTRAINT "CourseVote_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseVote" ADD CONSTRAINT "CourseVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseComment" ADD CONSTRAINT "CourseComment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseComment" ADD CONSTRAINT "CourseComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseComment" ADD CONSTRAINT "CourseComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CourseComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCommentVote" ADD CONSTRAINT "CourseCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "CourseComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCommentVote" ADD CONSTRAINT "CourseCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Journal" ADD CONSTRAINT "Journal_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalVote" ADD CONSTRAINT "JournalVote_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalVote" ADD CONSTRAINT "JournalVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalComment" ADD CONSTRAINT "JournalComment_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalComment" ADD CONSTRAINT "JournalComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalComment" ADD CONSTRAINT "JournalComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "JournalComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalCommentVote" ADD CONSTRAINT "JournalCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "JournalComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalCommentVote" ADD CONSTRAINT "JournalCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultVote" ADD CONSTRAINT "ResultVote_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultVote" ADD CONSTRAINT "ResultVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultComment" ADD CONSTRAINT "ResultComment_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultComment" ADD CONSTRAINT "ResultComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultComment" ADD CONSTRAINT "ResultComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ResultComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultCommentVote" ADD CONSTRAINT "ResultCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "ResultComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultCommentVote" ADD CONSTRAINT "ResultCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSurvey" ADD CONSTRAINT "ResearchSurvey_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchEvent" ADD CONSTRAINT "ResearchEvent_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchEventVote" ADD CONSTRAINT "ResearchEventVote_researchEventId_fkey" FOREIGN KEY ("researchEventId") REFERENCES "ResearchEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchEventVote" ADD CONSTRAINT "ResearchEventVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchEventComment" ADD CONSTRAINT "ResearchEventComment_researchEventId_fkey" FOREIGN KEY ("researchEventId") REFERENCES "ResearchEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchEventComment" ADD CONSTRAINT "ResearchEventComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchEventComment" ADD CONSTRAINT "ResearchEventComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ResearchEventComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchEventCommentVote" ADD CONSTRAINT "ResearchEventCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "ResearchEventComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchEventCommentVote" ADD CONSTRAINT "ResearchEventCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhdAdmission" ADD CONSTRAINT "PhdAdmission_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhdAdmissionVote" ADD CONSTRAINT "PhdAdmissionVote_phdAdmissionId_fkey" FOREIGN KEY ("phdAdmissionId") REFERENCES "PhdAdmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhdAdmissionVote" ADD CONSTRAINT "PhdAdmissionVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhdAdmissionComment" ADD CONSTRAINT "PhdAdmissionComment_phdAdmissionId_fkey" FOREIGN KEY ("phdAdmissionId") REFERENCES "PhdAdmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhdAdmissionComment" ADD CONSTRAINT "PhdAdmissionComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhdAdmissionComment" ADD CONSTRAINT "PhdAdmissionComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PhdAdmissionComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhdAdmissionCommentVote" ADD CONSTRAINT "PhdAdmissionCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "PhdAdmissionComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhdAdmissionCommentVote" ADD CONSTRAINT "PhdAdmissionCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobVacancy" ADD CONSTRAINT "JobVacancy_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobVacancyVote" ADD CONSTRAINT "JobVacancyVote_jobVacancyId_fkey" FOREIGN KEY ("jobVacancyId") REFERENCES "JobVacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobVacancyVote" ADD CONSTRAINT "JobVacancyVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobVacancyComment" ADD CONSTRAINT "JobVacancyComment_jobVacancyId_fkey" FOREIGN KEY ("jobVacancyId") REFERENCES "JobVacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobVacancyComment" ADD CONSTRAINT "JobVacancyComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobVacancyComment" ADD CONSTRAINT "JobVacancyComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "JobVacancyComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobVacancyCommentVote" ADD CONSTRAINT "JobVacancyCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "JobVacancyComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobVacancyCommentVote" ADD CONSTRAINT "JobVacancyCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisorVote" ADD CONSTRAINT "SupervisorVote_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Supervisor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisorVote" ADD CONSTRAINT "SupervisorVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisorComment" ADD CONSTRAINT "SupervisorComment_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Supervisor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisorComment" ADD CONSTRAINT "SupervisorComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisorComment" ADD CONSTRAINT "SupervisorComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SupervisorComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisorCommentVote" ADD CONSTRAINT "SupervisorCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "SupervisorComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisorCommentVote" ADD CONSTRAINT "SupervisorCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Supervisor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationVote" ADD CONSTRAINT "RecommendationVote_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationVote" ADD CONSTRAINT "RecommendationVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationComment" ADD CONSTRAINT "RecommendationComment_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationComment" ADD CONSTRAINT "RecommendationComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationComment" ADD CONSTRAINT "RecommendationComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "RecommendationComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationCommentVote" ADD CONSTRAINT "RecommendationCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "RecommendationComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationCommentVote" ADD CONSTRAINT "RecommendationCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

