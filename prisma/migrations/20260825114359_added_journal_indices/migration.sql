/*
  Warnings:

  - You are about to drop the column `abdcCategory` on the `Journal` table. All the data in the column will be lost.
  - You are about to drop the column `scopus` on the `Journal` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "Quartile" AS ENUM ('NONE', 'Q1', 'Q2', 'Q3', 'Q4');

-- CreateEnum
CREATE TYPE "WosIndex" AS ENUM ('NONE', 'SCIE', 'SSCI', 'AHCI', 'ESCI');

-- CreateEnum
CREATE TYPE "AbdcTier" AS ENUM ('NONE', 'A*', 'A', 'B', 'C');

-- AlterTable
ALTER TABLE "Journal" DROP COLUMN "abdcCategory",
DROP COLUMN "scopus",
ADD COLUMN     "abdcRanking" "AbdcTier" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "citeScore" DOUBLE PRECISION,
ADD COLUMN     "scopusQuartile" "Quartile" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "sjrQuartile" "Quartile" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "sjrScore" DOUBLE PRECISION,
ADD COLUMN     "wosIndex" "WosIndex" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "wosQuartile" "Quartile" NOT NULL DEFAULT 'NONE';
