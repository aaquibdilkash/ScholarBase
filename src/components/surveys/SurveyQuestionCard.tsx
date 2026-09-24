import { SurveyQuestionInput } from "./SurveyQuestionInput";
import type { Question } from "@/types/survey";

/** The subset of a question the card renders. `options` is required because
 * SurveyQuestionInput reads it for choice/matrix rendering; the card still
 * takes a separate `options` override so the live form can pass the
 * randomized order while the preview passes the authored order. */
type QuestionShape = Pick<
  Question,
  "id" | "type" | "title" | "required" | "options"
>;

/**
 * Read-only respondent question card: global badge number, title, required
 * star, type label and the shared answer input. Shared by the live response
 * form and the builder preview so numbering and visuals match exactly.
 */
export function SurveyQuestionCard({
  question,
  number,
  value,
  options,
  namePrefix,
  onChange,
  onCheckboxChange,
  onMatrixChange,
}: {
  question: QuestionShape;
  number: number;
  value: string;
  options?: Question["options"];
  namePrefix?: string;
  onChange: (value: string) => void;
  onCheckboxChange: (optionValue: string, checked: boolean) => void;
  onMatrixChange: (rowValue: string, columnIndex: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/30">
      <div className="mb-4 flex items-start gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
          {number}
        </span>
        <div className="min-w-0">
          <h3 className="break-words break-all whitespace-pre-wrap min-w-0 text-sm font-semibold text-slate-800 dark:text-slate-200">
            {question.title}
            {question.required && (
              <span className="ml-1 text-red-500">*</span>
            )}
          </h3>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {question.type.replace(/_/g, " ").toLowerCase()}
          </span>
        </div>
      </div>
      <SurveyQuestionInput
        question={question}
        value={value}
        options={options}
        namePrefix={namePrefix}
        onChange={onChange}
        onCheckboxChange={onCheckboxChange}
        onMatrixChange={onMatrixChange}
      />
    </div>
  );
}
