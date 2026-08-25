"use client";

import { X } from "lucide-react";
import type { QuestionOption, Question } from "@/types/survey";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  SURVEY_QUESTION_TITLE_TIP,
  SURVEY_QUESTION_TYPE_TIP,
  SURVEY_QUESTION_REQUIRED_TIP,
  SURVEY_QUESTION_MIN_TIP,
  SURVEY_QUESTION_MAX_TIP,
  SURVEY_QUESTION_OPTION_TIP,
} from "@/constants/tooltips";

export const QUESTION_TYPES = [
  { value: "SHORT_TEXT", label: "Short Text" },
  { value: "LONG_TEXT", label: "Long Text" },
  { value: "MULTIPLE_CHOICE", label: "Multiple Choice" },
  { value: "CHECKBOXES", label: "Checkboxes" },
  { value: "DROPDOWN", label: "Dropdown" },
  { value: "RATING", label: "Rating (1-5)" },
  { value: "LINEAR_SCALE", label: "Linear Scale" },
  { value: "DATE", label: "Date" },
  { value: "LIKERT_SCALE", label: "Likert Scale" },
];

export const LIKERT_OPTIONS: Record<number, string[]> = {
  3: ["Disagree", "Neutral", "Agree"],
  5: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"],
  7: [
    "Strongly Disagree",
    "Disagree",
    "Slightly Disagree",
    "Neutral",
    "Slightly Agree",
    "Agree",
    "Strongly Agree",
  ],
};

export function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function QuestionEditor({
  question,
  index,
  onChange,
  onDelete,
}: {
  question: Question;
  index: number;
  onChange: (q: Question) => void;
  onDelete: () => void;
}) {
  const needsOptions = ["MULTIPLE_CHOICE", "CHECKBOXES", "DROPDOWN"].includes(
    question.type,
  );
  const isLikert = question.type === "LIKERT_SCALE";
  const isLinearScale = question.type === "LINEAR_SCALE";

  const handleLikertScaleChange = (size: number) => {
    const labels = LIKERT_OPTIONS[size];
    const options = labels.map((label, i) => ({
      value: `likert_${i + 1}`,
      label,
      order: i,
    }));
    onChange({ ...question, minValue: 1, maxValue: size, options });
  };

  const addOption = () => {
    const opt: QuestionOption = {
      value: `opt_${generateId()}`,
      label: `Option ${question.options.length + 1}`,
      order: question.options.length,
    };
    onChange({ ...question, options: [...question.options, opt] });
  };

  const updateOption = (optIndex: number, label: string) => {
    const opts = question.options.map((o, i) =>
      i === optIndex ? { ...o, label } : o,
    );
    onChange({ ...question, options: opts });
  };

  const removeOption = (optIndex: number) => {
    onChange({
      ...question,
      options: question.options.filter((_, i) => i !== optIndex),
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:bg-slate-800 dark:border-slate-700">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          Question {index + 1}
        </span>
        <button
          type="button"
          onClick={onDelete}
          className="text-sm font-semibold text-red-500 hover:text-red-700"
        >
          Remove
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Question Title
          </label>
          <input
            type="text"
            value={question.title}
            onChange={(e) => onChange({ ...question, title: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
            placeholder="Enter your question"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Question Type
            </label>
            <select
              value={question.type}
              onChange={(e) => {
                const newType = e.target.value;
                const needsReset = ![
                  "MULTIPLE_CHOICE",
                  "CHECKBOXES",
                  "DROPDOWN",
                  "LIKERT_SCALE",
                ].includes(newType);
                onChange({
                  ...question,
                  type: newType,
                  options: needsReset
                    ? []
                    : question.options.length > 0
                      ? question.options
                      : newType === "LIKERT_SCALE"
                        ? LIKERT_OPTIONS[5].map((l, i) => ({
                            value: `likert_${i + 1}`,
                            label: l,
                            order: i,
                          }))
                        : [{ value: "opt_1", label: "Option 1", order: 0 }],
                  minValue: newType === "LIKERT_SCALE" ? 1 : question.minValue,
                  maxValue: newType === "LIKERT_SCALE" ? 5 : question.maxValue,
                });
              }}
              className="sb-select"
            >
              {QUESTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={question.required}
                onChange={(e) =>
                  onChange({ ...question, required: e.target.checked })
                }
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Required
              </span>
            </label>
          </div>
        </div>

        {isLinearScale && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Min Value
              </label>
              <input
                type="number"
                value={question.minValue ?? 1}
                onChange={(e) =>
                  onChange({
                    ...question,
                    minValue: parseInt(e.target.value) || 1,
                  })
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={0}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Max Value
              </label>
              <input
                type="number"
                value={question.maxValue ?? 10}
                onChange={(e) =>
                  onChange({
                    ...question,
                    maxValue: parseInt(e.target.value) || 10,
                  })
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={1}
              />
            </div>
          </div>
        )}

        {isLikert && (
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Scale Size
            </label>
            <p className="mb-3 text-xs text-slate-500">
              Select the number of points for the Likert scale. The options will
              be auto-generated with standard labels.
            </p>
            <div className="flex gap-2">
              {[3, 5, 7].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => handleLikertScaleChange(size)}
                  className={`flex-1 rounded-xl border-2 p-3 text-center transition ${
                    question.maxValue === size
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10 dark:border-blue-500/50"
                      : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                  }`}
                >
                  <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">
                    {size}-Point
                  </span>
                  <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                    {LIKERT_OPTIONS[size][0]} ...{" "}
                    {LIKERT_OPTIONS[size][size - 1]}
                  </span>
                </button>
              ))}
            </div>
            {question.options.length > 0 && (
              <div className="mt-4 rounded-lg bg-slate-50 p-3">
                <label className="mb-2 block text-xs font-semibold text-slate-600">
                  Preview Options:
                </label>
                <div className="space-y-1">
                  {question.options.map((opt, i) => (
                    <div
                      key={opt.value}
                      className="flex items-center gap-2 text-sm text-slate-700"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                        {i + 1}
                      </span>
                      {opt.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {needsOptions && (
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Options
            </label>
            <div className="space-y-2">
              {question.options.map((opt, optIndex) => (
                <div key={opt.value} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt.label}
                    onChange={(e) => updateOption(optIndex, e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Option ${optIndex + 1}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(optIndex)}
                    className="text-red-400 hover:text-red-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addOption}
              className="mt-2 text-sm font-semibold text-blue-600 hover:text-blue-800"
            >
              + Add Option
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
