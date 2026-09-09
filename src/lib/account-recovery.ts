import prisma from "@/lib/db";
import { ACCOUNT_RECOVERY_DAYS } from "@/lib/constants";

const ACCOUNT_RECOVERY_WINDOW_MS =
  ACCOUNT_RECOVERY_DAYS * 24 * 60 * 60 * 1000;

export type AccountRecoveryResult =
  | "recovered"
  | "not-deleted"
  | "expired"
  | "not-found";

/**
 * Restore a soft-deleted account only when its tombstone is younger than the
 * recovery window. `updatedAt` is the deletion timestamp because the delete
 * mutation updates no other timestamp field.
 */
export async function recoverDeletedAccount(
  userId: string,
): Promise<AccountRecoveryResult> {
  const cutoff = new Date(Date.now() - ACCOUNT_RECOVERY_WINDOW_MS);
  const result = await prisma.user.updateMany({
    where: {
      id: userId,
      isDeleted: true,
      updatedAt: { gt: cutoff },
    },
    data: {
      isDeleted: false,
      isFrozen: false,
    },
  });

  if (result.count === 1) return "recovered";

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isDeleted: true, updatedAt: true },
  });

  if (!user) return "not-found";
  if (!user.isDeleted) return "not-deleted";
  return user.updatedAt > cutoff ? "not-deleted" : "expired";
}
