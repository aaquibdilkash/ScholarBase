"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { createSurvey, updateSurvey } from "@/app/actions/surveys";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { useFormDraft } from "@/hooks/useFormDraft";
import { QuestionEditor, generateId } from "./QuestionEditor";
import { SurveyPreview } from "./SurveyPreview";
import { DEMOGRAPHIC_BLOCKS } from "@/lib/surveys/demographics";
import {
  getQuestionPosition,
  moveQuestion as moveQuestionInStructure,
  moveQuestionToSection as relocateQuestion,
  moveSection as moveSectionInStructure,
  normalizeSurveyStructure,
  placeQuestion as placeQuestionInStructure,
} from "@/lib/surveys/structure";
import { useQuestionDrag } from "./useQuestionDrag";
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
  TEMPLATE_CONSENT_TEXT,
  NEW_QUESTION_ID_PREFIX,
} from "@/lib/constants";
import { getRichTextLength } from "@/lib/html";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { Trash2 } from "lucide-react";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
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
  const generalQuestions = questions.filter((q) => (q.blockId ?? null) === null);

  const [activeTab, setActiveTab] = useState<"build" | "preview">("build");
  const [selectedDemographic, setSelectedDemographic] = useState<string>("");
  const [showBlockDeleteModal, setShowBlockDeleteModal] = useState<{
    isOpen: boolean;
    blockIndex: number | null;
  }>({ isOpen: false, blockIndex: null });
  const [isDeleting, setIsDeleting] = useState(false);

  const { toast } = useToast();

  const withSkipIntegrity = (nextQuestions: Question[]) => {
    const byOrder = new Map(nextQuestions.map((q) => [q.order, q]));
    let touched = false;
    const updated = nextQuestions.map((q) => {
      if (!q.skipLogic) return q;
      const skip = q.skipLogic as {
        questionId: string;
        operator: string;
        value: unknown;
        skipToOrder: number;
      }[];
      const newSkip = skip
        .map((s) => {
          const target = byOrder.get(s.skipToOrder);
          if (!target) {
            touched = true;
            return null;
          }
          return { ...s, skipToOrder: target.order };
        })
        .filter(Boolean) as typeof skip;
      if (newSkip.length !== skip.length) touched = true;
      return { ...q, skipLogic: newSkip.length ? newSkip : null };
    });
    if (touched)
            toast({
        title: "Skip rules updated",
        description: "Branching targets were re-mapped.",
      });
    return updated;
  };

  /**
   * Persist a structural change. Every structural mutation returns normalized
   * questions (dense order, contiguous sections) plus normalized blocks, so the
   * builder, the preview and the published form always agree on the layout.
   */
  const applyStructure = (result: {
    questions: Question[];
    blocks: BlockInput[];
  }) => {
    updateDraft("blocks", result.blocks);
    updateDraft("questions", withSkipIntegrity(result.questions));
  };

  const moveQuestion = (questionId: string, dir: "up" | "down") => {
    const result = moveQuestionInStructure(questions, blocks, questionId, dir);
    if (!result.moved) return;
    applyStructure(result);
    toast("Question moved");
  };

  const moveBlock = (blockId: string, dir: "up" | "down") => {
    const result = moveSectionInStructure(questions, blocks, blockId, dir);
    if (!result.moved) return;
    applyStructure(result);
    toast("Section moved");
  };

  const changeQuestionSection = (
    questionId: string,
    targetBlockId: string | null,
  ) => {
    const result = relocateQuestion(questions, blocks, questionId, targetBlockId);
    if (!result.moved) return;
    applyStructure(result);
    toast(targetBlockId ? "Question moved to section" : "Question moved to General");
  };

  const dropQuestion = (
    questionId: string,
    target: { blockId: string | null; index: number },
  ) => {
    const result = placeQuestionInStructure(
      questions,
      blocks,
      questionId,
      target.blockId,
      target.index,
    );
    if (!result.moved) return;
    applyStructure(result);
    toast("Question moved");
  };

  const { beginDrag, draggingId, target: dropTarget, pointer } =
    useQuestionDrag(dropQuestion);

  const addQuestion = (blockId: string | null = null) => {
    const newQuestion: Question = {
      // Builder-local key: the server creates the row and persists this as
      // `clientKey`, so a retried save updates instead of duplicating.
      id: `${NEW_QUESTION_ID_PREFIX}${generateId()}`,
      type: "SHORT_TEXT",
      title: `Question ${questions.length + 1}`,
      required: false,
      order: questions.length,
      blockId,
      options: [],
      typeData: {},
    };
    applyStructure(
      normalizeSurveyStructure([...questions, newQuestion], blocks),
    );
    toast("Question added");
  };

  const addBlock = () => {
    if (blocks.length >= MAX_SURVEY_BLOCKS) return;
    updateDraft("blocks", [
      ...blocks,
      {
        id: `${NEW_QUESTION_ID_PREFIX}${generateId()}`,
        title: `Section ${blocks.length + 1}`,
        order: blocks.length,
        randomizeOrder: false,
      },
    ]);
    toast("Section added");
  };

  const updateBlock = (index: number, block: BlockInput) => {
    updateDraft(
      "blocks",
      blocks.map((b, i) => (i === index ? block : b)),
    );
  };

  const removeBlock = (index: number) => {
    const remainingBlocks = blocks
      .filter((_, i) => i !== index)
      .map((b, i) => ({ ...b, order: i }));
    // normalizeSurveyStructure clears any block reference to the removed
    // section, so those questions fall back to General.
    applyStructure(normalizeSurveyStructure(questions, remainingBlocks));
    toast("Section removed (questions kept)");
  };

  const insertDemographicBlock = (
    blockKey: string,
    blockId: string | null = null,
  ) => {
    const template = DEMOGRAPHIC_BLOCKS.find((b) => b.key === blockKey);
    if (!template) return;
    const newQuestions: Question[] = template.questions.map((q) => ({
      ...q,
      id: `${NEW_QUESTION_ID_PREFIX}${generateId()}`,
      order: 0,
      blockId,
      options: q.options.map((o) => ({ ...o })),
    }));
    applyStructure(
      normalizeSurveyStructure([...questions, ...newQuestions], blocks),
    );
    toast(
      `${template.questions.length === 1 ? template.questions[0].title : `${template.questions.length} standard demographics`} added`,
    );
  };

  const updateQuestion = (questionId: string, question: Question) => {
    updateDraft(
      "questions",
      questions.map((q) => (q.id === questionId ? question : q)),
    );
  };

  const removeQuestion = (questionId: string) => {
    applyStructure(
      normalizeSurveyStructure(
        questions.filter((q) => q.id !== questionId),
        blocks,
      ),
    );
    toast("Question removed");
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
      // Edit mode: updateSurvey returns { success, data } or { success: false,
      // error }. Only reset the draft on success — resetting after a failed
      // submit would silently revert the user's edits and cause the next
      // submit to overwrite the survey with its original content.
      const succeeded = await submit(() => updateSurvey(formData, editingId));
      if (succeeded) resetDraft();
    } else {
      await submit(() => createSurvey(formData));
    }
  }

  /**
   * One question row. `data-drop-index` marks it as a drag/drop insertion point;
   * the index is relative to its own section, matching `placeQuestion`.
   */
  const renderQuestionCard = (
    question: Question,
    indexInSection: number,
  ) => {
    const position = getQuestionPosition(questions, question.id);
    const globalIndex = questions.findIndex((q) => q.id === question.id);
    const isDropHere =
      draggingId !== null &&
      dropTarget !== null &&
      dropTarget.blockId === (question.blockId ?? null) &&
      dropTarget.index === indexInSection;

    return (
      <Fragment key={question.id}>
        <div
          aria-hidden
          className={`mx-1 h-1 rounded-full transition-colors ${
            isDropHere ? "bg-blue-500" : "bg-transparent"
          }`}
        />
        <div data-drop-index={indexInSection}>
          <QuestionEditor
            question={question}
            index={globalIndex}
            allQuestions={questions}
            blocks={blocks}
            isFirstInSection={position?.isFirstInSection ?? true}
            isLastInSection={position?.isLastInSection ?? true}
            isDragging={draggingId === question.id}
            onChange={(updated) => updateQuestion(question.id, updated)}
            onDelete={() => removeQuestion(question.id)}
            onMoveUp={() => moveQuestion(question.id, "up")}
            onMoveDown={() => moveQuestion(question.id, "down")}
            onMoveToSection={(blockId) =>
              changeQuestionSection(question.id, blockId)
            }
            onDragHandlePointerDown={(event) => beginDrag(event, question.id)}
          />
        </div>
      </Fragment>
    );
  };

  /**
   * A section: header, its questions, and an add button. The container carries
   * `data-drop-bucket` so a drag can resolve which section it is hovering.
   */
  const renderSectionCard = (block: BlockInput | null) => {
    const blockId = block?.id ?? null;
    const sectionQuestions = questions.filter(
      (q) => (q.blockId ?? null) === blockId,
    );
    const isDropBucket =
      draggingId !== null &&
      dropTarget !== null &&
      dropTarget.blockId === blockId;

    return (
      <section
        key={blockId ?? "general"}
        data-drop-bucket={blockId ?? "general"}
        className={`rounded-xl border p-3 shadow-sm transition-colors sm:p-5 ${
          isDropBucket
            ? "border-blue-400 bg-blue-50/40 dark:border-blue-500 dark:bg-blue-950/20"
            : "border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-900/30"
        }`}
      >
        <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-2 dark:border-slate-700">
          <h3 className="break-words text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
            {block ? block.title : "General questions"}
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {sectionQuestions.length === 1
              ? "1 question"
              : `${sectionQuestions.length} questions`}
          </span>
        </header>

        {sectionQuestions.length === 0 ? (
          <p className="py-3 text-center text-xs text-slate-400">
            No questions in this section yet.
          </p>
        ) : (
          <div>{sectionQuestions.map((q, i) => renderQuestionCard(q, i))}</div>
        )}

        <div className="mt-3 flex justify-center border-t border-slate-200 pt-3 dark:border-slate-700">
          <button
            type="button"
            onClick={() => addQuestion(blockId)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400"
          >
            + Add question here
          </button>
        </div>
      </section>
    );
  };

  return (
    <>
    <div className="space-y-6">
      {/* Build / Preview tabs */}
      <div
        role="tablist"
        aria-label="Survey editor"
        className="flex w-full flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white/80 p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/80"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "build"}
          onClick={() => setActiveTab("build")}
          className={`flex-1 rounded-xl px-6 py-2 font-semibold text-center transition-all ${
            activeTab === "build"
              ? "bg-slate-950 text-white shadow-sm dark:bg-slate-100 dark:text-slate-950"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          }`}
        >
          ✏️ Build
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "preview"}
          onClick={() => setActiveTab("preview")}
          className={`flex-1 rounded-xl px-6 py-2 font-semibold text-center transition-all ${
            activeTab === "preview"
              ? "bg-slate-950 text-white shadow-sm dark:bg-slate-100 dark:text-slate-950"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          }`}
        >
          👁️ Preview
        </button>
      </div>

      {activeTab === "build" ? (
        <form onSubmit={handleFormSubmit} className="space-y-6">
      <CautionNote />
      {/* Survey Details Section */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-6">
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
              onChange={(e) => {
                const checked = e.target.checked;
                updateDraft("consentRequired", checked);
                if (checked && !consentText) {
                  updateDraft("consentText", TEMPLATE_CONSENT_TEXT);
                }
              }}
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
            <>
              <textarea
                value={consentText ?? ""}
                onChange={(e) => updateDraft("consentText", e.target.value)}
                rows={4}
                maxLength={MAX_SURVEY_CONSENT_TEXT}
                placeholder="Describe the study purpose, data usage, risks, and participant rights…"
                className="sb-textarea mt-3 resize-y"
              />
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {(consentText ?? "").length}/{MAX_SURVEY_CONSENT_TEXT} characters
              </div>
            </>
          )}
        </div>

        {/* Sections Section */}
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-6">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Sections</h2>
            {blocks.length < MAX_SURVEY_BLOCKS && (
              <button
                type="button"
                onClick={addBlock}
                className="sb-button-accent w-full text-sm sm:w-auto"
              >
                + Add Section
              </button>
            )}
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
                  className="grid gap-3 border-t border-slate-200 bg-transparent p-0 pt-3 first:border-t-0 first:pt-0 dark:border-slate-700 sm:flex sm:flex-wrap sm:items-center sm:gap-2 sm:rounded-lg sm:border sm:bg-slate-50 sm:p-2 sm:dark:bg-slate-800"
                >
                  <input
                    type="text"
                    value={block.title}
                    onChange={(e) =>
                      updateBlock(i, { ...block, title: e.target.value })
                    }
                    className="min-w-0 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm sm:flex-1 sm:py-1.5 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
                    maxLength={MAX_SURVEY_QUESTION_TITLE}
                    required
                  />
                  <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-start">
                    <label className="flex min-h-9 min-w-0 cursor-pointer items-center gap-2 text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300">
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
                    <div className="ml-auto flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => block.id && moveBlock(block.id, "up")}
                    disabled={i === 0}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Move section up"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => block.id && moveBlock(block.id, "down")}
                    disabled={i === blocks.length - 1}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Move section down"
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBlockDeleteModal({ isOpen: true, blockIndex: i })}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                    title="Delete section"
                    aria-label="Delete section"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Questions Section */}
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-6">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Questions</h2>
            <button
              type="button"
              onClick={() => addQuestion()}
              className="sb-button-accent w-full text-sm sm:w-auto"
            >
              + Add Question
            </button>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <select
              value={selectedDemographic}
              onChange={(e) => setSelectedDemographic(e.target.value)}
              className="sb-select min-w-0 w-full text-sm sm:max-w-56 !pr-10"
              aria-label="Insert a standard demographic block"
            >
              <option value="">+ Insert Demographics…</option>
              {DEMOGRAPHIC_BLOCKS.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label} ({b.description})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                if (selectedDemographic) {
                  insertDemographicBlock(selectedDemographic);
                  setSelectedDemographic("");
                }
              }}
              disabled={!selectedDemographic}
              className="sb-button-accent w-full text-sm disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              Insert
            </button>
          </div>
          {/* Questions, grouped into visible sections so boundaries are
              explicit. Each card is a drop bucket for cross-section drags. */}
          <div className="space-y-4">
            {generalQuestions.length > 0 || blocks.length === 0
              ? renderSectionCard(null)
              : null}
            {blocks.map((block) => renderSectionCard(block))}
          </div>
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
      ) : (
        <SurveyPreview
          title={title}
          description={description}
          questions={questions}
          consentRequired={consentRequired === true}
          consentText={consentText}
        />
      )}
    </div>

    <ConfirmationModal
      isOpen={showBlockDeleteModal.isOpen}
      onClose={() => setShowBlockDeleteModal({ isOpen: false, blockIndex: null })}
      onConfirm={() => {
        if (showBlockDeleteModal.blockIndex !== null) {
          setIsDeleting(true);
          setShowBlockDeleteModal({ isOpen: false, blockIndex: null });
          removeBlock(showBlockDeleteModal.blockIndex);
          setIsDeleting(false);
        }
      }}
      title="Delete Section"
      message="Are you sure you want to delete this section? This action cannot be undone."
      isConfirming={isDeleting}
    />

    {/* Drag ghost. `pointer-events-none` is essential: it keeps the ghost out
        of elementFromPoint() hit-testing so the drop markers underneath win. */}
    {pointer && (
      <div
        className="pointer-events-none fixed z-50 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
        style={{ left: pointer.x + 12, top: pointer.y + 12 }}
      >
        Moving question…
      </div>
    )}
    </>
  );
}
