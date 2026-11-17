import type { ManuscriptStatus } from "@prisma/client";

import {
  MANUSCRIPT_STATUS_LABELS,
  manuscriptStatusTone,
  type StatusTone,
} from "@/lib/publishing/labels";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral:
    "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-300",
  progress:
    "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  success:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  danger:
    "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
};

/** One badge for every surface that shows a manuscript status. */
export function ManuscriptStatusBadge({ status }: { status: ManuscriptStatus }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${TONE_CLASSES[manuscriptStatusTone(status)]}`}
    >
      {MANUSCRIPT_STATUS_LABELS[status]}
    </span>
  );
}
