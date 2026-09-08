"use client";

import {
  MAX_SURVEY_ANSWER_SHORT,
  MAX_SURVEY_ANSWER_LONG,
} from "@/lib/constants";

type QuestionOption = {
  id?: string;
  value: string;
  label: string;
  order: number;
};

type QuestionShape = {
  id: string;
  type: string;
  required: boolean;
  minValue?: number | null;
  maxValue?: number | null;
  columnLabels?: string[] | null;
  options: QuestionOption[];
};

/**
 * Single source of truth for rendering a survey question's answer field.
 * Used by BOTH the live response form and the builder preview so they can
 * never drift apart — editing a question's visuals here updates both.
 */
export function SurveyQuestionInput({
  question,
  value,
  options,
  namePrefix = "q",
  onChange,
  onCheckboxChange,
  onMatrixChange,
}: {
  question: QuestionShape;
  value: string;
  options?: QuestionOption[];
  namePrefix?: string;
  onChange: (value: string) => void;
  onCheckboxChange: (optionValue: string, checked: boolean) => void;
  onMatrixChange: (rowValue: string, columnIndex: number) => void;
}) {
  const orderedOptions = options ?? question.options;

  switch (question.type) {
    case "SHORT_TEXT":
      // Auto-resizing single-line answer: grows as the user types and scrolls
      // vertically past max-h so long answers can always be reviewed.
      return (
        <div className="min-w-0">
          <textarea
            rows={1}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              const el = e.target;
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }}
            className="sb-textarea max-h-32 min-w-0 w-full resize-none overflow-x-auto overflow-y-auto whitespace-pre-wrap break-words break-all"
            placeholder="Your answer..."
            required={question.required}
            maxLength={MAX_SURVEY_ANSWER_SHORT}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {value.length}/{MAX_SURVEY_ANSWER_SHORT} characters
          </div>
        </div>
      );

    case "LONG_TEXT":
      return (
        <div>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className="sb-textarea resize-y"
            placeholder="Your detailed answer..."
            required={question.required}
            maxLength={MAX_SURVEY_ANSWER_LONG}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {value.length}/{MAX_SURVEY_ANSWER_LONG} characters
          </div>
        </div>
      );

    case "MULTIPLE_CHOICE":
      return (
        <div className="space-y-2">
          {orderedOptions.map((opt) => (
            <label
              key={opt.id ?? opt.value}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition hover:border-blue-200 hover:bg-blue-50/50 dark:hover:border-blue-400/30 dark:hover:bg-blue-900/20 ${
                value === opt.value
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400/50"
                  : "border-slate-200 dark:border-slate-700"
              }`}
            >
              <input
                type="radio"
                name={`${namePrefix}_${question.id}`}
                value={opt.value}
                checked={value === opt.value}
                onChange={(e) => onChange(e.target.value)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                required={question.required}
              />
              <span className="break-words text-sm font-medium text-slate-700 dark:text-slate-300">
                {opt.label}
              </span>
            </label>
          ))}
        </div>
      );

    case "CHECKBOXES":
      return (
        <div className="space-y-2">
          {orderedOptions.map((opt) => {
            const currentValues = value ? (JSON.parse(value) as string[]) : [];
            return (
              <label
                key={opt.id ?? opt.value}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition hover:border-blue-200 hover:bg-blue-50/50 dark:hover:border-blue-400/30 dark:hover:bg-blue-900/20 ${
                  currentValues.includes(opt.value)
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400/50"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <input
                  type="checkbox"
                  value={opt.value}
                  checked={currentValues.includes(opt.value)}
                  onChange={(e) => onCheckboxChange(opt.value, e.target.checked)}
                  className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="break-words text-sm font-medium text-slate-700 dark:text-slate-300">
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
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="sb-select"
          required={question.required}
        >
          <option value="">Select an option...</option>
          {orderedOptions.map((opt) => (
            <option key={opt.id ?? opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );

    case "MATRIX_LIKERT": {
      const columns = question.columnLabels ?? [];
      const current: Record<string, number> = value ? JSON.parse(value) : {};
      return (
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-2/5 pb-2 text-left font-semibold text-slate-600 dark:text-slate-300" />
                {columns.map((col, ci) => (
                  <th
                    key={ci}
                    className="px-1 pb-2 text-center text-xs font-semibold text-slate-600 dark:text-slate-300"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {question.options.map((row) => (
                <tr
                  key={row.id ?? row.value}
                  className="border-t border-slate-100 dark:border-slate-700"
                >
                  <td className="py-2 pr-2 break-words text-sm font-medium text-slate-700 dark:text-slate-300">
                    {row.label}
                  </td>
                  {columns.map((_, ci) => (
                    <td key={ci} className="px-1 py-2 text-center">
                      <input
                        type="radio"
                        name={`${namePrefix}_${question.id}_r_${row.id ?? row.value}`}
                        checked={current[row.value] === ci + 1}
                        onChange={() => onMatrixChange(row.value, ci + 1)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case "RATING":
      return (
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(String(star))}
              className={`h-10 w-10 rounded-full text-lg font-bold transition ${
                parseInt(value || "0", 10) >= star
                  ? "bg-amber-400 text-white dark:bg-amber-500"
                  : "bg-slate-100 text-slate-400 hover:bg-amber-100 dark:bg-slate-800 dark:text-slate-500 dark:hover:bg-amber-400/10"
              }`}
            >
              {star}
            </button>
          ))}
        </div>
      );
case "LINEAR_SCALE": {
      const min = question.minValue ?? 1;
      const max = question.maxValue ?? 5;
      const labels: string[] = [];
      for (let i = min; i <= max; i++) labels.push(String(i));
      return (
        <div className="flex items-center gap-1">
          {labels.map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => onChange(val)}
              className={`h-10 w-10 rounded-lg text-sm font-semibold transition ${
                value === val
                  ? "bg-blue-600 text-white dark:bg-blue-500"
                  : "bg-slate-100 text-slate-600 hover:bg-blue-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-blue-900/40"
              }`}
            >
              {val}
            </button>
          ))}
          <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
            ({min} - {max})
          </span>
        </div>
      );
    }

    case "LIKERT_SCALE":
      return (
        <div className="space-y-2">
          {orderedOptions.map((opt) => (
            <label
              key={opt.id ?? opt.value}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition hover:border-indigo-200 hover:bg-indigo-50/50 dark:hover:border-indigo-400/30 dark:hover:bg-indigo-900/20 ${
                value === opt.value
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-400/50"
                  : "border-slate-200 dark:border-slate-700"
              }`}
            >
              <input
                type="radio"
                name={`${namePrefix}_${question.id}`}
                value={opt.value}
                checked={value === opt.value}
                onChange={(e) => onChange(e.target.value)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                required={question.required}
              />
              <span className="break-words text-sm font-medium text-slate-700 dark:text-slate-300">
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
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="sb-input"
          required={question.required}
        />
      );

    default:
      return (
        <div className="min-w-0">
          <textarea
            rows={1}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              const el = e.target;
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }}
            className="sb-textarea max-h-32 min-w-0 w-full resize-none overflow-x-auto overflow-y-auto whitespace-pre-wrap break-words break-all"
            placeholder="Your answer..."
            maxLength={MAX_SURVEY_ANSWER_SHORT}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {value.length}/{MAX_SURVEY_ANSWER_SHORT} characters
          </div>
        </div>
      );
  }
}