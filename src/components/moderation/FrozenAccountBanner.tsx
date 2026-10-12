"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HelpCircle, Loader2 } from "lucide-react";
import { AppealButton } from "@/components/appeals/AppealButton";
import {
  getMyFreezeContext,
  type FreezeContext,
} from "@/app/actions/freeze-context";

function prettyCategory(category: string) {
  return category
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Frozen-account banner content. Rendered BELOW the navbar in layout.tsx so
 * the sticky navbar keeps its pinning. Holds the "View reason & Appeal"
 * dialog: reason section (aggregated, anonymized) + the same AppealButton
 * used behind the profile flag menu.
 */
export function FrozenAccountBanner({ userId }: { userId: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div
        role="alert"
        className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
      >
        <span className="inline-flex items-center gap-2">
          <span aria-hidden>❄</span>
          <span>
            Your account is frozen. You can still browse, but posting,
            commenting, voting, reporting and other interactions are disabled
            until a moderator reviews your account.
          </span>
        </span>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-amber-700"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          View reason &amp; Appeal
        </button>
      </div>

      {isOpen && (
        <FreezeDialog userId={userId} onClose={() => setIsOpen(false)} />
      )}
    </>
  );
}

function FreezeDialog({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const { data, isPending, isError } = useQuery<FreezeContext>({
    queryKey: ["freeze-context", userId],
    queryFn: () => getMyFreezeContext(),
    staleTime: 30_000,
  });

  return (
    <div className="fixed inset-0 z-modal overflow-y-auto">
      <div
        className="flex min-h-full items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Why is my account frozen?
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <span className="sr-only">Close</span>x
            </button>
          </div>

          {isPending ? (
            <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading freeze details...
            </p>
          ) : isError || !data ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Could not load freeze details. You can still file an appeal
              below, or from the flag menu on your profile.
            </p>
          ) : (
            <div className="mb-4 flex flex-col gap-2">
              {data.reports.length === 0 ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  An administrator froze your account after reviewing reports
                  against your profile
                  {data.reportCount > 0 ? ` (${data.reportCount} total)` : ""}.
                  Reporter identities are kept private.
                </p>
              ) : (
                data.reports.map((r) => (
                  <div
                    key={r.category}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  >
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {prettyCategory(r.category)} x {r.count}
                    </p>
                    {r.excerpts.map((ex, i) => (
                      <p
                        key={i}
                        className="mt-1 text-xs text-slate-500 dark:text-slate-400"
                      >
                        &ldquo;{ex}&rdquo;
                      </p>
                    ))}
                  </div>
                ))
              )}
              {data.pendingAppeal && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
                  Appeal pending review — moderators will decide shortly.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Close
            </button>
            <AppealButton
              entityId={userId}
              module="SCHOLAR_PROFILE"
              entityType="POST"
              hasActiveAppeal={data?.hasActiveAppeal ?? false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
