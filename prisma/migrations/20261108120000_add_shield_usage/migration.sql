-- Scholar Shield usage tracking.
--
-- One row per detector scan or rewriter run. `id` is the cuid printed on the
-- PDF as the report ID, so a report can be looked up by that value. Per-tool
-- totals are materialized on "User" so dashboards never scan this table.
--
-- `model` records which engine produced the result:
--   detector -> "on-device/cadence" | "on-device/tmr-raid"
--   rewriter -> "nano" | "local-cpu" | "local-gpu" | "groq/<model>"

CREATE TYPE "public"."ShieldTool" AS ENUM ('DETECTOR', 'REWRITER');

CREATE TABLE "public"."ShieldUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tool" "ShieldTool" NOT NULL,
    "model" TEXT NOT NULL,
    "overallScore" INTEGER,
    "neuralScore" INTEGER,
    "cadenceScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShieldUsage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShieldUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ShieldUsage_userId_tool_createdAt_idx" ON "public"."ShieldUsage"("userId", "tool", "createdAt" DESC);
CREATE INDEX "ShieldUsage_userId_createdAt_idx" ON "public"."ShieldUsage"("userId", "createdAt" DESC);
CREATE INDEX "ShieldUsage_tool_createdAt_idx" ON "public"."ShieldUsage"("tool", "createdAt" DESC);

ALTER TABLE "public"."User"
    ADD COLUMN "shieldDetectorUses" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "shieldRewriterUses" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "shieldTotalUses" INTEGER NOT NULL DEFAULT 0;
