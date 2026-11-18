"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import {
  decideManuscriptAction,
  type ReviewActionResult,
} from "@/app/actions/reviews";

/**
 * One quick triage move on a decision-board card.
 *
 * Only reversible moves are offered (`quickBoardMoves` decides which), so the
 * board never records an accept, a rejection, or a publication from a single
 * click. The button is deliberately small: a five-column board with full-size
 * buttons reads as a form, not a board.
 */
const EMPTY_RESULT: ReviewActionResult = { success: false, message: "" };

function MoveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex items-center gap-1 rounded-full border border-[var(--card-border)] px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-800"
      disabled={pending}
      type="submit"
    >
      {pending ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          Moving…
        </>
      ) : (
        label
      )}
    </button>
  );
}

export function BoardMoveForm({
  manuscriptId,
  toStatus,
  label,
}: {
  manuscriptId: string;
  toStatus: string;
  label: string;
}) {
  const [state, formAction] = useActionState(decideManuscriptAction, EMPTY_RESULT);

  return (
    <form action={formAction}>
      <input type="hidden" name="manuscriptId" value={manuscriptId} />
      <input type="hidden" name="toStatus" value={toStatus} />
      <MoveButton label={label} />
      {!state.success && state.message ? (
        <p className="mt-1 text-[11px] text-red-600 dark:text-red-400" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
