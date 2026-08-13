"use client";

import { createJournal, updateJournal } from "@/app/actions/journals";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { Editor } from "@/components/ui/Editor";
import { FormCancelButton } from "@/components/ui/FormCancelButton";

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

  const { submit } = useFormSubmit(mode !== "edit" ? resetDraft : undefined, {
    resetOnSuccess: mode !== "edit",
    successMessage: "Journal added successfully!",
    errorMessage: "Failed to add journal.",
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
      <div>
        <label className="sb-label">Journal Name</label>
        <input
          name="title"
          placeholder="e.g., Journal of Financial Economics"
          className="sb-input"
          required
          value={draftFields.title}
          onChange={(e) => updateDraftField("title", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="sb-label">ISSN</label>
          <input
            name="issn"
            placeholder="e.g., 0304-405X"
            className="sb-input"
            value={draftFields.issn}
            onChange={(e) => updateDraftField("issn", e.target.value)}
          />
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
      </div>

      <div>
        <label className="sb-label">About</label>
        <Editor
          value={draftFields.about}
          onChange={(data) => updateDraftField("about", data)}
        />
        <input type="hidden" name="about" value={draftFields.about} />
      </div>

      <div className="mt-2 flex justify-end gap-3">
        {mode === "create" && <FormCancelButton href="/journals" />}
        <SubmitBtnWithAuth className="sb-button-accent">
          {mode === "edit" ? "Save Changes" : "Add Journal"}
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}
