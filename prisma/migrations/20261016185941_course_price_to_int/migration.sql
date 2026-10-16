/*
  Warnings:

  - The `price` column on the `Course` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Course" DROP COLUMN "price",
ADD COLUMN     "price" INTEGER;
