"use client";

import { useRouter } from "next/navigation";
import { createSurvey, updateSurvey } from "@/app/actions/surveys";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { useFormDraft } from "@/hooks/useFormDraft";
import { QuestionEditor, generateId } from "./QuestionEditor";
import { DEMOGRAPHIC_BLOCKS } from "@/lib/surveys/demographics";
import { Editor } from "@/components/ui/Editor";
import { useQueryClient } from "@tanstack/react-query";
import { upsertToList } from "@/utils/cacheMutation";
import { CautionNote } from "@/components/ui/CautionNote";
import { FormCancelButton } from "@/components/ui/FormCancelButton";
import type { Question, QuestionOption, BlockInput } from "@/types/survey";
import type { SurveyWithAuthor } from "@/types/cards";

import {
  MAX_SURVEY_TITLE,
  MAX_SURVEY_DESCRIPTION,
  MAX_SURVEY_QUESTION_TITLE,
  MAX_SURVEY_CONSENT_TEXT,
  MAX_SURVEY_BLOCKS,
} from "@/lib/constants";
import { getRichTextLength } from "@/lib/html";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  SURVEY_TITLE_TIP,
  SURVEY_DESCRIPTION_TIP,
  SURVEY_PRIVACY_TIP,
  SURVEY_SHARE_DATA_TIP,
} from "@/constants/tooltips";

export type SurveyFormValues = {
  id?: string;
  title: string;
  description: string | null | undefined;
  privacy: string;
  shareData: boolean;
  consentRequired?: boolean;
  consentText?: string | null;
  blocks?: BlockInput[];
  questions: Question[];
};

export default function SurveyForm({
  mode,
  initialData,
}: {
  mode: "create" | "edit";
  initialData?: Partial<SurveyFormValues>;
}) {
  const router = useRouter();
  const initialQuestions =
    initialData?.questions?.map((q: Question, i: number) => ({
      id: q.id || generateId(),
      type: q.type,
      title: q.title,
      required: q.required,
      order: q.order ?? i,
      minValue: q.minValue,
      maxValue: q.maxValue,
      shuffleOptions: q.shuffleOptions === true,
      skipLogic: q.skipLogic ?? null,
      columnLabels: q.columnLabels ?? null,
      blockId: q.blockId ?? null,
      options:
        q.options?.map((o: QuestionOption, oi: number) => ({
          id: o.id,
          value: o.value || `opt_${oi}`,
          label: o.label,
          order: o.order ?? oi,
        })) || [],
    })) || [];
  const initialBlocks: BlockInput[] = (initialData?.blocks ?? []).map(
    (b, i) => ({
      id: b.id || generateId(),
      title: b.title,
      order: b.order ?? i,
      randomizeOrder: b.randomizeOrder === true,
    }),
  );

  const draftKey = mode === "edit" ? null : "draft_survey_new";
  const [draft, updateDraft, resetDraft] = useFormDraft(draftKey, {
    title: initialData?.title || "",
    description: initialData?.description || "",
    privacy: initialData?.privacy || "NON_ANONYMOUS",
    shareData: initialData?.shareData || false,
    consentRequired: initialData?.consentRequired || false,
    consentText: initialData?.consentText || "",
    blocks: initialBlocks,
    questions: initialQuestions,
  });
  const queryClient = useQueryClient();

  const { submit, submitting } = useFormSubmit(resetDraft, {
    resetOnSuccess: mode !== "edit",
    successMessage:
      mode === "create"
        ? "Survey created successfully!"
        : "Survey updated successfully!",
    errorMessage: "Failed to save survey.",
    onSuccess: (response) => {
      if (response.success && response.data) {
        const survey = response.data as SurveyWithAuthor;
        upsertToList<SurveyWithAuthor>(
          queryClient,
          ["surveys"],
          survey,
          mode,
        );
        router.push(`/surveys/${survey.id}`);
      }
    },
  });

  const { title, description, privacy, shareData, consentRequired, consentText, blocks, questions } = draft;

  const addQuestion = () => {
    const newQuestion: Question = {
      id: generateId(),
      type: "SHORT_TEXT",
      title: "",
      required: false,
      order: questions.length,
      options: [],
    };
    updateDraft("questions", [...questions, newQuestion]);
  };

  const addBlock = () => {
    if (blocks.length >= MAX_SURVEY_BLOCKS) return;
    updateDraft("blocks", [
      ...blocks,
      {
        id: generateId(),
        title: `Section ${blocks.length + 1}`,
        order: blocks.length,
        randomizeOrder: false,
      },
    ]);
  };

  const updateBlock = (index: number, block: BlockInput) => {
    updateDraft(
      "blocks",
      blocks.map((b, i) => (i === index ? block : b)),
    );
  };

  const removeBlock = (index: number) => {
    const removed = blocks[index];
    updateDraft(
      "blocks",
      blocks
        .filter((_, i) => i !== index)
        .map((b, i) => ({ ...b, order: i })),
    );
    // Detach, do not delete, the questions that belonged to the block.
    updateDraft(
      "questions",
      questions.map((q) =>
        q.blockId === removed.id ? { ...q, blockId: null } : q,
      ),
    );
  };

  const insertDemographicBlock = (blockKey: string) => {
    const template = DEMOGRAPHIC_BLOCKS.find((b) => b.key === blockKey);
    if (!template) return;
    const newQuestions: Question[] = template.questions.map((q, i) => ({
      ...q,
      id: generateId(),
      order: questions.length + i,
      options: q.options.map((o) => ({ ...o })),
    }));
    updateDraft("questions", [...questions, ...newQuestions]);
  };

  const updateQuestion = (index: number, question: Question) => {
    const newQuestions = questions.map((q: Question, i: number) =>
      i === index ? question : q,
    );
    updateDraft("questions", newQuestions);
  };

  const removeQuestion = (index: number) => {
    const newQuestions = questions.filter((_, i: number) => i !== index);
    updateDraft("questions", newQuestions);
  };

  const isDescriptionOverLimit =
    getRichTextLength(description ?? "") > MAX_SURVEY_DESCRIPTION;
  const isFormOverLimit = isDescriptionOverLimit;

  async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isFormOverLimit) return;

    const formData = new FormData();
    formData.set("title", title);
    formData.set("description", description ?? "");
    formData.set("privacy", privacy);
    formData.set("shareData", String(shareData));
    formData.set("consentRequired", String(consentRequired === true));
    formData.set("consentText", consentText ?? "");
    formData.set("blocks", JSON.stringify(blocks));
    formData.set("questions", JSON.stringify(questions));

    const editingId = mode === "edit" ? initialData?.id : undefined;
    if (editingId) {
      // Edit mode: updateSurvey returns { success, redirect } so submit() handles
      // the client-side redirect (avoids the NEXT_REDIRECT server error).
      await submit(() => updateSurvey(formData, editingId));
      resetDraft();
    } else {
      await submit(() => createSurvey(formData));
    }
  }

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      <CautionNote />
      {/* Survey Details Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Survey Details</h2>

         <div>
           <label className="mb-1 block text-sm font-semibold text-slate-700 inline-flex items-center gap-1.5">
             Survey Title
             <InfoTooltip message={SURVEY_TITLE_TIP} />
           </label>
          <input
            type="text"
            name="title"
            value={title}
            onChange={(e) => updateDraft("title", e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter survey title"
            required
            maxLength={MAX_SURVEY_TITLE}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {title.length}/{MAX_SURVEY_TITLE} characters
          </div>
        </div>

         <div>
           <label className="mb-1 block text-sm font-semibold text-slate-700 inline-flex items-center gap-1.5">
             Description
             <InfoTooltip message={SURVEY_DESCRIPTION_TIP} />
           </label>
          <Editor
            maxLength={MAX_SURVEY_DESCRIPTION}
            value={description ?? ""}
            onChange={(data) => updateDraft("description", data)}
          />
          <input type="hidden" name="description" value={description ?? ""} />
        </div>

         <div>
           <label className="mb-1 block text-sm font-semibold text-slate-700 inline-flex items-center gap-1.5">
             Response Privacy Mode
             <InfoTooltip message={SURVEY_PRIVACY_TIP} />
           </label>
          <p className="mb-2 text-xs text-slate-500">
            Control how responses are collected.
          </p>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 md:grid md:grid-cols-3 md:overflow-visible md:pb-0">
            {[
              {
                value: "ANONYMOUS",
                label: "Anonymous",
                desc: "No identity recorded",
              },
              {
                value: "NON_ANONYMOUS",
                label: "Non-Anonymous",
                desc: "Identity recorded",
              },
              {
                value: "HYBRID",
                label: "Hybrid",
                desc: "Respondent chooses",
              },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateDraft("privacy", opt.value)}
                className={`min-w-[12rem] rounded-xl border-2 p-4 text-left transition md:min-w-0 ${
                  privacy === opt.value
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10 dark:border-blue-500/50"
                    : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                }`}
              >
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {opt.label}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {opt.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <input
            type="checkbox"
            id="shareData"
            name="shareData"
            checked={shareData}
            onChange={(e) => updateDraft("shareData", e.target.checked)}
            className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <label
              htmlFor="shareData"
              className="cursor-pointer text-sm font-semibold text-slate-700 inline-flex items-center gap-1.5"
            >
              Share anonymized response data publicly
              <InfoTooltip message={SURVEY_SHARE_DATA_TIP} />
            </label>
            <p className="mt-0.5 text-xs text-slate-500">
              Allow other researchers to view aggregated response data on the
              results page.
            </p>
          </div>
        </div>

        {/* IRB Consent Gate */}
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={consentRequired === true}
              onChange={(e) => updateDraft("consentRequired", e.target.checked)}
              className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <span className="text-sm font-semibold text-slate-700 inline-flex items-center gap-1.5">
                Require informed consent (IRB)
                <InfoTooltip message="Respondents must accept your consent statement before the first question is shown. The acceptance timestamp is recorded with each response." />
              </span>
              <p className="mt-0.5 text-xs text-slate-500">
                Recommended for research involving human participants.
              </p>
            </div>
          </label>
          {consentRequired === true && (
            <textarea
              value={consentText ?? ""}
              onChange={(e) => updateDraft("consentText", e.target.value)}
              rows={4}
              maxLength={MAX_SURVEY_CONSENT_TEXT}
              placeholder="Describe the study purpose, data usage, risks, and participant rights…"
              className="sb-textarea mt-3 resize-y"
            />
          )}
        </div>

        {/* Questions Section */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Questions</h2>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) insertDemographicBlock(e.target.value);
                }}
                className="sb-select text-sm"
                aria-label="Insert a standard demographic block"
              >
                <option value="">+ Insert Demographics…</option>
                {DEMOGRAPHIC_BLOCKS.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.label} ({b.description})
                  </option>
                ))}
              </select>
              {blocks.length < MAX_SURVEY_BLOCKS && (
                <button
                  type="button"
                  onClick={addBlock}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                >
                  + Add Section
                </button>
              )}
              <button
                type="button"
                onClick={addQuestion}
                className="sb-button-accent text-sm"
              >
                + Add Question
              </button>
            </div>
          </div>

          {blocks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500">
                Sections (optionally randomized per respondent to control order
                effects)
              </p>
              {blocks.map((block, i) => (
                <div
                  key={block.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2"
                >
                  <input
                    type="text"
                    value={block.title}
                    onChange={(e) =>
                      updateBlock(i, { ...block, title: e.target.value })
                    }
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                    maxLength={MAX_SURVEY_QUESTION_TITLE}
                    required
                  />
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-600">
                    <input
                      type="checkbox"
                      checked={block.randomizeOrder}
                      onChange={(e) =>
                        updateBlock(i, {
                          ...block,
                          randomizeOrder: e.target.checked,
                        })
                      }
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Randomize order
                  </label>
                  <button
                    type="button"
                    onClick={() => removeBlock(i)}
                    className="text-xs font-semibold text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          {questions.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">
              No questions yet. Click &ldquo;Add Question&rdquo; to start
              building your survey.
            </p>
          )}
          <div className="space-y-4">
            {questions.map((q: Question, i: number) => (
              <QuestionEditor
                key={q.id}
                question={q}
                index={i}
                allQuestions={questions}
                blocks={blocks}
                onChange={(updated) => updateQuestion(i, updated)}
                onDelete={() => removeQuestion(i)}
              />
            ))}
          </div>
          {questions.length > 0 && (
            <div className="flex justify-center pt-4 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={addQuestion}
                className="sb-button-accent text-sm"
              >
                + Add Question
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <FormCancelButton />
        <SubmitBtnWithAuth
          loadingText={mode === "create" ? "Creating..." : "Saving..."}
          disabled={submitting || isFormOverLimit}
        >
          {mode === "create" ? "Create Survey" : "Save Changes"}
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}
