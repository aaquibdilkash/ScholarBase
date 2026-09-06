-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AbdcTier" AS ENUM ('NONE', 'A*', 'A', 'B', 'C');

-- CreateEnum
CREATE TYPE "public"."AppealReason" AS ENUM ('MISTAKEN_MODERATION', 'CONTEXT_MISSING', 'POLICY_CLARIFICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."AppealStatus" AS ENUM ('PENDING', 'DISMISSED', 'ACTIONED');

-- CreateEnum
CREATE TYPE "public"."ContributionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."ConversationType" AS ENUM ('DIRECT');

-- CreateEnum
CREATE TYPE "public"."DeletedByType" AS ENUM ('AUTHOR', 'PARENT_COMMENT_AUTHOR', 'POST_AUTHOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."DigestPreference" AS ENUM ('DAILY', 'WEEKLY', 'NEVER');

-- CreateEnum
CREATE TYPE "public"."OpenAccessStatus" AS ENUM ('CLOSED', 'HYBRID', 'GOLD', 'DIAMOND', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "public"."PublicationType" AS ENUM ('RESEARCH_PAPER', 'CONFERENCE_PROCEEDING', 'PREPRINT', 'BOOK', 'BOOK_CHAPTER', 'THESIS', 'TECHNICAL_REPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."Quartile" AS ENUM ('NONE', 'Q1', 'Q2', 'Q3', 'Q4');

-- CreateEnum
CREATE TYPE "public"."ReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'PLAGIARISM', 'MISINFORMATION', 'OFF_TOPIC', 'COPYRIGHT', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ReportStatus" AS ENUM ('PENDING', 'DISMISSED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "public"."SurveyPrivacy" AS ENUM ('ANONYMOUS', 'NON_ANONYMOUS', 'HYBRID');

-- CreateEnum
CREATE TYPE "public"."SurveyQuestionType" AS ENUM ('SHORT_TEXT', 'LONG_TEXT', 'MULTIPLE_CHOICE', 'CHECKBOXES', 'DROPDOWN', 'RATING', 'LINEAR_SCALE', 'DATE', 'LIKERT_SCALE');

-- CreateEnum
CREATE TYPE "public"."SurveyStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."VoteType" AS ENUM ('UPVOTE', 'DOWNVOTE');

-- CreateEnum
CREATE TYPE "public"."WosIndex" AS ENUM ('NONE', 'SCIE', 'SSCI', 'AHCI', 'ESCI');

-- CreateTable
CREATE TABLE "public"."Appeal" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "status" "public"."AppealStatus" NOT NULL DEFAULT 'PENDING',
    "ownerId" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "category" "public"."AppealReason" NOT NULL DEFAULT 'OTHER',
    "details" TEXT,

    CONSTRAINT "Appeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Article" (
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
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ArticleComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT NOT NULL,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ArticleComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ArticleCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ArticleVote" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Block" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Contribution" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "public"."ContributionStatus" NOT NULL DEFAULT 'PENDING',
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "amount" DOUBLE PRECISION,
    "approvedAt" TIMESTAMP(3),
    "message" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "rejectionReason" TEXT,
    "screenshotUrl" TEXT,
    "upiId" TEXT,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContributionComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contributionId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT NOT NULL,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ContributionComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContributionCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContributionCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContributionVote" (
    "id" TEXT NOT NULL,
    "contributionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContributionVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Conversation" (
    "id" TEXT NOT NULL,
    "type" "public"."ConversationType" NOT NULL DEFAULT 'DIRECT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConversationParticipant" (
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("conversationId","userId")
);

-- CreateTable
CREATE TABLE "public"."Course" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "duration" TEXT,
    "format" TEXT,
    "instructor" TEXT,
    "level" TEXT,
    "link" TEXT NOT NULL,
    "price" TEXT,
    "provider" TEXT,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CourseComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT NOT NULL,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CourseComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CourseCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CourseVote" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Follows" (
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follows_pkey" PRIMARY KEY ("followerId","followingId")
);

-- CreateTable
CREATE TABLE "public"."HelpPost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "HelpPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HelpPostComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "helpPostId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT NOT NULL,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "HelpPostComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HelpPostCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelpPostCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HelpPostVote" (
    "id" TEXT NOT NULL,
    "helpPostId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelpPostVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JobVacancy" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "applyLink" TEXT,
    "notificationLink" TEXT,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "JobVacancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JobVacancyComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "jobVacancyId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT NOT NULL,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "JobVacancyComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JobVacancyCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobVacancyCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JobVacancyVote" (
    "id" TEXT NOT NULL,
    "jobVacancyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobVacancyVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Journal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "issn" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "about" TEXT,
    "impactFactor" DOUBLE PRECISION,
    "publisher" TEXT,
    "website" TEXT,
    "editedAt" TIMESTAMP(3),
    "abdcRanking" "public"."AbdcTier" NOT NULL DEFAULT 'NONE',
    "citeScore" DOUBLE PRECISION,
    "scopusQuartile" "public"."Quartile" NOT NULL DEFAULT 'NONE',
    "sjrQuartile" "public"."Quartile" NOT NULL DEFAULT 'NONE',
    "sjrScore" DOUBLE PRECISION,
    "wosIndex" "public"."WosIndex" NOT NULL DEFAULT 'NONE',
    "wosQuartile" "public"."Quartile" NOT NULL DEFAULT 'NONE',
    "frequency" TEXT,
    "openAccess" "public"."OpenAccessStatus" NOT NULL DEFAULT 'UNKNOWN',
    "subjectArea" TEXT,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Journal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JournalComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT NOT NULL,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "JournalComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JournalCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JournalVote" (
    "id" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Message" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "recipientId" TEXT NOT NULL,
    "targetId" TEXT,
    "targetType" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "isEmailed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PhdAdmission" (
    "id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "applyLink" TEXT,
    "description" TEXT NOT NULL,
    "notificationLink" TEXT,
    "university" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PhdAdmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PhdAdmissionComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "phdAdmissionId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT NOT NULL,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PhdAdmissionComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PhdAdmissionCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhdAdmissionCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PhdAdmissionVote" (
    "id" TEXT NOT NULL,
    "phdAdmissionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhdAdmissionVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Publication" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publicationType" "public"."PublicationType" NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "abstract" TEXT,
    "authors" TEXT NOT NULL,
    "doi" TEXT,
    "domain" TEXT,
    "isUserAuthor" BOOLEAN NOT NULL DEFAULT false,
    "isbn" TEXT,
    "issue" TEXT,
    "journalOrConference" TEXT,
    "keywords" TEXT,
    "pages" TEXT,
    "publisher" TEXT,
    "url" TEXT,
    "volume" TEXT,
    "year" INTEGER,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PublicationComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT NOT NULL,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PublicationComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PublicationCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicationCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PublicationVote" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicationVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Recommendation" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "feedback" TEXT NOT NULL,
    "guidanceScore" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "responsivenessScore" INTEGER NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "turnaroundTimeDays" INTEGER NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RecommendationComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT NOT NULL,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RecommendationComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RecommendationCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RecommendationVote" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Report" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "details" TEXT,
    "reporterId" TEXT NOT NULL,
    "status" "public"."ReportStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "category" "public"."ReportReason" NOT NULL DEFAULT 'SPAM',

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResearchEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "applyLink" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "deadline" TIMESTAMP(3),
    "location" TEXT NOT NULL,
    "notificationLink" TEXT,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ResearchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResearchEventComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "researchEventId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT NOT NULL,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ResearchEventComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResearchEventCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchEventCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResearchEventVote" (
    "id" TEXT NOT NULL,
    "researchEventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchEventVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResearchGrant" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "applyLink" TEXT,
    "description" TEXT NOT NULL,
    "infoLink" TEXT,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ResearchGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResearchGrantComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "researchGrantId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT NOT NULL,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ResearchGrantComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResearchGrantCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchGrantCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResearchGrantVote" (
    "id" TEXT NOT NULL,
    "researchGrantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchGrantVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResearchSurvey" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "totalResponses" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "shareData" BOOLEAN NOT NULL DEFAULT false,
    "privacy" "public"."SurveyPrivacy" NOT NULL DEFAULT 'HYBRID',
    "status" "public"."SurveyStatus" NOT NULL DEFAULT 'OPEN',
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ResearchSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResearchTool" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "use" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ResearchTool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResearchToolComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "researchToolId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT NOT NULL,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ResearchToolComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResearchToolCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchToolCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResearchToolVote" (
    "id" TEXT NOT NULL,
    "researchToolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchToolVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Result" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT,
    "conductingBody" TEXT,
    "description" TEXT NOT NULL,
    "notificationLink" TEXT,
    "resultLink" TEXT,
    "session" TEXT,
    "type" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResultComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT NOT NULL,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ResultComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResultCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResultVote" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SocialComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "socialPostId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT NOT NULL,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SocialComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SocialCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SocialPost" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "imageUrls" TEXT[],
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,
    "mentions" JSONB,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SocialVote" (
    "id" TEXT NOT NULL,
    "socialPostId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Supervisor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "about" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "recommendationCount" INTEGER NOT NULL DEFAULT 0,
    "ratingSum" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Supervisor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SupervisorComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT NOT NULL,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SupervisorComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SupervisorCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupervisorCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SupervisorVote" (
    "id" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupervisorVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SurveyAnswer" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "SurveyAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SurveyComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT NOT NULL,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "mentions" JSONB,
    "editedAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "deletedById" TEXT,
    "deletedByType" "public"."DeletedByType",
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SurveyComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SurveyCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SurveyQuestion" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "type" "public"."SurveyQuestionType" NOT NULL,
    "title" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "minValue" INTEGER,
    "maxValue" INTEGER,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "totalAnswers" INTEGER NOT NULL DEFAULT 0,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "SurveyQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SurveyQuestionOption" (
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
CREATE TABLE "public"."SurveyResponse" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "respondentId" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SurveyVote" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "followersCount" INTEGER NOT NULL DEFAULT 0,
    "followingCount" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "githubUrl" TEXT,
    "googleScholarUrl" TEXT,
    "handle" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "linkedinUrl" TEXT,
    "orcidUrl" TEXT,
    "reputation" INTEGER NOT NULL DEFAULT 0,
    "editedAt" TIMESTAMP(3),
    "articleCount" INTEGER NOT NULL DEFAULT 0,
    "contributionCount" INTEGER NOT NULL DEFAULT 0,
    "courseCount" INTEGER NOT NULL DEFAULT 0,
    "helpPostCount" INTEGER NOT NULL DEFAULT 0,
    "jobVacancyCount" INTEGER NOT NULL DEFAULT 0,
    "journalCount" INTEGER NOT NULL DEFAULT 0,
    "phdAdmissionCount" INTEGER NOT NULL DEFAULT 0,
    "publicationCount" INTEGER NOT NULL DEFAULT 0,
    "recommendationCount" INTEGER NOT NULL DEFAULT 0,
    "researchEventCount" INTEGER NOT NULL DEFAULT 0,
    "researchGrantCount" INTEGER NOT NULL DEFAULT 0,
    "researchToolCount" INTEGER NOT NULL DEFAULT 0,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "socialPostCount" INTEGER NOT NULL DEFAULT 0,
    "supervisorCount" INTEGER NOT NULL DEFAULT 0,
    "surveyCount" INTEGER NOT NULL DEFAULT 0,
    "digestPreference" "public"."DigestPreference" NOT NULL DEFAULT 'DAILY',
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false,
    "surveyParticipationCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "moduleType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityTitle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Appeal_entityId_status_idx" ON "public"."Appeal"("entityId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "Appeal_ownerId_createdAt_idx" ON "public"."Appeal"("ownerId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Appeal_status_idx" ON "public"."Appeal"("status" ASC);

-- CreateIndex
CREATE INDEX "Article_createdAt_idx" ON "public"."Article"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "public"."Article"("slug" ASC);

-- CreateIndex
CREATE INDEX "Article_trendingScore_idx" ON "public"."Article"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "ArticleComment_articleId_createdAt_idx" ON "public"."ArticleComment"("articleId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ArticleCommentVote_commentId_userId_key" ON "public"."ArticleCommentVote"("commentId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "ArticleCommentVote_commentId_voteType_idx" ON "public"."ArticleCommentVote"("commentId" ASC, "voteType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ArticleVote_articleId_userId_key" ON "public"."ArticleVote"("articleId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "ArticleVote_articleId_voteType_idx" ON "public"."ArticleVote"("articleId" ASC, "voteType" ASC);

-- CreateIndex
CREATE INDEX "Block_blockedId_idx" ON "public"."Block"("blockedId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Block_blockerId_blockedId_key" ON "public"."Block"("blockerId" ASC, "blockedId" ASC);

-- CreateIndex
CREATE INDEX "Contribution_createdAt_idx" ON "public"."Contribution"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Contribution_trendingScore_idx" ON "public"."Contribution"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "ContributionComment_contributionId_createdAt_idx" ON "public"."ContributionComment"("contributionId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ContributionCommentVote_commentId_userId_key" ON "public"."ContributionCommentVote"("commentId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "ContributionCommentVote_commentId_voteType_idx" ON "public"."ContributionCommentVote"("commentId" ASC, "voteType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ContributionVote_contributionId_userId_key" ON "public"."ContributionVote"("contributionId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "ContributionVote_contributionId_voteType_idx" ON "public"."ContributionVote"("contributionId" ASC, "voteType" ASC);

-- CreateIndex
CREATE INDEX "Conversation_createdById_lastMessageAt_idx" ON "public"."Conversation"("createdById" ASC, "lastMessageAt" ASC);

-- CreateIndex
CREATE INDEX "Conversation_lastMessageAt_idx" ON "public"."Conversation"("lastMessageAt" ASC);

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_lastReadAt_idx" ON "public"."ConversationParticipant"("userId" ASC, "lastReadAt" ASC);

-- CreateIndex
CREATE INDEX "Course_createdAt_idx" ON "public"."Course"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Course_trendingScore_idx" ON "public"."Course"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "CourseComment_courseId_createdAt_idx" ON "public"."CourseComment"("courseId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "CourseCommentVote_commentId_userId_key" ON "public"."CourseCommentVote"("commentId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "CourseCommentVote_commentId_voteType_idx" ON "public"."CourseCommentVote"("commentId" ASC, "voteType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CourseVote_courseId_userId_key" ON "public"."CourseVote"("courseId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "CourseVote_courseId_voteType_idx" ON "public"."CourseVote"("courseId" ASC, "voteType" ASC);

-- CreateIndex
CREATE INDEX "Follows_followerId_createdAt_idx" ON "public"."Follows"("followerId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Follows_followingId_createdAt_idx" ON "public"."Follows"("followingId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "HelpPost_createdAt_idx" ON "public"."HelpPost"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "HelpPost_trendingScore_idx" ON "public"."HelpPost"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "HelpPostComment_helpPostId_createdAt_idx" ON "public"."HelpPostComment"("helpPostId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "HelpPostCommentVote_commentId_userId_key" ON "public"."HelpPostCommentVote"("commentId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "HelpPostCommentVote_commentId_voteType_idx" ON "public"."HelpPostCommentVote"("commentId" ASC, "voteType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "HelpPostVote_helpPostId_userId_key" ON "public"."HelpPostVote"("helpPostId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "HelpPostVote_helpPostId_voteType_idx" ON "public"."HelpPostVote"("helpPostId" ASC, "voteType" ASC);

-- CreateIndex
CREATE INDEX "JobVacancy_createdAt_idx" ON "public"."JobVacancy"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "JobVacancy_trendingScore_idx" ON "public"."JobVacancy"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "JobVacancyComment_jobVacancyId_createdAt_idx" ON "public"."JobVacancyComment"("jobVacancyId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "JobVacancyCommentVote_commentId_userId_key" ON "public"."JobVacancyCommentVote"("commentId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "JobVacancyCommentVote_commentId_voteType_idx" ON "public"."JobVacancyCommentVote"("commentId" ASC, "voteType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "JobVacancyVote_jobVacancyId_userId_key" ON "public"."JobVacancyVote"("jobVacancyId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "JobVacancyVote_jobVacancyId_voteType_idx" ON "public"."JobVacancyVote"("jobVacancyId" ASC, "voteType" ASC);

-- CreateIndex
CREATE INDEX "Journal_createdAt_idx" ON "public"."Journal"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Journal_trendingScore_idx" ON "public"."Journal"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "JournalComment_journalId_createdAt_idx" ON "public"."JournalComment"("journalId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "JournalCommentVote_commentId_userId_key" ON "public"."JournalCommentVote"("commentId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "JournalCommentVote_commentId_voteType_idx" ON "public"."JournalCommentVote"("commentId" ASC, "voteType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "JournalVote_journalId_userId_key" ON "public"."JournalVote"("journalId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "JournalVote_journalId_voteType_idx" ON "public"."JournalVote"("journalId" ASC, "voteType" ASC);

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "public"."Message"("conversationId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "Message_conversationId_readAt_idx" ON "public"."Message"("conversationId" ASC, "readAt" ASC);

-- CreateIndex
CREATE INDEX "Message_senderId_createdAt_idx" ON "public"."Message"("senderId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "Notification_recipientId_createdAt_idx" ON "public"."Notification"("recipientId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "Notification_recipientId_isEmailed_idx" ON "public"."Notification"("recipientId" ASC, "isEmailed" ASC);

-- CreateIndex
CREATE INDEX "Notification_recipientId_readAt_idx" ON "public"."Notification"("recipientId" ASC, "readAt" ASC);

-- CreateIndex
CREATE INDEX "PhdAdmission_createdAt_idx" ON "public"."PhdAdmission"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "PhdAdmission_trendingScore_idx" ON "public"."PhdAdmission"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "PhdAdmissionComment_phdAdmissionId_createdAt_idx" ON "public"."PhdAdmissionComment"("phdAdmissionId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PhdAdmissionCommentVote_commentId_userId_key" ON "public"."PhdAdmissionCommentVote"("commentId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "PhdAdmissionCommentVote_commentId_voteType_idx" ON "public"."PhdAdmissionCommentVote"("commentId" ASC, "voteType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PhdAdmissionVote_phdAdmissionId_userId_key" ON "public"."PhdAdmissionVote"("phdAdmissionId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "PhdAdmissionVote_phdAdmissionId_voteType_idx" ON "public"."PhdAdmissionVote"("phdAdmissionId" ASC, "voteType" ASC);

-- CreateIndex
CREATE INDEX "Publication_createdAt_idx" ON "public"."Publication"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Publication_trendingScore_idx" ON "public"."Publication"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "PublicationComment_publicationId_createdAt_idx" ON "public"."PublicationComment"("publicationId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PublicationCommentVote_commentId_userId_key" ON "public"."PublicationCommentVote"("commentId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "PublicationCommentVote_commentId_voteType_idx" ON "public"."PublicationCommentVote"("commentId" ASC, "voteType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PublicationVote_publicationId_userId_key" ON "public"."PublicationVote"("publicationId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "PublicationVote_publicationId_voteType_idx" ON "public"."PublicationVote"("publicationId" ASC, "voteType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Recommendation_active_author_supervisor_unique" ON "public"."Recommendation"("authorId" ASC, "supervisorId" ASC);

-- CreateIndex
CREATE INDEX "Recommendation_createdAt_idx" ON "public"."Recommendation"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Recommendation_trendingScore_idx" ON "public"."Recommendation"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "RecommendationComment_recommendationId_createdAt_idx" ON "public"."RecommendationComment"("recommendationId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationCommentVote_commentId_userId_key" ON "public"."RecommendationCommentVote"("commentId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "RecommendationCommentVote_commentId_voteType_idx" ON "public"."RecommendationCommentVote"("commentId" ASC, "voteType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationVote_recommendationId_userId_key" ON "public"."RecommendationVote"("recommendationId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "RecommendationVote_recommendationId_voteType_idx" ON "public"."RecommendationVote"("recommendationId" ASC, "voteType" ASC);

-- CreateIndex
CREATE INDEX "Report_entityId_status_idx" ON "public"."Report"("entityId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "Report_module_status_idx" ON "public"."Report"("module" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "Report_reporterId_createdAt_idx" ON "public"."Report"("reporterId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Report_reporterId_entityId_key" ON "public"."Report"("reporterId" ASC, "entityId" ASC);

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "public"."Report"("status" ASC);

-- CreateIndex
CREATE INDEX "ResearchEvent_createdAt_idx" ON "public"."ResearchEvent"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ResearchEvent_trendingScore_idx" ON "public"."ResearchEvent"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "ResearchEventComment_researchEventId_createdAt_idx" ON "public"."ResearchEventComment"("researchEventId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ResearchEventCommentVote_commentId_userId_key" ON "public"."ResearchEventCommentVote"("commentId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "ResearchEventCommentVote_commentId_voteType_idx" ON "public"."ResearchEventCommentVote"("commentId" ASC, "voteType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ResearchEventVote_researchEventId_userId_key" ON "public"."ResearchEventVote"("researchEventId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "ResearchEventVote_researchEventId_voteType_idx" ON "public"."ResearchEventVote"("researchEventId" ASC, "voteType" ASC);

-- CreateIndex
CREATE INDEX "ResearchGrant_createdAt_idx" ON "public"."ResearchGrant"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ResearchGrant_trendingScore_idx" ON "public"."ResearchGrant"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "ResearchGrantComment_researchGrantId_createdAt_idx" ON "public"."ResearchGrantComment"("researchGrantId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ResearchGrantCommentVote_commentId_userId_key" ON "public"."ResearchGrantCommentVote"("commentId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "ResearchGrantCommentVote_commentId_voteType_idx" ON "public"."ResearchGrantCommentVote"("commentId" ASC, "voteType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ResearchGrantVote_researchGrantId_userId_key" ON "public"."ResearchGrantVote"("researchGrantId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "ResearchGrantVote_researchGrantId_voteType_idx" ON "public"."ResearchGrantVote"("researchGrantId" ASC, "voteType" ASC);

-- CreateIndex
CREATE INDEX "ResearchSurvey_createdAt_idx" ON "public"."ResearchSurvey"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ResearchSurvey_trendingScore_idx" ON "public"."ResearchSurvey"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "ResearchTool_createdAt_idx" ON "public"."ResearchTool"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ResearchTool_trendingScore_idx" ON "public"."ResearchTool"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "ResearchToolComment_researchToolId_createdAt_idx" ON "public"."ResearchToolComment"("researchToolId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ResearchToolCommentVote_commentId_userId_key" ON "public"."ResearchToolCommentVote"("commentId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "ResearchToolCommentVote_commentId_voteType_idx" ON "public"."ResearchToolCommentVote"("commentId" ASC, "voteType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ResearchToolVote_researchToolId_userId_key" ON "public"."ResearchToolVote"("researchToolId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "ResearchToolVote_researchToolId_voteType_idx" ON "public"."ResearchToolVote"("researchToolId" ASC, "voteType" ASC);

-- CreateIndex
CREATE INDEX "Result_createdAt_idx" ON "public"."Result"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Result_trendingScore_idx" ON "public"."Result"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "ResultComment_resultId_createdAt_idx" ON "public"."ResultComment"("resultId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ResultCommentVote_commentId_userId_key" ON "public"."ResultCommentVote"("commentId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "ResultCommentVote_commentId_voteType_idx" ON "public"."ResultCommentVote"("commentId" ASC, "voteType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ResultVote_resultId_userId_key" ON "public"."ResultVote"("resultId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "ResultVote_resultId_voteType_idx" ON "public"."ResultVote"("resultId" ASC, "voteType" ASC);

-- CreateIndex
CREATE INDEX "SocialComment_socialPostId_createdAt_idx" ON "public"."SocialComment"("socialPostId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SocialCommentVote_commentId_userId_key" ON "public"."SocialCommentVote"("commentId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "SocialCommentVote_commentId_voteType_idx" ON "public"."SocialCommentVote"("commentId" ASC, "voteType" ASC);

-- CreateIndex
CREATE INDEX "SocialPost_createdAt_idx" ON "public"."SocialPost"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "SocialPost_trendingScore_idx" ON "public"."SocialPost"("trendingScore" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SocialVote_socialPostId_userId_key" ON "public"."SocialVote"("socialPostId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "SocialVote_socialPostId_voteType_idx" ON "public"."SocialVote"("socialPostId" ASC, "voteType" ASC);

-- CreateIndex
CREATE INDEX "Supervisor_createdAt_idx" ON "public"."Supervisor"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Supervisor_trendingScore_idx" ON "public"."Supervisor"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "SupervisorComment_supervisorId_createdAt_idx" ON "public"."SupervisorComment"("supervisorId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SupervisorCommentVote_commentId_userId_key" ON "public"."SupervisorCommentVote"("commentId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "SupervisorCommentVote_commentId_voteType_idx" ON "public"."SupervisorCommentVote"("commentId" ASC, "voteType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SupervisorVote_supervisorId_userId_key" ON "public"."SupervisorVote"("supervisorId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "SupervisorVote_supervisorId_voteType_idx" ON "public"."SupervisorVote"("supervisorId" ASC, "voteType" ASC);

-- CreateIndex
CREATE INDEX "SurveyComment_surveyId_createdAt_idx" ON "public"."SurveyComment"("surveyId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SurveyCommentVote_commentId_userId_key" ON "public"."SurveyCommentVote"("commentId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "SurveyCommentVote_commentId_voteType_idx" ON "public"."SurveyCommentVote"("commentId" ASC, "voteType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SurveyVote_surveyId_userId_key" ON "public"."SurveyVote"("surveyId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "SurveyVote_surveyId_voteType_idx" ON "public"."SurveyVote"("surveyId" ASC, "voteType" ASC);

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "public"."User"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "public"."User"("handle" ASC);

-- CreateIndex
CREATE INDEX "User_trendingScore_idx" ON "public"."User"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "UserActivity_userId_action_createdAt_idx" ON "public"."UserActivity"("userId" ASC, "action" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "UserActivity_userId_createdAt_idx" ON "public"."UserActivity"("userId" ASC, "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "public"."Appeal" ADD CONSTRAINT "Appeal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appeal" ADD CONSTRAINT "Appeal_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Article" ADD CONSTRAINT "Article_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ArticleComment" ADD CONSTRAINT "ArticleComment_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ArticleComment" ADD CONSTRAINT "ArticleComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ArticleComment" ADD CONSTRAINT "ArticleComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."ArticleComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ArticleCommentVote" ADD CONSTRAINT "ArticleCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."ArticleComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ArticleCommentVote" ADD CONSTRAINT "ArticleCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ArticleVote" ADD CONSTRAINT "ArticleVote_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ArticleVote" ADD CONSTRAINT "ArticleVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Block" ADD CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Block" ADD CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contribution" ADD CONSTRAINT "Contribution_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContributionComment" ADD CONSTRAINT "ContributionComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContributionComment" ADD CONSTRAINT "ContributionComment_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "public"."Contribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContributionComment" ADD CONSTRAINT "ContributionComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."ContributionComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContributionCommentVote" ADD CONSTRAINT "ContributionCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."ContributionComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContributionCommentVote" ADD CONSTRAINT "ContributionCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContributionVote" ADD CONSTRAINT "ContributionVote_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "public"."Contribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContributionVote" ADD CONSTRAINT "ContributionVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Conversation" ADD CONSTRAINT "Conversation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Course" ADD CONSTRAINT "Course_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CourseComment" ADD CONSTRAINT "CourseComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CourseComment" ADD CONSTRAINT "CourseComment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CourseComment" ADD CONSTRAINT "CourseComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."CourseComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CourseCommentVote" ADD CONSTRAINT "CourseCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."CourseComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CourseCommentVote" ADD CONSTRAINT "CourseCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CourseVote" ADD CONSTRAINT "CourseVote_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CourseVote" ADD CONSTRAINT "CourseVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Follows" ADD CONSTRAINT "Follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Follows" ADD CONSTRAINT "Follows_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HelpPost" ADD CONSTRAINT "HelpPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HelpPostComment" ADD CONSTRAINT "HelpPostComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HelpPostComment" ADD CONSTRAINT "HelpPostComment_helpPostId_fkey" FOREIGN KEY ("helpPostId") REFERENCES "public"."HelpPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HelpPostComment" ADD CONSTRAINT "HelpPostComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."HelpPostComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HelpPostCommentVote" ADD CONSTRAINT "HelpPostCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."HelpPostComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HelpPostCommentVote" ADD CONSTRAINT "HelpPostCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HelpPostVote" ADD CONSTRAINT "HelpPostVote_helpPostId_fkey" FOREIGN KEY ("helpPostId") REFERENCES "public"."HelpPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HelpPostVote" ADD CONSTRAINT "HelpPostVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobVacancy" ADD CONSTRAINT "JobVacancy_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobVacancyComment" ADD CONSTRAINT "JobVacancyComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobVacancyComment" ADD CONSTRAINT "JobVacancyComment_jobVacancyId_fkey" FOREIGN KEY ("jobVacancyId") REFERENCES "public"."JobVacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobVacancyComment" ADD CONSTRAINT "JobVacancyComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."JobVacancyComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobVacancyCommentVote" ADD CONSTRAINT "JobVacancyCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."JobVacancyComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobVacancyCommentVote" ADD CONSTRAINT "JobVacancyCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobVacancyVote" ADD CONSTRAINT "JobVacancyVote_jobVacancyId_fkey" FOREIGN KEY ("jobVacancyId") REFERENCES "public"."JobVacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobVacancyVote" ADD CONSTRAINT "JobVacancyVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Journal" ADD CONSTRAINT "Journal_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JournalComment" ADD CONSTRAINT "JournalComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JournalComment" ADD CONSTRAINT "JournalComment_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "public"."Journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JournalComment" ADD CONSTRAINT "JournalComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."JournalComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JournalCommentVote" ADD CONSTRAINT "JournalCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."JournalComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JournalCommentVote" ADD CONSTRAINT "JournalCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JournalVote" ADD CONSTRAINT "JournalVote_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "public"."Journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JournalVote" ADD CONSTRAINT "JournalVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PhdAdmission" ADD CONSTRAINT "PhdAdmission_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PhdAdmissionComment" ADD CONSTRAINT "PhdAdmissionComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PhdAdmissionComment" ADD CONSTRAINT "PhdAdmissionComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."PhdAdmissionComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PhdAdmissionComment" ADD CONSTRAINT "PhdAdmissionComment_phdAdmissionId_fkey" FOREIGN KEY ("phdAdmissionId") REFERENCES "public"."PhdAdmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PhdAdmissionCommentVote" ADD CONSTRAINT "PhdAdmissionCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."PhdAdmissionComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PhdAdmissionCommentVote" ADD CONSTRAINT "PhdAdmissionCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PhdAdmissionVote" ADD CONSTRAINT "PhdAdmissionVote_phdAdmissionId_fkey" FOREIGN KEY ("phdAdmissionId") REFERENCES "public"."PhdAdmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PhdAdmissionVote" ADD CONSTRAINT "PhdAdmissionVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Publication" ADD CONSTRAINT "Publication_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PublicationComment" ADD CONSTRAINT "PublicationComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PublicationComment" ADD CONSTRAINT "PublicationComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."PublicationComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PublicationComment" ADD CONSTRAINT "PublicationComment_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "public"."Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PublicationCommentVote" ADD CONSTRAINT "PublicationCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."PublicationComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PublicationCommentVote" ADD CONSTRAINT "PublicationCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PublicationVote" ADD CONSTRAINT "PublicationVote_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "public"."Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PublicationVote" ADD CONSTRAINT "PublicationVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Recommendation" ADD CONSTRAINT "Recommendation_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Recommendation" ADD CONSTRAINT "Recommendation_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "public"."Supervisor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RecommendationComment" ADD CONSTRAINT "RecommendationComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RecommendationComment" ADD CONSTRAINT "RecommendationComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."RecommendationComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RecommendationComment" ADD CONSTRAINT "RecommendationComment_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "public"."Recommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RecommendationCommentVote" ADD CONSTRAINT "RecommendationCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."RecommendationComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RecommendationCommentVote" ADD CONSTRAINT "RecommendationCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RecommendationVote" ADD CONSTRAINT "RecommendationVote_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "public"."Recommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RecommendationVote" ADD CONSTRAINT "RecommendationVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchEvent" ADD CONSTRAINT "ResearchEvent_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchEventComment" ADD CONSTRAINT "ResearchEventComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchEventComment" ADD CONSTRAINT "ResearchEventComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."ResearchEventComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchEventComment" ADD CONSTRAINT "ResearchEventComment_researchEventId_fkey" FOREIGN KEY ("researchEventId") REFERENCES "public"."ResearchEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchEventCommentVote" ADD CONSTRAINT "ResearchEventCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."ResearchEventComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchEventCommentVote" ADD CONSTRAINT "ResearchEventCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchEventVote" ADD CONSTRAINT "ResearchEventVote_researchEventId_fkey" FOREIGN KEY ("researchEventId") REFERENCES "public"."ResearchEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchEventVote" ADD CONSTRAINT "ResearchEventVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchGrant" ADD CONSTRAINT "ResearchGrant_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchGrantComment" ADD CONSTRAINT "ResearchGrantComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchGrantComment" ADD CONSTRAINT "ResearchGrantComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."ResearchGrantComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchGrantComment" ADD CONSTRAINT "ResearchGrantComment_researchGrantId_fkey" FOREIGN KEY ("researchGrantId") REFERENCES "public"."ResearchGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchGrantCommentVote" ADD CONSTRAINT "ResearchGrantCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."ResearchGrantComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchGrantCommentVote" ADD CONSTRAINT "ResearchGrantCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchGrantVote" ADD CONSTRAINT "ResearchGrantVote_researchGrantId_fkey" FOREIGN KEY ("researchGrantId") REFERENCES "public"."ResearchGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchGrantVote" ADD CONSTRAINT "ResearchGrantVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchSurvey" ADD CONSTRAINT "ResearchSurvey_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchTool" ADD CONSTRAINT "ResearchTool_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchToolComment" ADD CONSTRAINT "ResearchToolComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchToolComment" ADD CONSTRAINT "ResearchToolComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."ResearchToolComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchToolComment" ADD CONSTRAINT "ResearchToolComment_researchToolId_fkey" FOREIGN KEY ("researchToolId") REFERENCES "public"."ResearchTool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchToolCommentVote" ADD CONSTRAINT "ResearchToolCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."ResearchToolComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchToolCommentVote" ADD CONSTRAINT "ResearchToolCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchToolVote" ADD CONSTRAINT "ResearchToolVote_researchToolId_fkey" FOREIGN KEY ("researchToolId") REFERENCES "public"."ResearchTool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchToolVote" ADD CONSTRAINT "ResearchToolVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Result" ADD CONSTRAINT "Result_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResultComment" ADD CONSTRAINT "ResultComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResultComment" ADD CONSTRAINT "ResultComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."ResultComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResultComment" ADD CONSTRAINT "ResultComment_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "public"."Result"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResultCommentVote" ADD CONSTRAINT "ResultCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."ResultComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResultCommentVote" ADD CONSTRAINT "ResultCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResultVote" ADD CONSTRAINT "ResultVote_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "public"."Result"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResultVote" ADD CONSTRAINT "ResultVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialComment" ADD CONSTRAINT "SocialComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialComment" ADD CONSTRAINT "SocialComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."SocialComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialComment" ADD CONSTRAINT "SocialComment_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "public"."SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialCommentVote" ADD CONSTRAINT "SocialCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."SocialComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialCommentVote" ADD CONSTRAINT "SocialCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialPost" ADD CONSTRAINT "SocialPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialVote" ADD CONSTRAINT "SocialVote_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "public"."SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialVote" ADD CONSTRAINT "SocialVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Supervisor" ADD CONSTRAINT "Supervisor_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupervisorComment" ADD CONSTRAINT "SupervisorComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupervisorComment" ADD CONSTRAINT "SupervisorComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."SupervisorComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupervisorComment" ADD CONSTRAINT "SupervisorComment_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "public"."Supervisor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupervisorCommentVote" ADD CONSTRAINT "SupervisorCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."SupervisorComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupervisorCommentVote" ADD CONSTRAINT "SupervisorCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupervisorVote" ADD CONSTRAINT "SupervisorVote_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "public"."Supervisor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupervisorVote" ADD CONSTRAINT "SupervisorVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SurveyAnswer" ADD CONSTRAINT "SurveyAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."SurveyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SurveyAnswer" ADD CONSTRAINT "SurveyAnswer_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "public"."SurveyResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SurveyComment" ADD CONSTRAINT "SurveyComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SurveyComment" ADD CONSTRAINT "SurveyComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."SurveyComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SurveyComment" ADD CONSTRAINT "SurveyComment_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "public"."ResearchSurvey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SurveyCommentVote" ADD CONSTRAINT "SurveyCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."SurveyComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SurveyCommentVote" ADD CONSTRAINT "SurveyCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SurveyQuestion" ADD CONSTRAINT "SurveyQuestion_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "public"."ResearchSurvey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SurveyQuestionOption" ADD CONSTRAINT "SurveyQuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."SurveyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SurveyResponse" ADD CONSTRAINT "SurveyResponse_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SurveyResponse" ADD CONSTRAINT "SurveyResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "public"."ResearchSurvey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SurveyVote" ADD CONSTRAINT "SurveyVote_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "public"."ResearchSurvey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SurveyVote" ADD CONSTRAINT "SurveyVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserActivity" ADD CONSTRAINT "UserActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
