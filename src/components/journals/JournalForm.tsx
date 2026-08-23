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
  MAX_JOURNAL_ISSN,
  MAX_JOURNAL_DESCRIPTION,
  MAX_JOURNAL_PUBLISHER,
  MAX_JOURNAL_WEBSITE,
} from "@/lib/constants";
import type { JournalWithAuthor } from "@/types/cards";

export type JournalFormValues = {
  title: string;
  issn: string;
  impactFactor: string;
  scopus: string;
  abdcCategory: string;
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
    scopus: initialValues?.scopus ?? "",
    abdcCategory: initialValues?.abdcCategory ?? "",
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
            <label className="sb-label">ISSN</label>
            <input
              name="issn"
              placeholder="e.g., 0304-405X"
              className="sb-input"
              maxLength={MAX_JOURNAL_ISSN}
              value={draftFields.issn}
              onChange={(e) => updateDraftField("issn", e.target.value)}
            />
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {draftFields.issn.length}/{MAX_JOURNAL_ISSN} characters
            </div>
          </div>
        <div>
          <label className="sb-label">Impact Factor</label>
          <input
            name="impactFactor"
            placeholder="e.g., 5.467"
            className="sb-input"
            value={draftFields.impactFactor}
            onChange={(e) => updateDraftField("impactFactor", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="sb-label">Scopus Ranking</label>
          <select
            name="scopus"
            value={draftFields.scopus}
            onChange={(e) => updateDraftField("scopus", e.target.value)}
            className="sb-select"
          >
            <option value="">Select ranking</option>
            <option value="Q1">Q1</option>
            <option value="Q2">Q2</option>
            <option value="Q3">Q3</option>
            <option value="Q4">Q4</option>
          </select>
        </div>
        <div>
          <label className="sb-label">ABDC Category</label>
          <select
            name="abdcCategory"
            value={draftFields.abdcCategory}
            onChange={(e) => updateDraftField("abdcCategory", e.target.value)}
            className="sb-select"
          >
            <option value="">Select category</option>
            <option value="A*">A*</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
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
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {String(draftFields.about.length).replace(/(\d+)(?=.(\d{3})*$)/g, "$1,")}/{MAX_JOURNAL_DESCRIPTION} characters
        </div>
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
