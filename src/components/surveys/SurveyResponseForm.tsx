"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { submitSurveyResponse } from "@/app/actions/surveys";
import { useToast } from "@/components/ui/Toast";

type Answer = {
  id: string;
  questionId: string;
  value: string;
};

type Response = {
  id: string;
  isAnonymous: boolean;
  answers: Answer[];
} | null;

type Question = {
  id: string;
  type: string;
  title: string;
  required: boolean;
  order: number;
  minValue: number | null;
  maxValue: number | null;
  options: Array<{ id: string; value: string; label: string; order: number }>;
};

type SurveyPrivacy = "ANONYMOUS" | "NON_ANONYMOUS" | "HYBRID";

export function SurveyResponseForm({
  surveyId,
  questions,
  privacy,
  hasResponded,
  response,
}: {
  surveyId: string;
  questions: Question[];
  privacy: SurveyPrivacy;
  hasResponded: boolean;
  response: Response;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(privacy === "ANONYMOUS");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [draftRestored, setDraftRestored] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const draftKey = `draft_survey_response_${surveyId}`;

  // Hydrate form state from the saved response (DB) or the local draft.
  // Mark hydration complete so the save effect below does not clobber the
  // restored values with the initial empty state on mount.
  useEffect(() => {
    if (response) {
      const initialAnswers = response.answers.reduce(
        (acc, answer) => {
          acc[answer.questionId] = answer.value;
          return acc;
        },
        {} as Record<string, string>,
      );
      setAnswers(initialAnswers);
      setIsAnonymous(response.isAnonymous);
      setDraftRestored(false);
    } else {
      try {
        const saved = localStorage.getItem(draftKey);
        if (saved) {
          const { answers: savedAnswers, isAnonymous: savedIsAnonymous } =
            JSON.parse(saved);
          if (savedAnswers && Object.keys(savedAnswers).length > 0) {
            setAnswers(savedAnswers);
            setDraftRestored(true);
          }
          if (savedIsAnonymous !== null && savedIsAnonymous !== undefined) {
            setIsAnonymous(savedIsAnonymous);
          }
        }
      } catch {
        // ignore
      }
    }
    setHasHydrated(true);
  }, [response, draftKey, privacy]);

  // Persist answers to the local draft once hydrated, and only when there is
  // no submitted response from the DB (editing uses the DB record directly).
  useEffect(() => {
    if (!response && hasHydrated) {
      try {
        const dataToSave = { answers, isAnonymous };
        localStorage.setItem(draftKey, JSON.stringify(dataToSave));
      } catch {
        // ignore
      }
    }
  }, [answers, isAnonymous, draftKey, response, hasHydrated]);

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleCheckboxChange = (
    questionId: string,
    optionValue: string,
    checked: boolean,
  ) => {
    const current = answers[questionId] ? JSON.parse(answers[questionId]) : [];
    const updated = checked
      ? [...current, optionValue]
      : current.filter((v: string) => v !== optionValue);
    setAnswers((prev) => ({ ...prev, [questionId]: JSON.stringify(updated) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required
    for (const q of questions) {
      if (q.required && !answers[q.id]) {
        toast(`Please answer: "${q.title}"`, "error");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("isAnonymous", String(isAnonymous));
      formData.set(
        "answers",
        JSON.stringify(
          Object.entries(answers).map(([questionId, value]) => ({
            questionId,
            value,
          })),
        ),
      );

      const result = await submitSurveyResponse(formData, surveyId);
      if (result?.success) {
        toast(result.message || "Response submitted successfully!", "success");
        try {
          localStorage.removeItem(draftKey);
        } catch {
          // ignore
        }
        router.refresh();
      }
    } catch (err) {
      toast("Failed to submit response. Please try again.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderQuestion = (q: Question) => {
    switch (q.type) {
      case "SHORT_TEXT":
        return (
          <input
            type="text"
            value={answers[q.id] || ""}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="Your answer..."
            required={q.required}
          />
        );

      case "LONG_TEXT":
        return (
          <textarea
            value={answers[q.id] || ""}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-y"
            placeholder="Your detailed answer..."
            required={q.required}
          />
        );

      case "MULTIPLE_CHOICE":
        return (
          <div className="space-y-2">
            {q.options.map((opt) => (
              <label
                key={opt.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition hover:border-blue-200 hover:bg-blue-50/50 ${
                  answers[q.id] === opt.value
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200"
                }`}
              >
                <input
                  type="radio"
                  name={`q_${q.id}`}
                  value={opt.value}
                  checked={answers[q.id] === opt.value}
                  onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  required={q.required}
                />
                <span className="text-sm font-medium text-slate-700">
                  {opt.label}
                </span>
              </label>
            ))}
          </div>
        );

      case "CHECKBOXES":
        return (
          <div className="space-y-2">
            {q.options.map((opt) => {
              const currentValues = answers[q.id]
                ? JSON.parse(answers[q.id])
                : [];
              return (
                <label
                  key={opt.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition hover:border-blue-200 hover:bg-blue-50/50 ${
                    currentValues.includes(opt.value)
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    value={opt.value}
                    checked={currentValues.includes(opt.value)}
                    onChange={(e) =>
                      handleCheckboxChange(q.id, opt.value, e.target.checked)
                    }
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    {opt.label}
                  </span>
                </label>
              );
            })}
          </div>
        );

      case "DROPDOWN":
        return (
          <select
            value={answers[q.id] || ""}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            required={q.required}
          >
            <option value="">Select an option...</option>
            {q.options.map((opt) => (
              <option key={opt.id} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case "RATING":
        return (
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => handleAnswerChange(q.id, String(star))}
                className={`h-10 w-10 rounded-full text-lg font-bold transition ${
                  parseInt(answers[q.id] || "0") >= star
                    ? "bg-amber-400 text-white"
                    : "bg-slate-100 text-slate-400 hover:bg-amber-100"
                }`}
              >
                {star}
              </button>
            ))}
          </div>
        );

      case "LINEAR_SCALE":
        const min = q.minValue ?? 1;
        const max = q.maxValue ?? 5;
        const labels: string[] = [];
        for (let i = min; i <= max; i++) labels.push(String(i));
        return (
          <div className="flex items-center gap-1">
            {labels.map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handleAnswerChange(q.id, val)}
                className={`h-10 w-10 rounded-lg text-sm font-semibold transition ${
                  answers[q.id] === val
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-blue-100"
                }`}
              >
                {val}
              </button>
            ))}
            <span className="ml-2 text-xs text-slate-500">
              ({min} - {max})
            </span>
          </div>
        );

      case "LIKERT_SCALE":
        return (
          <div className="space-y-2">
            {q.options.map((opt) => (
              <label
                key={opt.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition hover:border-indigo-200 hover:bg-indigo-50/50 ${
                  answers[q.id] === opt.value
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-slate-200"
                }`}
              >
                <input
                  type="radio"
                  name={`q_${q.id}`}
                  value={opt.value}
                  checked={answers[q.id] === opt.value}
                  onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                  required={q.required}
                />
                <span className="text-sm font-medium text-slate-700">
                  {opt.label}
                </span>
              </label>
            ))}
          </div>
        );

      case "DATE":
        return (
          <input
            type="date"
            value={answers[q.id] || ""}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            required={q.required}
          />
        );

      default:
        return (
          <input
            type="text"
            value={answers[q.id] || ""}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="Your answer..."
          />
        );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Status banner: editing previous response / draft restored */}
      {response ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
          <svg
            className="h-5 w-5 shrink-0 text-blue-600 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          <div>
            <p className="text-sm font-semibold text-blue-800">
              You are editing your previous response.
            </p>
            <p className="text-xs text-blue-600 mt-0.5">
              Any changes you make will replace your earlier submission.
            </p>
          </div>
        </div>
      ) : draftRestored ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
          <svg
            className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              Draft restored.
            </p>
            <p className="text-xs text-emerald-600 mt-0.5">
              Your unsaved answers were restored from a previous session.
            </p>
          </div>
        </div>
      ) : null}

      {/* Privacy selection for HYBRID */}
      {privacy === "HYBRID" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            Response Privacy
          </h3>
          <div className="flex gap-4">
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 flex-1 transition ${
                !isAnonymous ? "border-blue-500 bg-blue-50" : "border-slate-200"
              }`}
            >
              <input
                type="radio"
                name="isAnonymous"
                checked={!isAnonymous}
                onChange={() => setIsAnonymous(false)}
                className="h-4 w-4 text-blue-600"
              />
              <div>
                <span className="block text-sm font-semibold text-slate-800">
                  Non-anonymous
                </span>
                <span className="text-xs text-slate-500">
                  Your name will be visible
                </span>
              </div>
            </label>
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 flex-1 transition ${
                isAnonymous ? "border-blue-500 bg-blue-50" : "border-slate-200"
              }`}
            >
              <input
                type="radio"
                name="isAnonymous"
                checked={isAnonymous}
                onChange={() => setIsAnonymous(true)}
                className="h-4 w-4 text-blue-600"
              />
              <div>
                <span className="block text-sm font-semibold text-slate-800">
                  Anonymous
                </span>
                <span className="text-xs text-slate-500">
                  Your identity stays hidden
                </span>
              </div>
            </label>
          </div>
        </div>
      )}

      {privacy === "ANONYMOUS" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
          <p className="text-sm font-medium text-amber-700">
            🔒 This survey is anonymous. Your identity will not be recorded.
          </p>
        </div>
      )}

      {privacy === "NON_ANONYMOUS" && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-center">
          <p className="text-sm font-medium text-blue-700">
            📝 This survey is non-anonymous. Your responses will be linked to
            your profile.
          </p>
        </div>
      )}

      {/* Questions */}
      {questions.map((q, idx) => (
        <div
          key={q.id}
          className="rounded-2xl border border-slate-200 bg-white p-6"
        >
          <div className="mb-4 flex items-start gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              {idx + 1}
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                {q.title}
                {q.required && <span className="ml-1 text-red-500">*</span>}
              </h3>
              <span className="text-xs text-slate-400">
                {q.type.replace(/_/g, " ").toLowerCase()}
              </span>
            </div>
          </div>
          {renderQuestion(q)}
        </div>
      ))}

      <button
        type="submit"
        disabled={isSubmitting}
        className="sb-button-accent w-full justify-center py-4 text-base"
      >
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <svg
              className="animate-spin h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Submitting...
          </span>
        ) : (
          `Submit Response${hasResponded ? " (Update)" : ""}`
        )}
      </button>
    </form>
  );
}
