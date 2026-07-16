import {
  createRecommendation,
  updateRecommendation,
} from "@/app/actions/recommendations";

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
  const values: RecommendationFormValues = {
    rating: initialValues?.rating ?? "5",
    turnaroundTimeDays: initialValues?.turnaroundTimeDays ?? "",
    responsivenessScore: initialValues?.responsivenessScore ?? "5",
    guidanceScore: initialValues?.guidanceScore ?? "5",
    feedback: initialValues?.feedback ?? "",
  };

  // 👇 1. Extract the Edit Action
  async function handleEditAction(formData: FormData) {
    "use server";
    await updateRecommendation(formData, String(recommendationId));
  }

  // 👇 2. Extract the Create Action
  async function handleCreateAction(formData: FormData) {
    "use server";
    await createRecommendation(formData, String(supervisorId!));
  }

  // 👇 3. Decide which action to use
  const formAction = mode === "edit" ? handleEditAction : handleCreateAction;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Mentorship Rating
        </label>
        <select
          name="rating"
          defaultValue={values.rating}
          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all text-slate-900"
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
            defaultValue={values.turnaroundTimeDays}
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
            defaultValue={values.responsivenessScore}
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all text-slate-900"
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
            defaultValue={values.guidanceScore}
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all text-slate-900"
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
        <textarea
          name="feedback"
          defaultValue={values.feedback}
          placeholder="What makes them a great supervisor? (e.g., timely feedback, supportive environment, lab resources...)"
          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all text-slate-900 placeholder:text-slate-400 h-40 resize-y"
          required
        />
      </div>

      <div className="pt-4 border-t border-slate-100 flex justify-end">
        <button
          type="submit"
          className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-sm shadow-blue-600/20 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-600/30 transition-all duration-200"
        >
          {mode === "edit" ? "Save Changes" : "Submit Recommendation"}
        </button>
      </div>
    </form>
  );
}
