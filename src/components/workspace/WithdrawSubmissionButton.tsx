"use client";

import { useActionState, useState } from "react";

import {
  withdrawManuscriptAction,
  type ManuscriptActionResult,
} from "@/app/actions/manuscripts";
import { ActionResultMessage } from "@/components/workspace/ActionResultMessage";
import { SubmitBtn } from "@/components/ui/SubmitBtn";

const EMPTY: ManuscriptActionResult = { success: false, message: "" };

/**
 * Author-side withdrawal.
 *
 * Deliberately not a bare button: withdrawal is what the venue's copy promises,
 * and it is also irreversible once recorded, so it takes a second click and
 * says plainly what it does — and does not — remove.
 */
export function WithdrawSubmissionButton({
  manuscriptId,
}: {
  manuscriptId: string;
}) {
  const [state, formAction] = useActionState(withdrawManuscriptAction, EMPTY);
  const [confirming, setConfirming] = useState(false);

  if (state.success) {
    return <ActionResultMessage state={state} />;
  }

  return (
    <div className="space-y-3">
      {confirming ? (
        <form action={formAction} className="space-y-3">
          <input name="manuscriptId" type="hidden" value={manuscriptId} />
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Withdraw this submission? The editor is notified, the record stays
            in your workspace, and it cannot be resubmitted — you would need to
            start a new submission.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <SubmitBtn
              className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-500/40 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40"
              loadingText="Withdrawing…"
            >
              Yes, withdraw
            </SubmitBtn>
            <button
              className="text-sm font-medium text-slate-600 underline-offset-2 hover:underline dark:text-slate-400"
              onClick={() => setConfirming(false)}
              type="button"
            >
              Keep it
            </button>
          </div>
          <ActionResultMessage state={state} />
        </form>
      ) : (
        <button
          className="text-sm font-medium text-red-700 underline-offset-2 hover:underline dark:text-red-400"
          onClick={() => setConfirming(true)}
          type="button"
        >
          Withdraw submission
        </button>
      )}
    </div>
  );
}
