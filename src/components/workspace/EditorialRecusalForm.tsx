"use client";

import { useActionState, useState } from "react";

import {
  declareEditorialRecusalAction,
  type ReviewActionResult,
} from "@/app/actions/reviews";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { SubmitBtn } from "@/components/ui/SubmitBtn";
import { ActionResultMessage } from "@/components/workspace/ActionResultMessage";
import { MAX_REVIEW_CONFLICT_REASON } from "@/lib/publishing/constants";

const EMPTY: ReviewActionResult = { success: false, message: "" };

export function EditorialRecusalForm({ manuscriptId }: { manuscriptId: string }) {
  const [state, formAction] = useActionState(declareEditorialRecusalAction, EMPTY);
  const [reason, setReason] = useState("");

  return (
    <form action={formAction} className="mt-4 rounded-xl border border-amber-300/60 bg-amber-50/70 p-3 dark:border-amber-500/30 dark:bg-amber-950/20">
      <input name="manuscriptId" type="hidden" value={manuscriptId} />
      <label className="block">
        <span className="sb-label inline-flex items-center gap-1.5">
          Recuse yourself from this manuscript
          <InfoTooltip message="Your venue role remains unchanged, but you will not be able to assign reviewers, decide, or publish this manuscript after recusing." />
        </span>
        <textarea
          className="sb-input mt-1 min-h-20"
          maxLength={MAX_REVIEW_CONFLICT_REASON}
          name="reason"
          onChange={(event) => setReason(event.target.value)}
          placeholder="Explain the conflict for the editorial record."
          required
          value={reason}
        />
        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
          {reason.length}/{MAX_REVIEW_CONFLICT_REASON} characters
        </span>
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <SubmitBtn className="sb-button-soft" loadingText="Recording…">
          Recuse from manuscript
        </SubmitBtn>
        <ActionResultMessage state={state} />
      </div>
    </form>
  );
}
