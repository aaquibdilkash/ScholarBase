"use server";

import prisma from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { AppealStatus, ReportStatus } from "@prisma/client";

export type FreezeReportSummary = {
  category: string;
  count: number;
  /** Truncated anonymized excerpts — never includes reporter identity. */
  excerpts: string[];
};

export type FreezeContext = {
  isFrozen: boolean;
  hasActiveAppeal: boolean;
  reportCount: number;
  reports: FreezeReportSummary[];
  pendingAppeal: { id: string; createdAt: Date; category: string } | null;
};

/**
 * Owner-only freeze context for the "View reason & Appeal" dialog.
 *
 * RULE 2: two indexed reads only — User by PK, Report via
 * @@index([entityId, status]), Appeal via @@index([entityId, status]).
 * Reporter identity (`reporterId`, `reporter` relation) is NEVER selected,
 * so details cannot be used for retaliation.
 */
export async function getMyFreezeContext(): Promise<FreezeContext> {
  const currentUser = await requireCurrentUser("Log in to view freeze details.");
  const userId = currentUser.id;

  const [account, reports, pendingAppeal] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { isFrozen: true, hasActiveAppeal: true, reportCount: true },
    }),
    prisma.report.findMany({
      where: { entityId: userId, status: ReportStatus.PENDING },
      select: { category: true, details: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.appeal.findFirst({
      where: { entityId: userId, ownerId: userId, status: AppealStatus.PENDING },
      select: { id: true, createdAt: true, category: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const grouped = new Map<string, { count: number; excerpts: string[] }>();
  for (const r of reports) {
    const entry = grouped.get(r.category) ?? { count: 0, excerpts: [] };
    entry.count += 1;
    const excerpt = r.details?.trim().slice(0, 140);
    if (excerpt && entry.excerpts.length < 3) entry.excerpts.push(excerpt);
    grouped.set(r.category, entry);
  }

  return {
    isFrozen: account?.isFrozen ?? false,
    hasActiveAppeal: account?.hasActiveAppeal ?? false,
    reportCount: account?.reportCount ?? 0,
    reports: [...grouped.entries()].map(([category, v]) => ({
      category,
      count: v.count,
      excerpts: v.excerpts,
    })),
    pendingAppeal: pendingAppeal
      ? {
          id: pendingAppeal.id,
          createdAt: pendingAppeal.createdAt,
          category: String(pendingAppeal.category),
        }
      : null,
  };
}
