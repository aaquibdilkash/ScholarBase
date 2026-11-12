import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Tones shared by every list-page card chip.
 *
 * Each tone carries an explicit dark variant: the old urgency badges used
 * light-only backgrounds (e.g. `bg-red-200 text-red-800`) and were unreadable
 * once the card switched to the dark surface.
 */
const TONES = {
  info: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  neutral:
    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  warning:
    "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300",
  danger: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
} as const;

export type CardChipTone = keyof typeof TONES;

type CardChipProps = {
  tone?: CardChipTone;
  /** Optional leading icon; sized to match the text by the caller. */
  children: ReactNode;
  className?: string;
};

/**
 * The one chip primitive for list-page cards.
 *
 * A fixed height (not padding alone) is what keeps a chip with an icon the
 * same size as one without — previously the urgency badge's 16px clock made it
 * taller than the text-only category/type chips beside it.
 *
 * `leading-none` collapses the text's line-box so its centre lines up with the
 * centred icon instead of sitting on the line-box's ascender-heavy centre.
 */
export function CardChip({ tone = "neutral", children, className }: CardChipProps) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-[11px] font-semibold uppercase tracking-wide leading-none",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
