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
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,

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
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

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
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,

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
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

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

-- CreateIndex
CREATE UNIQUE INDEX "ResearchGrantVote_researchGrantId_userId_key" ON "ResearchGrantVote"("researchGrantId", "userId");

-- CreateIndex
CREATE INDEX "ResearchGrantVote_researchGrantId_voteType_idx" ON "ResearchGrantVote"("researchGrantId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchGrantCommentVote_commentId_userId_key" ON "ResearchGrantCommentVote"("commentId", "userId");

-- CreateIndex
CREATE INDEX "ResearchGrantCommentVote_commentId_voteType_idx" ON "ResearchGrantCommentVote"("commentId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "CourseVote_courseId_userId_key" ON "CourseVote"("courseId", "userId");

-- CreateIndex
CREATE INDEX "CourseVote_courseId_voteType_idx" ON "CourseVote"("courseId", "voteType");

-- CreateIndex
CREATE UNIQUE INDEX "CourseCommentVote_commentId_userId_key" ON "CourseCommentVote"("commentId", "userId");

-- CreateIndex
CREATE INDEX "CourseCommentVote_commentId_voteType_idx" ON "CourseCommentVote"("commentId", "voteType");

-- AddForeignKey
ALTER TABLE "ResearchGrant" ADD CONSTRAINT "ResearchGrant_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchGrantVote" ADD CONSTRAINT "ResearchGrantVote_researchGrantId_fkey" FOREIGN KEY ("researchGrantId") REFERENCES "ResearchGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchGrantVote" ADD CONSTRAINT "ResearchGrantVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchGrantComment" ADD CONSTRAINT "ResearchGrantComment_researchGrantId_fkey" FOREIGN KEY ("researchGrantId") REFERENCES "ResearchGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchGrantComment" ADD CONSTRAINT "ResearchGrantComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "CourseComment" ADD CONSTRAINT "CourseComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseComment" ADD CONSTRAINT "CourseComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CourseComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCommentVote" ADD CONSTRAINT "CourseCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "CourseComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCommentVote" ADD CONSTRAINT "CourseCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
