"use client";

import { useState, useMemo } from "react";
import { RotateCcw } from "lucide-react";
import { computeSkippedQuestionIds } from "@/lib/surveys/logic";
import { buildSurveyPages } from "@/lib/surveys/pages";
import { SurveyQuestionCard } from "./SurveyQuestionCard";
import { SurveySectionHeader } from "./SurveySectionHeader";
import { SurveyConsentGate } from "./SurveyConsentGate";
import { SurveyPager } from "./SurveyPager";
import { useToast } from "@/components/ui/Toast";
import type { BlockInput, Question } from "@/types/survey";

/** Recover a stored answer (plain string or JSON array/object) for skip logic. */
function parseAnswer(raw: string | undefined): unknown {
  if (raw === undefined || raw === "") return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function SurveyPreview({
  title,
  description,
  questions,
  blocks = [],
  consentRequired,
  consentText,
}: {
  title: string;
  description?: string | null;
  questions: Question[];
  blocks?: BlockInput[];
  consentRequired: boolean;
  consentText?: string | null;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [consented, setConsented] = useState(false);
  const [page, setPage] = useState(0);
  const [finished, setFinished] = useState(false);
  const { toast } = useToast();

  const handleChange = (id: string, value: string) =>
    setAnswers((prev) => ({ ...prev, [id]: value }));

  const handleCheckbox = (id: string, optionValue: string, checked: boolean) => {
    const current = answers[id] ? (JSON.parse(answers[id]) as string[]) : [];
    const next = checked
      ? [...current, optionValue]
      : current.filter((v) => v !== optionValue);
    setAnswers((prev) => ({ ...prev, [id]: JSON.stringify(next) }));
  };

  const handleMatrix = (id: string, rowValue: string, columnIndex: number) => {
    const current = answers[id]
      ? (JSON.parse(answers[id]) as Record<string, number>)
      : {};
    setAnswers((prev) => ({
      ...prev,
      [id]: JSON.stringify({ ...current, [rowValue]: columnIndex }),
    }));
  };

  // Skip-logic visibility mirrors the live form (shared logic module).
  const skippedQuestionIds = useMemo(
    () =>
      questions.some((q) => q.skipLogic && q.skipLogic.length)
        ? computeSkippedQuestionIds(questions, (id) => parseAnswer(answers[id]))
        : new Set<string>(),
    [questions, answers],
  );
  const visibleQuestions = useMemo(
    () => questions.filter((q) => !skippedQuestionIds.has(q.id)),
    [questions, skippedQuestionIds],
  );

  // Builder blocks may be partially created (id is optional mid-edit), so
  // narrow to the persisted shape the shared page builder expects.
  const paginableBlocks = useMemo(
    () =>
      blocks
        .filter(
          (block): block is BlockInput & { id: string; title: string; order: number } =>
            typeof block.id === "string" &&
            typeof block.title === "string" &&
            typeof block.order === "number",
        ),
    [blocks],
  );

  // Pagination mirrors the live response form exactly: visible-only questions
  // are grouped by buildSurveyPages, so sections get their own page each and
  // section-free questions fill 3-per-page General runs.
  const contentPages = useMemo(
    () => buildSurveyPages(visibleQuestions, paginableBlocks),
    [visibleQuestions, paginableBlocks],
  );
  const hasConsentPage = consentRequired;
  const pageCount = contentPages.length + (hasConsentPage ? 1 : 0);
  const isConsentPage = hasConsentPage && page === 0;
  const contentPageIndex = page - (hasConsentPage ? 1 : 0);

  const pageComplete = (qs: Question[]) =>
    qs.every((q) => {
      if (!q.required) return true;
      if (q.type === "MATRIX_LIKERT") {
        const filled = answers[q.id]
          ? Object.keys(JSON.parse(answers[q.id]) as Record<string, number>).length
          : 0;
        return filled >= q.options.length;
      }
      return answers[q.id] !== undefined && answers[q.id] !== "";
    });

  const isLastContentPage =
    contentPageIndex === contentPages.length - 1 &&
    !(hasConsentPage && contentPages.length === 0);

  const goNext = () => {
    if (isConsentPage) {
      if (!consented) return;
      setPage(1);
      return;
    }
    const currentQ = contentPages[contentPageIndex]?.questions;
    if (!currentQ || !pageComplete(currentQ)) return;
    if (contentPageIndex === contentPages.length - 1) {
      toast("This is a preview — no response was saved, only a dry run.");
      setFinished(true);
      return;
    }
    setPage(page + 1);
  };

  const goBack = () => {
    if (finished) {
      setFinished(false);
      setPage(0);
      return;
    }
    setPage(Math.max(0, page - 1));
  };

  const restart = () => {
    setAnswers({});
    setConsented(false);
    setFinished(false);
    setPage(0);
  };

const progressPct =
    pageCount <= 1
      ? finished
        ? 100
        : 0
      : Math.round(((page + (finished ? 1 : 0)) / pageCount) * 100);

  const currentQuestions =
    isConsentPage || finished
      ? []
      : contentPages[contentPageIndex]?.questions ?? [];
  const currentPage = isConsentPage
    ? null
    : contentPages[contentPageIndex] ?? null;

  return (
    <div className="w-full space-y-4">
      {/* Preview toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/30">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Respondent preview
          </p>
          <h2 className="mt-1 text-base font-bold text-slate-800 dark:text-slate-200">
            {title.trim() || "Untitled Survey"}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Page {Math.min(page + 1, pageCount || 1)} of {pageCount || 1}
          </span>
          <button
            type="button"
            onClick={restart}
            className="sb-button-soft text-xs inline-flex items-center gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-700">
        <div
          className="h-3 rounded-full bg-blue-500 transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Survey description */}
      {!!description?.trim() && (
        <p className="whitespace-pre-wrap break-words text-sm text-slate-600 dark:text-slate-300">
          {stripHtml(description)}
        </p>
      )}

      {(visibleQuestions.length === 0 && !consentRequired) && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm font-medium text-slate-500">
            No questions in this survey yet. Return to the Build tab to add some.
          </p>
        </div>
      )}

      {finished && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className="text-base font-semibold text-emerald-800 dark:text-emerald-300">
            🎉 This is how the form ends.
          </p>
          <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">
            This is a preview — no response was saved. Use Reset to start over.
          </p>
        </div>
      )}

      {/* Consent page */}
      {isConsentPage && (
        <SurveyConsentGate
          consentText={consentText}
          consented={consented}
          onChange={setConsented}
        />
      )}

      {/* Section header for the current content page */}
      {!isConsentPage && currentPage?.title && (
        <SurveySectionHeader
          title={currentPage.title}
          sectionIndex={currentPage.sectionIndex}
          sectionCount={currentPage.sectionCount}
        />
      )}

      {/* Question page */}
      {currentQuestions.map((q, idx) => (
        <SurveyQuestionCard
          key={q.id}
          question={q}
          number={
            visibleQuestions.findIndex((question) => question.id === q.id) + 1 || idx + 1
          }
          value={answers[q.id] || ""}
          options={q.options}
          namePrefix="preview_q"
          onChange={(value) => handleChange(q.id, value)}
          onCheckboxChange={(optionValue, checked) =>
            handleCheckbox(q.id, optionValue, checked)
          }
          onMatrixChange={(rowValue, columnIndex) =>
            handleMatrix(q.id, rowValue, columnIndex)
          }
        />
      ))}

      {/* Pager */}
      {!finished && (
        <SurveyPager
          onBack={goBack}
          onNext={goNext}
          backDisabled={page === 0}
          nextDisabled={isConsentPage ? !consented : !pageComplete(currentQuestions)}
          nextLabel={isLastContentPage ? "Finish" : "Next"}
        />
      )}
    </div>
  );
}