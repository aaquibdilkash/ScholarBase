"use client";

import {
  createRecommendation,
  updateRecommendation,
} from "@/app/actions/recommendations";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { Editor } from "@/components/ui/Editor";
import { useRouter } from "next/navigation";
import { FormCancelButton } from "@/components/ui/FormCancelButton";
import { useQueryClient } from "@tanstack/react-query";
import { upsertToList } from "@/utils/cacheMutation";
import { resetRecommendationCount } from "./recommendationCount";
import { useToast } from "@/components/ui/Toast";
import type { RecommendationWithAuthor } from "@/types/cards";

import { MAX_RECOMMENDATION_FEEDBACK } from "@/lib/constants";
import { getRichTextLength } from "@/lib/html";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  RECOMMENDATION_RATING_TIP,
  RECOMMENDATION_TURNAROUND_TIP,
  RECOMMENDATION_RESPONSIVENESS_TIP,
  RECOMMENDATION_GUIDANCE_TIP,
  RECOMMENDATION_FEEDBACK_TIP,
  RECOMMENDATION_ANONYMOUS_TIP,
} from "@/constants/tooltips";

export type RecommendationFormValues = {
  rating: string;
  turnaroundTimeDays: string;
  responsivenessScore: string;
  guidanceScore: string;
  feedback: string;
  isAnonymous: boolean;
};

export default function RecommendationForm({
  mode,
  supervisorId,
  recommendationId,
  initialValues,
}: {
  mode: "create" | "edit";
  supervisorId?: string;
  recommendationId?: string;
  initialValues?: Partial<RecommendationFormValues>;
}) {
  const router = useRouter();
  const initial = {
    rating: initialValues?.rating ?? "5",
    turnaroundTimeDays: initialValues?.turnaroundTimeDays ?? "",
    responsivenessScore: initialValues?.responsivenessScore ?? "5",
    guidanceScore: initialValues?.guidanceScore ?? "5",
    feedback: initialValues?.feedback ?? "",
    isAnonymous: initialValues?.isAnonymous ?? false,
  };

  const draftKey = mode === "edit" ? null : "draft_recommendation_create";
  const [draftFields, updateDraftField, resetDraft] = useFormDraft(
    draftKey,
    initial
  );
    const queryClient = useQueryClient();
  const { toast } = useToast();

  const { submitting, submit } = useFormSubmit(
    mode !== "edit" ? resetDraft : undefined,
    {
      resetOnSuccess: mode !== "edit",
      successMessage: "Recommendation submitted successfully!",
      errorMessage: "Failed to submit recommendation.",
      onSuccess: (response) => {
        if (response.success && response.data) {
          upsertToList<RecommendationWithAuthor>(
            queryClient,
            ["recommendations", supervisorId],
            response.data as RecommendationWithAuthor,
            mode,
          );
          // On create/update the count may have changed (brand-new rec, or an
          // anonymity flip). Drop the cached total so the following
          // router.push to the supervisor page reseeds from fresh server data.
          if (supervisorId) resetRecommendationCount(queryClient, supervisorId);
        }
      },
    },
  );

  const isFeedbackOverLimit =
    getRichTextLength(draftFields.feedback) > MAX_RECOMMENDATION_FEEDBACK;
  const isFormOverLimit = isFeedbackOverLimit;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isFormOverLimit) return;

    const formData = new FormData(e.currentTarget);

    if (mode === "edit" && recommendationId) {
      const result = await updateRecommendation(formData, recommendationId);
      if (result?.success && result.data) {
        upsertToList<RecommendationWithAuthor>(
          queryClient,
          ["recommendations", supervisorId],
          result.data as RecommendationWithAuthor,
          "edit",
        );
        // The rating/star distribution may have changed. Drop the cached
        // aggregates so the overall rating + star bars reseed from the fresh
        // server data on the next render. (The useFormSubmit onSuccess hook
        // only runs on the create path, so we must reset here for edits.)
        if (supervisorId) resetRecommendationCount(queryClient, supervisorId);
        toast("Recommendation updated successfully!", "success");
        router.push(`/supervisor/${supervisorId}`);
      } else {
        // Surface the server message and stay on the form so the user can retry.
        toast(result?.error ?? "Failed to update recommendation.", "error");
      }
      return;
    } else if (supervisorId) {
      await submit(() => createRecommendation(formData, supervisorId));
      
    }
    router.push(`/supervisor/${supervisorId}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2 inline-flex items-center gap-1.5">
          Mentorship Rating
          <InfoTooltip message={RECOMMENDATION_RATING_TIP} />
        </label>
        <select
          name="rating"
          value={draftFields.rating}
          onChange={(e) => updateDraftField("rating", e.target.value)}
          className="sb-select"
          required
        >
          <option value="5">5 - Excellent (Highly Recommended)</option>
          <option value="4">4 - Very Good</option>
          <option value="3">3 - Average</option>
          <option value="2">2 - Below Average</option>
          <option value="1">1 - Poor (Not Recommended)</option>
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2 inline-flex items-center gap-1.5">
          Feedback Turnaround Time (days)
          <InfoTooltip message={RECOMMENDATION_TURNAROUND_TIP} />
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
            placeholder="e.g., 7"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2 inline-flex items-center gap-1.5">
            Responsiveness (1-5)
            <InfoTooltip message={RECOMMENDATION_RESPONSIVENESS_TIP} />
          </label>
          <select
            name="responsivenessScore"
            value={draftFields.responsivenessScore}
            onChange={(e) =>
              updateDraftField("responsivenessScore", e.target.value)
            }
            className="sb-select"
            required
          >
            <option value="5">5 - Very responsive</option>
            <option value="4">4 - Responsive</option>
            <option value="3">3 - Average</option>
            <option value="2">2 - Slow</option>
            <option value="1">1 - Very slow</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-2 inline-flex items-center gap-1.5">
            Guidance Quality (1-5)
            <InfoTooltip message={RECOMMENDATION_GUIDANCE_TIP} />
          </label>
          <select
            name="guidanceScore"
            value={draftFields.guidanceScore}
            onChange={(e) => updateDraftField("guidanceScore", e.target.value)}
            className="sb-select"
            required
          >
            <option value="5">5 - Excellent guidance</option>
            <option value="4">4 - Strong guidance</option>
            <option value="3">3 - Adequate</option>
            <option value="2">2 - Limited guidance</option>
            <option value="1">1 - Poor guidance</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2 inline-flex items-center gap-1.5">
          Your Feedback
          <InfoTooltip message={RECOMMENDATION_FEEDBACK_TIP} />
        </label>
        <Editor
          maxLength={MAX_RECOMMENDATION_FEEDBACK}
          value={draftFields.feedback}
          onChange={(data) => updateDraftField("feedback", data)}
        />
        <input type="hidden" name="feedback" value={draftFields.feedback} />
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
          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5">
            Post anonymously
            <InfoTooltip message={RECOMMENDATION_ANONYMOUS_TIP} />
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            Other scholars will see the recommendation, but your name will stay hidden.
          </span>
        </span>
      </label>
      <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
        <FormCancelButton />
        <SubmitBtnWithAuth className="sb-button-primary" disabled={submitting || isFormOverLimit}>
          {mode === "edit" ? "Save Changes" : "Submit Recommendation"}
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}
