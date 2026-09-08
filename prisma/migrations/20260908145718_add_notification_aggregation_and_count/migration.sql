/*
  Warnings:

  - You are about to drop the column `editedAt` on the `Notification` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "editedAt",
ADD COLUMN     "count" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "Notification_recipientId_targetId_type_readAt_idx" ON "Notification"("recipientId", "targetId", "type", "readAt");
