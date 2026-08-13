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

export type RecommendationFormValues = {
  rating: string;
  turnaroundTimeDays: string;
  responsivenessScore: string;
  guidanceScore: string;
  feedback: string;
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
  };

  const draftKey = mode === "edit" ? null : "draft_recommendation_create";
  const [draftFields, updateDraftField, resetDraft] = useFormDraft(
    draftKey,
    initial
  );

  const { submitting, submit } = useFormSubmit(
    mode !== "edit" ? resetDraft : undefined,
    {
      resetOnSuccess: mode !== "edit",
      successMessage: "Recommendation submitted successfully!",
      errorMessage: "Failed to submit recommendation.",
    },
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (mode === "edit" && recommendationId) {
      await updateRecommendation(formData, recommendationId);
    } else if (supervisorId) {
      await submit(() => createRecommendation(formData, supervisorId));
    }
    if (supervisorId && mode === "edit") {
      router.push(`/supervisor/${supervisorId}`);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Mentorship Rating
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
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Feedback Turnaround Time (days)
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
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Responsiveness (1-5)
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
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Guidance Quality (1-5)
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
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Your Feedback
        </label>
        <Editor
          value={draftFields.feedback}
          onChange={(data) => updateDraftField("feedback", data)}
        />
        <input type="hidden" name="feedback" value={draftFields.feedback} />
      </div>

      <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
        {mode === "create" && supervisorId && (
          <FormCancelButton href={`/supervisor/${supervisorId}`} />
        )}
        <SubmitBtnWithAuth className="sb-button-primary" disabled={submitting}>
          {mode === "edit" ? "Save Changes" : "Submit Recommendation"}
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}
