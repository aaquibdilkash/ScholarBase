"use client";

import { useRouter } from "next/navigation";
import { createJournal, updateJournal } from "@/app/actions/journals";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { Editor } from "@/components/ui/Editor";
import { FormCancelButton } from "@/components/ui/FormCancelButton";
import { useQueryClient } from "@tanstack/react-query";
import { upsertToList } from "@/utils/cacheMutation";
import { CautionNote } from "@/components/ui/CautionNote";
import {
  MAX_JOURNAL_TITLE,
  MAX_JOURNAL_DESCRIPTION,
  MAX_JOURNAL_PUBLISHER,
  MAX_JOURNAL_WEBSITE,
  MAX_JOURNAL_IMPACT_FACTOR,
  MAX_JOURNAL_CITESCORE,
  MAX_JOURNAL_SJR_SCORE,
} from "@/lib/constants";
import { QUARTILE_OPTIONS, WOS_INDEX_OPTIONS, ABDC_OPTIONS } from "@/constants/journal-metrics";
import type { JournalWithAuthor } from "@/types/cards";

export type JournalFormValues = {
  title: string;
  issn: string;
  impactFactor: string;
  scopusQuartile: string;
  abdcRanking: string;
  wosIndex: string;
  wosQuartile: string;
  sjrQuartile: string;
  sjrScore: string;
  citeScore: string;
  publisher: string;
  website: string;
  about: string;
};

export default function JournalForm({
  mode,
  journalId,
  initialValues,
}: {
  mode: "create" | "edit";
  journalId?: string;
  initialValues?: Partial<JournalFormValues>;
}) {
  const router = useRouter();
  const initial = {
    title: initialValues?.title ?? "",
    issn: initialValues?.issn ?? "",
    impactFactor: initialValues?.impactFactor ?? "",
    scopusQuartile: initialValues?.scopusQuartile ?? "",
    abdcRanking: initialValues?.abdcRanking ?? "",
    wosIndex: initialValues?.wosIndex ?? "",
    wosQuartile: initialValues?.wosQuartile ?? "",
    sjrQuartile: initialValues?.sjrQuartile ?? "",
    sjrScore: initialValues?.sjrScore ?? "",
    citeScore: initialValues?.citeScore ?? "",
    publisher: initialValues?.publisher ?? "",
    website: initialValues?.website ?? "",
    about: initialValues?.about ?? "",
  };

  const draftKey = mode === "edit" ? null : "draft_journal_create";
  const [draftFields, updateDraftField, resetDraft] = useFormDraft(
    draftKey,
    initial,
  );
  const queryClient = useQueryClient();

  const { submit } = useFormSubmit(mode !== "edit" ? resetDraft : undefined, {
    resetOnSuccess: mode !== "edit",
    successMessage:
      mode === "create"
        ? "Journal added successfully!"
        : "Journal updated successfully!",
    errorMessage:
      mode === "create"
        ? "Failed to add journal."
        : "Failed to update journal.",
    onSuccess: (response) => {
      if (response.success && response.data) {
        const data = response.data as JournalWithAuthor;
        upsertToList<JournalWithAuthor>(
          queryClient,
          ["journals"],
          data,
          mode,
        );
        router.push(`/journals/${data.id}`);
      }
    },
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    await submit(() => {
      if (mode === "edit" && journalId) {
        return updateJournal(formData, journalId);
      } else {
        return createJournal(formData);
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="sb-surface-strong flex flex-col gap-5 p-8 md:p-10"
    >
      <CautionNote />
      <div>
        <label className="sb-label">Journal Name</label>
        <input
            name="title"
            placeholder="e.g., Journal of Financial Economics"
            className="sb-input"
            required
            maxLength={MAX_JOURNAL_TITLE}
            value={draftFields.title}
            onChange={(e) => updateDraftField("title", e.target.value)}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.title.length}/{MAX_JOURNAL_TITLE} characters
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="sb-label">WoS Index</label>
            <select
              name="wosIndex"
              value={draftFields.wosIndex}
              onChange={(e) => updateDraftField("wosIndex", e.target.value)}
              className="sb-select"
            >
              {WOS_INDEX_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="sb-label">WoS Quartile</label>
            <select
              name="wosQuartile"
              value={draftFields.wosQuartile}
              onChange={(e) => updateDraftField("wosQuartile", e.target.value)}
              className="sb-select"
            >
              {QUARTILE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="sb-label">Scopus Quartile</label>
            <select
              name="scopusQuartile"
              value={draftFields.scopusQuartile}
              onChange={(e) => updateDraftField("scopusQuartile", e.target.value)}
              className="sb-select"
            >
              {QUARTILE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="sb-label">ABDC Ranking</label>
            <select
              name="abdcRanking"
              value={draftFields.abdcRanking}
              onChange={(e) => updateDraftField("abdcRanking", e.target.value)}
              className="sb-select"
            >
              {ABDC_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="sb-label">SJR Quartile</label>
            <select
              name="sjrQuartile"
              value={draftFields.sjrQuartile}
              onChange={(e) => updateDraftField("sjrQuartile", e.target.value)}
              className="sb-select"
            >
              {QUARTILE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="sb-label">SJR Score</label>
            <input
              name="sjrScore"
              placeholder="e.g., 2.5"
              className="sb-input"
              maxLength={MAX_JOURNAL_SJR_SCORE}
              value={draftFields.sjrScore}
              onChange={(e) => updateDraftField("sjrScore", e.target.value)}
            />
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {draftFields.sjrScore.length}/{MAX_JOURNAL_SJR_SCORE} characters
            </div>
          </div>
          <div>
            <label className="sb-label">CiteScore</label>
            <input
              name="citeScore"
              placeholder="e.g., 8.3"
              className="sb-input"
              maxLength={MAX_JOURNAL_CITESCORE}
              value={draftFields.citeScore}
              onChange={(e) => updateDraftField("citeScore", e.target.value)}
            />
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {draftFields.citeScore.length}/{MAX_JOURNAL_CITESCORE} characters
            </div>
          </div>

      <div>
          <label className="sb-label">Impact Factor</label>
          <input
            name="impactFactor"
            placeholder="e.g., 5.467"
            className="sb-input"
            maxLength={MAX_JOURNAL_IMPACT_FACTOR}
            value={draftFields.impactFactor}
            onChange={(e) => updateDraftField("impactFactor", e.target.value)}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.impactFactor.length}/{MAX_JOURNAL_IMPACT_FACTOR} characters
          </div>
        </div>
      </div>

      <div>
        <label className="sb-label">Publisher</label>
        <input
          name="publisher"
          placeholder="e.g., Elsevier"
          className="sb-input"
          value={draftFields.publisher}
          onChange={(e) => updateDraftField("publisher", e.target.value)}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.publisher.length}/{MAX_JOURNAL_PUBLISHER} characters
        </div>
      </div>

      <div>
        <label className="sb-label">Website</label>
        <input
          name="website"
          placeholder="https://www.sciencedirect.com/journal/..."
          className="sb-input"
          value={draftFields.website}
          onChange={(e) => updateDraftField("website", e.target.value)}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.website.length}/{MAX_JOURNAL_WEBSITE} characters
        </div>
      </div>

      <div>
        <label className="sb-label">About</label>
        <Editor
          value={draftFields.about}
          onChange={(data) => updateDraftField("about", data)}
          maxLength={MAX_JOURNAL_DESCRIPTION}
        />
        <input type="hidden" name="about" value={draftFields.about} />
      </div>

      <div className="mt-2 flex justify-end gap-3">
        <FormCancelButton />
        <SubmitBtnWithAuth className="sb-button-accent">
          {mode === "edit" ? "Save Changes" : "Add Journal"}
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}
