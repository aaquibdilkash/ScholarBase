"use client";

import { createJournal, updateJournal } from "@/app/actions/journals";
import { SubmitBtn } from "@/components/ui/SubmitBtn";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";

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

  const [draftFields, updateDraftField, resetDraft] = useFormDraft(
    `draft_journal_${mode}`,
    initial,
  );

  const { submitting, submit } = useFormSubmit(
    mode !== "edit" ? resetDraft : undefined,
    {
      resetOnSuccess: mode !== "edit",
      successMessage: "Journal added successfully!",
      errorMessage: "Failed to add journal.",
    },
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (mode === "edit" && journalId) {
      await updateJournal(formData, journalId);
    } else {
      await submit(() => createJournal(formData));
    }
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
          <label className="sb-label">Scopus</label>
          <input
            name="scopus"
            placeholder="e.g., Q1"
            className="sb-input"
            value={draftFields.scopus}
            onChange={(e) => updateDraftField("scopus", e.target.value)}
          />
        </div>
        <div>
          <label className="sb-label">ABDC Category</label>
          <input
            name="abdcCategory"
            placeholder="e.g., A*"
            className="sb-input"
            value={draftFields.abdcCategory}
            onChange={(e) => updateDraftField("abdcCategory", e.target.value)}
          />
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
        <textarea
          name="about"
          placeholder="Briefly describe the journal and its focus..."
          className="sb-input h-32"
          value={draftFields.about}
          onChange={(e) => updateDraftField("about", e.target.value)}
        />
      </div>

      <SubmitBtn className="sb-button-accent mt-2 self-end">
        {mode === "edit" ? "Save Changes" : "Add Journal"}
      </SubmitBtn>
    </form>
  );
}
