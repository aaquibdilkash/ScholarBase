"use client";

import type { ManuscriptStatus } from "@prisma/client";
import { useActionState, useEffect, useState } from "react";

import {
  decideManuscriptAction,
  type ReviewActionResult,
} from "@/app/actions/reviews";
import { ActionResultMessage } from "@/components/workspace/ActionResultMessage";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { SubmitBtn } from "@/components/ui/SubmitBtn";
import { MAX_DECISION_NOTE } from "@/lib/publishing/constants";
import { MANUSCRIPT_STATUS_LABELS } from "@/lib/publishing/labels";

const EMPTY: ReviewActionResult = { success: false, message: "" };

/**
 * The editorial decision.
 *
 * Every option shown here was filtered server-side through the transition
 * table and the viewer's role, so this component never decides what is legal —
 * it only asks "are you sure?" once, because a decision is appended to the
 * author's permanent timeline and cannot be edited away.
 */
export function DecisionPanel({
  manuscriptId,
  options,
}: {
  manuscriptId: string;
  options: ManuscriptStatus[];
}) {
  const [state, formAction] = useActionState(decideManuscriptAction, EMPTY);
  const [pending, setPending] = useState<ManuscriptStatus | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (state.success) setPending(null);
  }, [state]);

  if (options.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        No decision is available from this state with your editorial seat.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input name="manuscriptId" type="hidden" value={manuscriptId} />
      {pending ? <input name="toStatus" type="hidden" value={pending} /> : null}

      <label className="block">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
          Decision letter
          <InfoTooltip message="Shared with the author in their submission timeline. Required for a rejection, optional otherwise." />
        </span>
        <textarea
          className="sb-input mt-1 min-h-24"
          maxLength={MAX_DECISION_NOTE}
          name="note"
          onChange={(event) => setNote(event.target.value)}
          placeholder="Summarise the decision and, for a revision, list the required changes."
          value={note}
        />
        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
          {note.length}/{MAX_DECISION_NOTE} characters
        </span>
      </label>

      {pending ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-900/20">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            Record “{MANUSCRIPT_STATUS_LABELS[pending]}”?
          </p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            This is appended to the author&apos;s timeline and cannot be undone
            from the workspace.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <SubmitBtn
              className="sb-button-primary"
              loadingText="Recording…"
            >
              Confirm {MANUSCRIPT_STATUS_LABELS[pending]}
            </SubmitBtn>
            <button
              className="text-sm font-medium text-slate-600 underline-offset-2 hover:underline dark:text-slate-400"
              onClick={() => setPending(null)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <button
              className="sb-button-soft text-sm"
              key={option}
              onClick={() => setPending(option)}
              type="button"
            >
              {MANUSCRIPT_STATUS_LABELS[option]}
            </button>
          ))}
        </div>
      )}

      <ActionResultMessage state={state} />
    </form>
  );
}
