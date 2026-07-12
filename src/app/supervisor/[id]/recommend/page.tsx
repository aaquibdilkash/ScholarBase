"use client";

import { use } from "react";
import { createRecommendation } from "@/app/actions/recommendations";
import Link from "next/link";

export default function RecommendSupervisor({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <main className="max-w-3xl mx-auto py-10 px-4">
      <div className="mb-8">
        <Link
          href={`/supervisor/${id}`}
          className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-blue-600 mb-6 transition-colors"
        >
          ← Cancel
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Recommend this Supervisor
        </h1>
        <p className="text-slate-500 mt-2">
          Help fellow scholars by sharing your positive mentorship experience.
        </p>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-8 md:p-10">
        <form
          action={async (fd) => await createRecommendation(fd, id)}
          className="flex flex-col gap-6"
        >
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Mentorship Rating
            </label>
            <select
              name="rating"
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all text-slate-900"
            >
              <option value="5">5 - Excellent (Highly Recommended)</option>
              <option value="4">4 - Very Good</option>
              <option value="3">3 - Average</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Your Feedback
            </label>
            <textarea
              name="feedback"
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
              Submit Recommendation
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
