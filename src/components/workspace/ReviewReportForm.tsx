"use client";

import type { ReviewDecision } from "@prisma/client";
import { useActionState, useState } from "react";

import {
  submitReviewReportAction,
  type ReviewActionResult,
} from "@/app/actions/reviews";
import { ActionResultMessage } from "@/components/workspace/ActionResultMessage";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { SubmitBtn } from "@/components/ui/SubmitBtn";
import {
  MAX_REVIEW_COMMENTS,
  MAX_REVIEW_SCORE,
  MIN_REVIEW_SCORE,
} from "@/lib/publishing/constants";

const EMPTY: ReviewActionResult = { success: false, message: "" };

const DECISION_OPTIONS: { value: ReviewDecision; label: string }[] = [
  { value: "ACCEPT", label: "Accept as is" },
  { value: "MINOR_REVISION", label: "Minor revision" },
  { value: "MAJOR_REVISION", label: "Major revision" },
  { value: "REJECT", label: "Reject" },
];

/**
 * The reviewer's report form.
 *
 * Two fields carry the recommendation (a 1–10 score and an outcome) and one
 * carries the reasoning, because the editor needs a number to compare reports
 * and prose to write the decision letter from. The report is anonymous to the
 * author: the timeline records that a report landed, never who wrote it.
 */
export function ReviewReportForm({
  manuscriptId,
  initial,
}: {
  manuscriptId: string;
  initial?: {
    score: number | null;
    decision: ReviewDecision | null;
    comments: string;
    isCompleted: boolean;
  };
}) {
  const [state, formAction] = useActionState(submitReviewReportAction, EMPTY);
  const [comments, setComments] = useState(initial?.comments ?? "");
  const [score, setScore] = useState(
    initial?.score ? String(initial.score) : "5",
  );

  return (
    <form action={formAction} className="space-y-3">
      <input name="manuscriptId" type="hidden" value={manuscriptId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            Score
            <InfoTooltip message="1 is fatally flawed, 10 is publishable as is. The editor compares this number across reports." />
          </span>
          <input
            className="sb-input mt-1"
            max={MAX_REVIEW_SCORE}
            min={MIN_REVIEW_SCORE}
            name="score"
            onChange={(event) => setScore(event.target.value)}
            required
            type="number"
            value={score}
          />
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
            {MIN_REVIEW_SCORE}–{MAX_REVIEW_SCORE}
          </span>
        </label>

        <label className="block">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            Recommendation
            <InfoTooltip message="Your recommendation. The editor makes the final decision; a split set of reports is normal." />
          </span>
          <select
            className="sb-input mt-1"
            defaultValue={initial?.decision ?? "MINOR_REVISION"}
            name="decision"
            required
          >
            {DECISION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
          Report
          <InfoTooltip message="Explain the recommendation: strengths, weaknesses, and what the authors must change. This is shared with the editor, not with the author directly." />
        </span>
        <textarea
          className="sb-input mt-1 min-h-40"
          maxLength={MAX_REVIEW_COMMENTS}
          name="comments"
          onChange={(event) => setComments(event.target.value)}
          placeholder="Summarise the paper, its strengths, and the changes required."
          required
          value={comments}
        />
        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
          {comments.length}/{MAX_REVIEW_COMMENTS} characters
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitBtn className="sb-button-primary" loadingText="Submitting…">
          {initial?.isCompleted ? "Update report" : "Submit report"}
        </SubmitBtn>
        {initial?.isCompleted ? (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            You already reported on this round. Saving again replaces it.
          </span>
        ) : null}
      </div>

      <ActionResultMessage state={state} />
    </form>
  );
}
