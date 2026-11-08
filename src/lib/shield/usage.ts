import prisma from "@/lib/db";

export type ShieldUsageCounts = {
  shieldDetectorUses: number;
  shieldRewriterUses: number;
  shieldTotalUses: number;
};

const ZERO_COUNTS: ShieldUsageCounts = {
  shieldDetectorUses: 0,
  shieldRewriterUses: 0,
  shieldTotalUses: 0,
};

/**
 * Per-scholar toggle totals, read from the materialized `User` counters so a
 * dashboard never scans the `ShieldUsage` table.
 */
export async function getShieldUsageCounts(
  userId: string,
): Promise<ShieldUsageCounts> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      shieldDetectorUses: true,
      shieldRewriterUses: true,
      shieldTotalUses: true,
    },
  });
  return user ?? { ...ZERO_COUNTS };
}

/**
 * A single report by its cuid — the same ID printed on the PDF and used as the
 * download filename.
 */
export async function getShieldReport(id: string) {
  return prisma.shieldUsage.findUnique({ where: { id } });
}

/**
 * Recent uses for one scholar, newest first. `tool` narrows to detector or
 * rewriter history; the composite `(userId, tool, createdAt)` index covers both
 * shapes.
 */
export async function getShieldUsageHistory(
  userId: string,
  options: { tool?: "DETECTOR" | "REWRITER"; take?: number } = {},
) {
  const { tool, take = 20 } = options;
  return prisma.shieldUsage.findMany({
    where: { userId, ...(tool ? { tool } : {}) },
    orderBy: { createdAt: "desc" },
    take,
  });
}
