import Link from "next/link";
import { ChevronLeft, ShieldAlert } from "lucide-react";
import { AppealButton } from "@/components/appeals/AppealButton";

/**
 * The only surface a moderator-deleted row exposes to the public: nothing.
 *
 * The page renders this instead of the content card when
 * `getModeratorDeletedContent` resolved the viewer as the author or an admin.
 * The body, media, comments, votes and bookmarks are never fetched, so there is
 * nothing left in the payload to leak.
 */
export function RemovedContentNotice({
  backHref,
  backLabel,
  entityId,
  module,
  ownerId,
  currentUserId,
  hasActiveAppeal = false,
  noun = "content",
}: {
  backHref: string;
  backLabel: string;
  entityId: string;
  module: string;
  ownerId: string | null;
  currentUserId?: string | null;
  hasActiveAppeal?: boolean;
  noun?: string;
}) {
  const isOwner = Boolean(currentUserId) && currentUserId === ownerId;

  return (
    <main className="mx-auto w-full max-w-3xl px-0 py-3 sm:px-6 sm:py-8 md:px-8 md:py-10">
      <Link
        prefetch={false}
        href={backHref}
        className="mb-6 inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <ChevronLeft className="h-5 w-4" />
        {backLabel}
      </Link>

      <div className="sb-card min-w-0 w-full p-6 sm:p-6 md:p-8">
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center dark:border-slate-700 dark:bg-slate-900/70">
          <ShieldAlert
            className="h-7 w-7 text-slate-400"
            aria-hidden="true"
          />
          <p className="text-sm font-semibold italic text-slate-600 dark:text-slate-300">
            This {noun} was removed by a moderator.
          </p>
          <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">
            It is no longer visible to the community.
          </p>
          {isOwner && (
            <div className="mt-2">
              <AppealButton
                entityId={entityId}
                module={module}
                entityType="POST"
                hasActiveAppeal={hasActiveAppeal}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
