-- CreateTable
CREATE TABLE "OrphanedAsset" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrphanedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrphanedAsset_createdAt_idx" ON "OrphanedAsset"("createdAt");
