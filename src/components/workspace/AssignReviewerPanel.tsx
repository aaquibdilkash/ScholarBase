"use client";

import { useActionState, useState } from "react";

import {
  assignReviewerAction,
  type ReviewActionResult,
} from "@/app/actions/reviews";
import { ActionResultMessage } from "@/components/workspace/ActionResultMessage";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { SubmitBtn } from "@/components/ui/SubmitBtn";
import type { ReviewerCandidate } from "@/lib/publishing/reviewer-suggestions";

const EMPTY: ReviewActionResult = { success: false, message: "" };
const MAX_EMAIL = 320;

/**
 * Attach a reviewer to this paper by account email.
 *
 * Email rather than a user picker: the editorial desk knows who it wants before
 * it knows whether that person has an account, and a free-text field that
 * reports "no account uses that email" is a shorter path than a search UI. The
 * action refuses the author and the assigning editor.
 */
export function AssignReviewerPanel({
  manuscriptId,
  disabledReason,
  suggestions = [],
}: {
  manuscriptId: string;
  disabledReason?: string;
  suggestions?: ReviewerCandidate[];
}) {
  const [state, formAction] = useActionState(assignReviewerAction, EMPTY);
  const [email, setEmail] = useState("");

  if (disabledReason) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {disabledReason}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input name="manuscriptId" type="hidden" value={manuscriptId} />

      <label className="block">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
          Reviewer email
          <InfoTooltip message="The reviewer must already have a ScholarBase account. They will see this manuscript in their workspace and can submit one private report." />
        </span>
        <input
          autoComplete="off"
          className="sb-input mt-1"
          maxLength={MAX_EMAIL}
          name="reviewerEmail"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="reviewer@university.edu"
          required
          type="email"
          value={email}
        />
        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
          {email.length}/{MAX_EMAIL} characters
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitBtn className="sb-button-primary" loadingText="Assigning…">
          Assign reviewer
        </SubmitBtn>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          The paper moves to peer review on the first assignment.
        </span>
      </div>

      {suggestions.length > 0 ? (
        <div className="rounded-xl border border-[var(--card-border)] p-3">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            From stated research interests
          </p>
          <ul className="mt-2 space-y-1.5">
            {suggestions.map((suggestion) => (
              <li
                className="flex flex-wrap items-center justify-between gap-2"
                key={suggestion.id}
              >
                <span className="min-w-0 text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {suggestion.name ?? suggestion.email}
                  </span>
                  {` · matches ${suggestion.matched.join(", ")}`}
                </span>
                <button
                  className="text-xs font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                  onClick={() => setEmail(suggestion.email)}
                  type="button"
                >
                  Use
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ActionResultMessage state={state} />
    </form>
  );
}
