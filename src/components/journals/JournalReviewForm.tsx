"use client";

import {
  createJournalReview,
  updateJournalReview,
} from "@/app/actions/journalReviews";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { Editor } from "@/components/ui/Editor";
import { useRouter } from "next/navigation";
import { FormCancelButton } from "@/components/ui/FormCancelButton";
import { useQueryClient } from "@tanstack/react-query";
import { upsertToList } from "@/utils/cacheMutation";
import { resetJournalReviewCount } from "./journalReviewCount";
import { useToast } from "@/components/ui/Toast";
import type { JournalReviewWithAuthor } from "@/types/cards";

import { MAX_JOURNAL_REVIEW_FEEDBACK } from "@/lib/constants";
import { getRichTextLength } from "@/lib/html";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  JOURNAL_REVIEW_RATING_TIP,
  JOURNAL_REVIEW_OUTCOME_TIP,
  JOURNAL_REVIEW_TURNAROUND_TIP,
  JOURNAL_REVIEW_EDITORIAL_TIP,
  JOURNAL_REVIEW_PEER_REVIEW_TIP,
  JOURNAL_REVIEW_FEEDBACK_TIP,
  JOURNAL_REVIEW_ANONYMOUS_TIP,
} from "@/constants/tooltips";

export type JournalReviewFormValues = {
  rating: string;
  outcome: string;
  turnaroundTimeDays: string;
  editorialQualityScore: string;
  peerReviewRigorScore: string;
  feedback: string;
  isAnonymous: boolean;
};

const OUTCOME_OPTIONS = [
  { value: "ACCEPTED", label: "Accepted" },
  { value: "MINOR_REVISION", label: "Minor Revision" },
  { value: "MAJOR_REVISION", label: "Major Revision" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
] as const;

export default function JournalReviewForm({
  mode,
  journalId,
  reviewId,
  initialValues,
}: {
  mode: "create" | "edit";
  journalId: string;
  reviewId?: string;
  initialValues?: Partial<JournalReviewFormValues>;
}) {
  const router = useRouter();
  const initial = {
    rating: initialValues?.rating ?? "5",
    outcome: initialValues?.outcome ?? "ACCEPTED",
    turnaroundTimeDays: initialValues?.turnaroundTimeDays ?? "",
    editorialQualityScore: initialValues?.editorialQualityScore ?? "5",
    peerReviewRigorScore: initialValues?.peerReviewRigorScore ?? "5",
    feedback: initialValues?.feedback ?? "",
    isAnonymous: initialValues?.isAnonymous ?? false,
  };

  const draftKey = mode === "edit" ? null : "draft_journal_review_create";
  const [draftFields, updateDraftField, resetDraft] = useFormDraft(
    draftKey,
    initial,
  );
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { submitting, submit } = useFormSubmit(
    mode !== "edit" ? resetDraft : undefined,
    {
      resetOnSuccess: mode !== "edit",
      successMessage: "Review submitted successfully!",
      errorMessage: "Failed to submit review.",
      onSuccess: (response) => {
        if (response.success && response.data) {
          upsertToList<JournalReviewWithAuthor>(
            queryClient,
            ["journalReviews", journalId],
            response.data as JournalReviewWithAuthor,
            mode,
          );
          if (journalId) {
            // Drop the cached aggregates so the overall rating chart reseeds
            // from fresh server data on the journal detail page.
            resetJournalReviewCount(queryClient, journalId);
            // Flip the header button into the Edit/Delete Review dropdown.
            queryClient.setQueryData(
              ["user_review_status", journalId],
              (response.data as JournalReviewWithAuthor).id,
            );
          }
        }
      },
    },
  );

  const isFeedbackOverLimit =
    getRichTextLength(draftFields.feedback) > MAX_JOURNAL_REVIEW_FEEDBACK;
  const isFormOverLimit = isFeedbackOverLimit;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isFormOverLimit) return;

    const formData = new FormData(e.currentTarget);

    if (mode === "edit" && reviewId) {
      const result = await updateJournalReview(formData, reviewId);
      if (result?.success && result.data) {
        upsertToList<JournalReviewWithAuthor>(
          queryClient,
          ["journalReviews", journalId],
          result.data as JournalReviewWithAuthor,
          "edit",
        );
        toast("Review updated successfully!", "success");
        router.push(`/journals/${journalId}`);
      } else {
        toast(result?.error ?? "Failed to update review.", "error");
      }
      return;
    } else if (journalId) {
      // Redirect to the journal detail page on success (mirrors the
      // recommendation flow). On failure, useFormSubmit surfaces the error
      // toast and the user stays on the form to retry.
      const ok = await submit(() => createJournalReview(formData, journalId));
      if (ok) {
        router.push(`/journals/${journalId}`);
      }
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2 inline-flex items-center gap-1.5">
          Overall Rating
          <InfoTooltip message={JOURNAL_REVIEW_RATING_TIP} />
        </label>
        <select
          name="rating"
          value={draftFields.rating}
          onChange={(e) => updateDraftField("rating", e.target.value)}
          className="sb-select"
          required
        >
          <option value="5">5 - Excellent</option>
          <option value="4">4 - Good</option>
          <option value="3">3 - Average</option>
          <option value="2">2 - Below Average</option>
          <option value="1">1 - Poor</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2 inline-flex items-center gap-1.5">
          Outcome
          <InfoTooltip message={JOURNAL_REVIEW_OUTCOME_TIP} />
        </label>
        <select
          name="outcome"
          value={draftFields.outcome}
          onChange={(e) => updateDraftField("outcome", e.target.value)}
          className="sb-select"
          required
        >
          {OUTCOME_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {/* __JR_FORM_PART_1__ */}


      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2 inline-flex items-center gap-1.5">
            Decision Turnaround (days)
            <InfoTooltip message={JOURNAL_REVIEW_TURNAROUND_TIP} />
          </label>
          <input
            type="number"
            name="turnaroundTimeDays"
            min={0}
            step={1}
            value={draftFields.turnaroundTimeDays}
            onChange={(e) =>
              updateDraftField("turnaroundTimeDays", e.target.value)
            }
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all text-slate-900"
            required
            placeholder="e.g., 14"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2 inline-flex items-center gap-1.5">
            Editorial Quality (1-5)
            <InfoTooltip message={JOURNAL_REVIEW_EDITORIAL_TIP} />
          </label>
          <select
            name="editorialQualityScore"
            value={draftFields.editorialQualityScore}
            onChange={(e) =>
              updateDraftField("editorialQualityScore", e.target.value)
            }
            className="sb-select"
            required
          >
            <option value="5">5 - Excellent</option>
            <option value="4">4 - Good</option>
            <option value="3">3 - Average</option>
            <option value="2">2 - Below Average</option>
            <option value="1">1 - Poor</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-2 inline-flex items-center gap-1.5">
            Peer Review Rigor (1-5)
            <InfoTooltip message={JOURNAL_REVIEW_PEER_REVIEW_TIP} />
          </label>
          <select
            name="peerReviewRigorScore"
            value={draftFields.peerReviewRigorScore}
            onChange={(e) =>
              updateDraftField("peerReviewRigorScore", e.target.value)
            }
            className="sb-select"
            required
          >
            <option value="5">5 - Rigorous</option>
            <option value="4">4 - Thorough</option>
            <option value="3">3 - Average</option>
            <option value="2">2 - Superficial</option>
            <option value="1">1 - Minimal</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2 inline-flex items-center gap-1.5">
          Your Feedback
          <InfoTooltip message={JOURNAL_REVIEW_FEEDBACK_TIP} />
        </label>
        <Editor
          maxLength={MAX_JOURNAL_REVIEW_FEEDBACK}
          value={draftFields.feedback}
          onChange={(data) => updateDraftField("feedback", data)}
        />
        <input type="hidden" name="feedback" value={draftFields.feedback} />
        {isFeedbackOverLimit && (
          <p className="mt-1 text-xs text-red-600">
            Feedback exceeds the character limit.
          </p>
        )}
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
        <input
          type="checkbox"
          name="isAnonymous"
          checked={draftFields.isAnonymous}
          onChange={(e) => updateDraftField("isAnonymous", e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <span>
          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
            Post anonymously
            <InfoTooltip message={JOURNAL_REVIEW_ANONYMOUS_TIP} />
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            Other scholars will see the review, but your name will stay hidden.
          </span>
        </span>
      </label>

      <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
        <FormCancelButton />
        <SubmitBtnWithAuth
          className="sb-button-primary"
          disabled={submitting || isFormOverLimit}
        >
          {mode === "edit" ? "Save Changes" : "Submit Review"}
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}
