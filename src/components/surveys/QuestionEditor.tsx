"use client";

import { X } from "lucide-react";
import type { QuestionOption, Question, SkipRule, BlockInput } from "@/types/survey";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  MAX_SURVEY_QUESTION_TITLE,
  MAX_SURVEY_QUESTION_OPTION,
  MAX_MATRIX_COLUMNS,
} from "@/lib/constants";
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
  { value: "MATRIX_LIKERT", label: "Matrix / Grid (Likert)" },
];

const CHOICE_TYPES = ["MULTIPLE_CHOICE", "CHECKBOXES", "DROPDOWN"];
const SHUFFLEABLE_TYPES = [...CHOICE_TYPES, "LIKERT_SCALE"];

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
  allQuestions = [],
  blocks = [],
  onChange,
  onDelete,
}: {
  question: Question;
  index: number;
  allQuestions?: Question[];
  blocks?: BlockInput[];
  onChange: (q: Question) => void;
  onDelete: () => void;
}) {
  const needsOptions = [...CHOICE_TYPES, "MATRIX_LIKERT"].includes(
    question.type,
  );
  const isLikert = question.type === "LIKERT_SCALE";
  const isLinearScale = question.type === "LINEAR_SCALE";
  const isMatrix = question.type === "MATRIX_LIKERT";
  const supportsShuffle = SHUFFLEABLE_TYPES.includes(question.type);
  const laterQuestions = allQuestions.filter((q) => q.order > question.order);
  const canHaveSkipLogic =
    CHOICE_TYPES.includes(question.type) && laterQuestions.length > 0;

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
        <div className="flex items-center gap-3">
          {blocks.length > 0 && (
            <select
              value={question.blockId ?? ""}
              onChange={(e) =>
                onChange({ ...question, blockId: e.target.value || null })
              }
              className="sb-select max-w-40 text-xs"
              aria-label="Assign question to a section"
            >
              <option value="">No section</option>
              {blocks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="text-sm font-semibold text-red-500 hover:text-red-700"
          >
            Remove
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5">
            Question Title
            <InfoTooltip message={SURVEY_QUESTION_TITLE_TIP} />
          </label>
          <input
            type="text"
            value={question.title}
            onChange={(e) => onChange({ ...question, title: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
            placeholder="Enter your question"
            required
            maxLength={MAX_SURVEY_QUESTION_TITLE}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {question.title.length}/{MAX_SURVEY_QUESTION_TITLE} characters
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5">
              Question Type
              <InfoTooltip message={SURVEY_QUESTION_TYPE_TIP} />
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
                  "MATRIX_LIKERT",
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
                        : newType === "MATRIX_LIKERT"
                          ? ["Row 1", "Row 2", "Row 3"].map((l, i) => ({
                              value: `row_${i + 1}`,
                              label: l,
                              order: i,
                            }))
                          : [{ value: "opt_1", label: "Option 1", order: 0 }],
                  columnLabels:
                    newType === "MATRIX_LIKERT"
                      ? question.columnLabels ?? [
                          "Strongly Disagree",
                          "Neutral",
                          "Agree",
                        ]
                      : null,
                  minValue: newType === "LIKERT_SCALE" ? 1 : question.minValue,
                  maxValue: newType === "LIKERT_SCALE" ? 5 : question.maxValue,
                  // Changing type invalidates any configured skip logic.
                  skipLogic: CHOICE_TYPES.includes(newType)
                    ? question.skipLogic
                    : null,
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
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5">
                Required
                <InfoTooltip message={SURVEY_QUESTION_REQUIRED_TIP} />
              </span>
            </label>
          </div>
        </div>

        {isLinearScale && (
          <div className="grid grid-cols-2 gap-4">
             <div>
               <label className="mb-1 block text-sm font-semibold text-slate-700 inline-flex items-center gap-1.5">
                 Min Value
                 <InfoTooltip message={SURVEY_QUESTION_MIN_TIP} />
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
               <label className="mb-1 block text-sm font-semibold text-slate-700 inline-flex items-center gap-1.5">
                 Max Value
                 <InfoTooltip message={SURVEY_QUESTION_MAX_TIP} />
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
             <label className="mb-2 block text-sm font-semibold text-slate-700 inline-flex items-center gap-1.5">
               Options
               <InfoTooltip message={SURVEY_QUESTION_OPTION_TIP} />
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
                    maxLength={MAX_SURVEY_QUESTION_OPTION}
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

        {isMatrix && (
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Columns (Likert points)
            </label>
            <p className="mb-2 text-xs text-slate-500">
              Each row above becomes a variable in the export; columns are the
              answer scale shared by all rows.
            </p>
            <div className="space-y-2">
              {(question.columnLabels ?? []).map((col, ci) => (
                <div key={ci} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={col}
                    onChange={(e) => {
                      const next = [...(question.columnLabels ?? [])];
                      next[ci] = e.target.value;
                      onChange({ ...question, columnLabels: next });
                    }}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Column ${ci + 1}`}
                    required
                    maxLength={MAX_SURVEY_QUESTION_OPTION}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...question,
                        columnLabels: (question.columnLabels ?? []).filter(
                          (_, i) => i !== ci,
                        ),
                      })
                    }
                    className="text-red-400 hover:text-red-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
            {(question.columnLabels ?? []).length < MAX_MATRIX_COLUMNS && (
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...question,
                    columnLabels: [
                      ...(question.columnLabels ?? []),
                      `Column ${(question.columnLabels ?? []).length + 1}`,
                    ],
                  })
                }
                className="mt-2 text-sm font-semibold text-blue-600 hover:text-blue-800"
              >
                + Add Column
              </button>
            )}
          </div>
        )}

        {supportsShuffle && (
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={question.shuffleOptions === true}
              onChange={(e) =>
                onChange({ ...question, shuffleOptions: e.target.checked })
              }
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Randomize option order per respondent
            </span>
            <InfoTooltip message="Prevents order bias: each respondent sees the options in a different, reproducible order." />
          </label>
        )}

        {canHaveSkipLogic && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label className="mb-1 block text-sm font-semibold text-slate-700 inline-flex items-center gap-1.5">
              Skip Logic
              <InfoTooltip message="When this question's answer matches a rule, all questions up to the target are skipped for that respondent." />
            </label>
            <div className="space-y-2">
              {(question.skipLogic ?? []).map((rule, ri) => (
                <div key={ri} className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">If</span>
                  <select
                    value={rule.operator}
                    onChange={(e) => {
                      const next = [...(question.skipLogic ?? [])];
                      next[ri] = {
                        ...rule,
                        operator: e.target.value as SkipRule["operator"],
                      };
                      onChange({ ...question, skipLogic: next });
                    }}
                    className="sb-select max-w-36"
                  >
                    <option value="equals">equals</option>
                    <option value="not_equals">does not equal</option>
                    {question.type === "CHECKBOXES" && (
                      <option value="includes">includes</option>
                    )}
                  </select>
                  <select
                    value={rule.value}
                    onChange={(e) => {
                      const next = [...(question.skipLogic ?? [])];
                      next[ri] = { ...rule, value: e.target.value };
                      onChange({ ...question, skipLogic: next });
                    }}
                    className="sb-select max-w-48"
                  >
                    <option value="">choose option…</option>
                    {question.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs font-semibold text-slate-500">skip to</span>
                  <select
                    value={String(rule.skipToOrder)}
                    onChange={(e) => {
                      const next = [...(question.skipLogic ?? [])];
                      next[ri] = {
                        ...rule,
                        skipToOrder: parseInt(e.target.value, 10),
                      };
                      onChange({ ...question, skipLogic: next });
                    }}
                    className="sb-select max-w-52"
                  >
                    <option value="">choose question…</option>
                    {laterQuestions.map((q) => (
                      <option key={q.id} value={String(q.order)}>
                        Q{q.order + 1}: {q.title.slice(0, 40)}
                        {q.title.length > 40 ? "…" : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...question,
                        skipLogic: (question.skipLogic ?? []).filter(
                          (_, i) => i !== ri,
                        ),
                      })
                    }
                    className="text-red-400 hover:text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...question,
                  skipLogic: [
                    ...(question.skipLogic ?? []),
                    {
                      operator: "equals",
                      value: question.options[0]?.value ?? "",
                      skipToOrder: laterQuestions[0]?.order ?? 0,
                    },
                  ],
                })
              }
              className="mt-2 text-sm font-semibold text-blue-600 hover:text-blue-800"
            >
              + Add Skip Rule
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
