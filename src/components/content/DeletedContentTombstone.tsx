import { Archive } from "lucide-react";

export type DeletedContentReason =
  | "AUTHOR"
  | "ADMIN"
  | "POST_AUTHOR"
  | "PARENT_COMMENT_AUTHOR"
  | null
  | undefined;

const clsx = (...inputs: Array<string | false | null | undefined>) =>
  inputs.filter(Boolean).join(" ");

export function deletedContentMessage(
  reason: DeletedContentReason,
  noun = "post",
) {
  if (reason === "ADMIN") return `This ${noun} was removed by a moderator.`;
  return `This ${noun} has been deleted by its author.`;
}

/**
 * The tombstone shown for deleted top-level content.
 *
 * The author's body is never rendered — the card/detail shells hide it — while
 * community-generated content (comments, and on parent pages ratings or
 * reviews) stays available. Copy, sizing and the dashed treatment mirror the
 * comment/reply tombstone so the two surfaces read the same.
 */
export function DeletedContentTombstone({
  reason,
  noun = "post",
  compact = false,
  className,
}: {
  reason: DeletedContentReason;
  noun?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={clsx(
        "flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center dark:border-slate-700 dark:bg-slate-900/70",
        compact ? "px-4 py-3" : "min-h-28 px-5 py-8",
        className,
      )}
    >
      <Archive
        className={clsx("text-slate-400", compact ? "h-4 w-4" : "h-6 w-6")}
        aria-hidden="true"
      />
      <p
        className={clsx(
          "font-semibold italic text-slate-500 dark:text-slate-400",
          compact ? "text-xs" : "text-sm",
        )}
      >
        {deletedContentMessage(reason, noun)}
      </p>
      <p
        className={clsx(
          "text-slate-400 dark:text-slate-500",
          compact ? "text-[11px]" : "text-xs",
        )}
      >
        The {noun}&apos;s content is no longer available. Community activity
        remains.
      </p>
    </div>
  );
}
