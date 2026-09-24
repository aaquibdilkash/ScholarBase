"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { submitSurveyResponse } from "@/app/actions/surveys";
import { useToast } from "@/components/ui/Toast";
import { useAuthModal } from "@/components/interactions/AuthModal";
import { Loader2, PencilLine, RefreshCw } from "lucide-react";
import { computeSkippedQuestionIds,
  seededShuffle,
  hashString,
} from "@/lib/surveys/logic";
import { buildSurveyPages } from "@/lib/surveys/pages";
import { SurveySectionHeader } from "./SurveySectionHeader";
import { SurveyConsentGate } from "./SurveyConsentGate";
import { SurveyQuestionCard } from "./SurveyQuestionCard";
import { SurveyPager } from "./SurveyPager";
import type { SkipRule, SurveyBlock } from "@/types/survey";

type Answer = {
  id: string;
  questionId: string;
  value: unknown;
};

type Response = {
  id: string;
  isAnonymous: boolean;
  consentedAt: Date | string | null;
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
  shuffleOptions?: boolean;
  skipLogic?: SkipRule[] | null;
  columnLabels?: string[] | null;
  blockId?: string | null;
  options: Array<{ id: string; value: string; label: string; order: number }>;
};

type SurveyPrivacy = "ANONYMOUS" | "NON_ANONYMOUS" | "HYBRID";

export function SurveyResponseForm({
  surveyId,
  questions,
  blocks = [],
  privacy,
  hasResponded,
  response,
  consentRequired = false,
  consentText,
}: {
  surveyId: string;
  questions: Question[];
  blocks?: SurveyBlock[];
  privacy: SurveyPrivacy;
  hasResponded: boolean;
  response: Response;
  consentRequired?: boolean;
  consentText?: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { openAuthModal } = useAuthModal();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(privacy === "ANONYMOUS");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [draftRestored, setDraftRestored] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [page, setPage] = useState(0);
  const draftKey = `draft_survey_response_${surveyId}`;
  const activeQuestionIds = useMemo(
    () => new Set(questions.map((question) => question.id)),
    [questions],
  );

  // Initialize consented from DB response (consentedAt field) so it's
  // prefilled on the very first render when editing; draft-restored consent
  // still happens in the hydration effect for the new-response flow.
  const [consented, setConsented] = useState(() => {
    if (response) return response.consentedAt !== null;
    return false;
  });

  // Randomization seed: generated once per mount, stored on the response so
  // the exact shuffled order a respondent saw is reconstructible. Set in an
  // effect to avoid SSR/CSR hydration mismatches (unshuffled on the server).
  const [seed, setSeed] = useState<number | null>(null);
  const mountedAtRef = useRef<number | null>(null);
  useEffect(() => {
    mountedAtRef.current = Date.now();
    setSeed(Math.floor(Math.random() * 2 ** 31) + 1);
  }, []);

  // Option randomization (order-bias control): per-question display order.
  const optionsByQuestion = useMemo(() => {
    const map = new Map<string, typeof questions[number]["options"]>();
    for (const question of questions) {
      map.set(
        question.id,
        question.shuffleOptions && seed !== null
          ? seededShuffle(question.options, (seed ^ hashString(question.id)) >>> 0)
          : question.options,
      );
    }
    return map;
  }, [questions, seed]);

  // Block randomization: shuffle question order within blocks flagged
  // randomizeOrder, preserving each block's position in the survey.
  const orderedQuestions = useMemo(() => {
    if (seed === null || blocks.length === 0) return questions;
    const randomizedBlocks = new Map(
      blocks
        .filter((b) => b.randomizeOrder)
        .map((b) => [b.id, seededShuffle(
          questions.filter((q) => q.blockId === b.id),
          (seed ^ hashString(b.id)) >>> 0,
        )]),
    );
    if (randomizedBlocks.size === 0) return questions;
    const emitted = new Set<string>();
    const result: Question[] = [];
    for (const question of questions) {
      if (emitted.has(question.id)) continue;
      const randomized = question.blockId
        ? randomizedBlocks.get(question.blockId)
        : undefined;
      if (randomized) {
        for (const q of randomized) {
          if (!emitted.has(q.id)) {
            emitted.add(q.id);
            result.push(q);
          }
        }
      } else {
        emitted.add(question.id);
        result.push(question);
      }
    }
    return result;
  }, [questions, blocks, seed]);

  // Skip-logic visibility, re-evaluated on every answer change. The server
  // re-validates the same rules on submit (shared logic module).
  const skippedQuestionIds = useMemo(
    () =>
      questions.some((q) => q.skipLogic != null)
        ? computeSkippedQuestionIds(questions, (id) => {
            const raw = answers[id];
            if (raw === undefined) return undefined;
            try {
              return JSON.parse(raw);
            } catch {
              return raw;
            }
          })
        : new Set<string>(),
    [questions, answers],
  );
  const visibleQuestions = useMemo(
    () => orderedQuestions.filter((q) => !skippedQuestionIds.has(q.id)),
    [orderedQuestions, skippedQuestionIds],
  );

  // Pagination mirrors the builder preview exactly: visible-only questions
  // grouped by the shared builder, so sections get their own page each and
  // section-free questions fill 3-per-page General runs.
  const contentPages = useMemo(
    () => buildSurveyPages(visibleQuestions, blocks),
    [blocks, visibleQuestions],
  );
  const hasConsentPage = consentRequired;
  const pageCount = contentPages.length + (hasConsentPage ? 1 : 0);
  const isConsentPage = hasConsentPage && page === 0;
  const contentPageIndex = page - (hasConsentPage ? 1 : 0);
  const [consentError, setConsentError] = useState(false);
  const currentPage = isConsentPage ? null : contentPages[contentPageIndex] ?? null;

  useEffect(() => {
    if (pageCount === 0) {
      if (page !== 0) setPage(0);
      return;
    }
    if (page >= pageCount) setPage(pageCount - 1);
  }, [page, pageCount]);

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

  const goNext = () => {
    if (isConsentPage) {
      if (!consented) {
        setConsentError(true);
        return;
      }
      setConsentError(false);
      setPage(1);
      return;
    }
    const currentQ = contentPages[contentPageIndex]?.questions;
    if (!currentQ || !pageComplete(currentQ)) return;
    if (contentPageIndex === contentPages.length - 1) {
      // Last page - submit will handle validation
      return;
    }
    setPage(page + 1);
  };

  const goBack = () => {
    setPage(Math.max(0, page - 1));
  };

  const currentQuestions =
    isConsentPage ? [] : currentPage?.questions ?? [];

  // Hydrate form state from the saved response (DB) or the local draft.
  // Mark hydration complete so the save effect below does not clobber the
  // restored values with the initial empty state on mount.
  useEffect(() => {
    if (response) {
      const initialAnswers = response.answers.reduce(
        (acc, answer) => {
          if (activeQuestionIds.has(answer.questionId)) {
            // FIX: If Prisma returns an array, stringify it so our internal state stays happy
            acc[answer.questionId] = typeof answer.value === 'string' 
              ? answer.value 
              : JSON.stringify(answer.value);
          }
          return acc;
        },
        {} as Record<string, string>,
      );
      setAnswers(initialAnswers);
      setIsAnonymous(response.isAnonymous);
      setConsented(response.consentedAt !== null);
      setDraftRestored(false);
    } else {
      try {
        const saved = localStorage.getItem(draftKey);
        if (saved) {
          const { answers: savedAnswers, isAnonymous: savedIsAnonymous, consented: savedConsented } =
            JSON.parse(saved);
          const activeSavedAnswers = Object.fromEntries(
            Object.entries(savedAnswers ?? {}).filter(
              ([questionId, value]) => activeQuestionIds.has(questionId) && typeof value === "string",
            ),
          ) as Record<string, string>;
          if (Object.keys(activeSavedAnswers).length > 0) {
            setAnswers(activeSavedAnswers);
            setDraftRestored(true);
          }
          if (savedIsAnonymous !== null && savedIsAnonymous !== undefined) {
            setIsAnonymous(savedIsAnonymous);
          }
          if (savedConsented !== null && savedConsented !== undefined) {
            setConsented(savedConsented);
          }
        }
      } catch {
        // ignore
      }
    }
    setHasHydrated(true);
  }, [response, draftKey, privacy, activeQuestionIds]);

  // Persist answers to the local draft once hydrated, and only when there is
  // no submitted response from the DB (editing uses the DB record directly).
  useEffect(() => {
    if (!response && hasHydrated) {
      try {
        const dataToSave = { answers, isAnonymous, consented };
        localStorage.setItem(draftKey, JSON.stringify(dataToSave));
      } catch {
        // ignore
      }
    }
  }, [answers, isAnonymous, consented, draftKey, response, hasHydrated]);

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

  // MATRIX_LIKERT answers: { [rowOptionValue]: columnIndex(1-based) } stored
  // as a JSON string, consistent with other multi-value answers.
  const handleMatrixChange = (
    questionId: string,
    rowValue: string,
    columnIndex: number,
  ) => {
    const current = answers[questionId]
      ? (JSON.parse(answers[questionId]) as Record<string, number>)
      : {};
    setAnswers((prev) => ({
      ...prev,
      [questionId]: JSON.stringify({ ...current, [rowValue]: columnIndex }),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (consentRequired && !consented) {
      toast("Please accept the consent form to continue.", "error");
      return;
    }

    // Validate required answers against VISIBLE questions only — a question
    // hidden by skip logic is not applicable and must not block submission.
    for (const q of visibleQuestions) {
      if (!q.required) continue;
      if (q.type === "MATRIX_LIKERT") {
        const filled = answers[q.id]
          ? Object.keys(JSON.parse(answers[q.id]) as Record<string, number>).length
          : 0;
        if (filled < q.options.length) {
          toast(`Please answer all rows of: "${q.title}"`, "error");
          return;
        }
      } else if (!answers[q.id]) {
        toast(`Please answer: "${q.title}"`, "error");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("isAnonymous", String(isAnonymous));
      formData.set(
        "startedAt",
        mountedAtRef.current
          ? new Date(mountedAtRef.current).toISOString()
          : new Date().toISOString(),
      );
      if (seed !== null) formData.set("seed", String(seed));
      if (consentRequired) formData.set("consented", String(consented));
      formData.set(
        "answers",
        JSON.stringify(
          visibleQuestions
            .filter((q) => answers[q.id] !== undefined && answers[q.id] !== "")
            .map((q) => ({ questionId: q.id, value: answers[q.id] })),
        ),
      );

      const result = await submitSurveyResponse(formData, surveyId);
      if ("error" in result) {
        if (result.error === "UNAUTHORIZED") {
          openAuthModal();
        } else if (result.error) {
          toast(result.error, "error");
        }
        return;
      }
      if (result.success) {
        toast("Response submitted successfully!", "success");
        try {
          localStorage.removeItem(draftKey);
        } catch {
          // ignore
        }
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to submit response:", err);
      toast("Failed to submit response. Please try again.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      {/* Status banner: editing previous response / draft restored */}
      {response ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 flex items-start gap-3 dark:border-blue-500/30 dark:bg-blue-500/10">
          <PencilLine className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
              You are editing your previous response.
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
              Any changes you make will replace your earlier submission.
            </p>
          </div>
        </div>
      ) : draftRestored ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <RefreshCw className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              Draft restored.
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
              Your unsaved answers were restored from a previous session.
            </p>
          </div>
        </div>
      ) : null}

      {/* Privacy selection for HYBRID */}
      {privacy === "HYBRID" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/30">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            Response Privacy
          </h3>
          <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
            <label
              className={`flex min-w-[16rem] flex-1 cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
                !isAnonymous
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400/50"
                  : "border-slate-200 dark:border-slate-700"
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
                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Non-anonymous
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Your name will be visible
                </span>
              </div>
            </label>
            <label
              className={`flex min-w-[16rem] flex-1 cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
                isAnonymous
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400/50"
                  : "border-slate-200 dark:border-slate-700"
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
                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Anonymous
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Your identity stays hidden
                </span>
              </div>
            </label>
          </div>
        </div>
      )}

      {privacy === "ANONYMOUS" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
            🔒 This survey is anonymous. Your identity will not be recorded.
          </p>
        </div>
      )}

      {privacy === "NON_ANONYMOUS" && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-center dark:border-blue-500/30 dark:bg-blue-500/10">
          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
            📝 This survey is non-anonymous. Your responses will be linked to
            your profile.
          </p>
        </div>
      )}

      {/* Progress bar */}
      {pageCount > 1 && (
        <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-700">
          <div
            className="h-3 rounded-full bg-blue-500 transition-all"
            style={{ width: `${Math.round(((page + 1) / pageCount) * 100)}%` }}
          />
        </div>
      )}

      {/* Page indicator */}
      {pageCount > 1 && (
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 text-center">
          Page {page + 1} of {pageCount}
        </p>
      )}

      {!isConsentPage && currentPage?.title && (
        <SurveySectionHeader
          title={currentPage.title}
          sectionIndex={currentPage.sectionIndex}
          sectionCount={currentPage.sectionCount}
        />
      )}

      {/* IRB CONSENT GATE: shown as first page when required and not yet consented */}
      {isConsentPage && (
        <SurveyConsentGate
          consentText={consentText}
          consented={consented}
          consentError={consentError}
          onChange={(checked) => {
            setConsented(checked);
            if (checked) setConsentError(false);
          }}
        />
      )}

      {/* Questions (paginated, visible only — skip logic hides non-applicable ones) */}
      {!isConsentPage && currentQuestions.map((q) => (
        <SurveyQuestionCard
          key={q.id}
          question={q}
          number={visibleQuestions.findIndex((question) => question.id === q.id) + 1}
          value={answers[q.id] || ""}
          options={optionsByQuestion.get(q.id) ?? q.options}
          onChange={(value) => handleAnswerChange(q.id, value)}
          onCheckboxChange={(optionValue, checked) =>
            handleCheckboxChange(q.id, optionValue, checked)
          }
          onMatrixChange={(rowValue, columnIndex) =>
            handleMatrixChange(q.id, rowValue, columnIndex)
          }
        />
      ))}

      {/* Pagination controls */}
      {!isConsentPage && pageCount > 1 && (
        <SurveyPager
          onBack={goBack}
          onNext={goNext}
          backDisabled={page === 0}
          submit={contentPageIndex === contentPages.length - 1}
          submitLabel={`Submit Response${hasResponded ? " (Update)" : ""}`}
          submitting={isSubmitting}
        >
          {currentQuestions.length > 0 && (
            <span>
              Question{" "}
              {Math.min(
                ...currentQuestions.map(
                  (question) =>
                    visibleQuestions.findIndex((visible) => visible.id === question.id) + 1,
                ),
              )}
              –{" "}
              {Math.max(
                ...currentQuestions.map(
                  (question) =>
                    visibleQuestions.findIndex((visible) => visible.id === question.id) + 1,
                ),
              )}{" "}
              of {visibleQuestions.length}
            </span>
          )}
        </SurveyPager>
      )}

      {/* Submit button for single-page surveys (no pagination) */}
      {pageCount <= 1 && (
        <button
          type="submit"
          disabled={isSubmitting}
          className="sb-button-accent w-full justify-center py-4 text-base"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="animate-spin h-5 w-5" />
              Submitting...
            </span>
          ) : (
            `Submit Response${hasResponded ? " (Update)" : ""}`
          )}
        </button>
      )}
    </form>
  );
}
