"use client";

import { FrozenAccountBanner } from "@/components/moderation/FrozenAccountBanner";

/**
 * Own-profile fallback for frozen accounts. Notification deep-links land on
 * /scholars/[id] where the top banner can be missed on mobile scroll, so the
 * same reason+appeal entry also renders here. The flag-menu AppealButton is
 * kept as a secondary path (ReportMenu untouched).
 */
export function FrozenProfileAppealCard({ userId }: { userId: string }) {
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30">
      <FrozenAccountBanner userId={userId} />
    </div>
  );
}
