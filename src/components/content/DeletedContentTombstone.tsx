import { Archive } from "lucide-react";

export type DeletedContentReason = "AUTHOR" | "ADMIN" | "POST_AUTHOR" | "PARENT_COMMENT_AUTHOR" | null | undefined;

export function deletedContentMessage(reason: DeletedContentReason, noun = "post") {
  if (reason === "ADMIN") return `This ${noun} was removed by a moderator.`;
  return `This ${noun} has been deleted by its author.`;
}

/**
 * The single notice shown for author-deleted content. The deleted item's
 * preserved body remains visible, while its author identity and interactions
 * are hidden/disabled by the shared card shells.
 */
export function deletedContentNotice(reason: DeletedContentReason, noun = "post") {
  return `${deletedContentMessage(reason, noun)} The discussion and preserved content remain available; interactions are disabled.`;
}

export function deletedByLabel(reason: DeletedContentReason) {
  return reason === "ADMIN" ? "moderator" : "author";
}

export function DeletedContentTombstone({
  reason,
  noun = "post",
}: {
  reason: DeletedContentReason;
  noun?: string;
}) {
  return (
    <div
      role="status"
      className="flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center dark:border-slate-700 dark:bg-slate-900/70"
    >
      <div className="flex max-w-md flex-col items-center gap-2">
        <Archive className="h-6 w-6 text-slate-400" aria-hidden="true" />
        <p className="text-sm font-semibold italic text-slate-500 dark:text-slate-400">
          {deletedContentMessage(reason, noun)}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          The discussion remains available because this {noun} has community activity.
        </p>
      </div>
    </div>
  );
}
