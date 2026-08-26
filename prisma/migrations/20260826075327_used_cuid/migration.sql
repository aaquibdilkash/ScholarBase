/*
  Warnings:

  - The `isDeleted` column on the `Message` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `value` on the `SurveyAnswer` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropIndex
DROP INDEX "User_reputation_idx";

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "isDeleted",
ADD COLUMN     "isDeleted" BOOLEAN;

-- AlterTable
ALTER TABLE "SurveyAnswer" DROP COLUMN "value",
ADD COLUMN     "value" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "User_trendingScore_idx" ON "User"("trendingScore" DESC);
