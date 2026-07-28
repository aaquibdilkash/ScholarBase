"use client";

import {
  createPublication,
  updatePublication,
} from "@/app/actions/publications";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { Editor } from "@/components/ui/Editor";

export type PublicationFormValues = {
  title: string;
  authors: string;
  publicationType: string;
  journalOrConference: string;
  publisher: string;
  year: string;
  volume: string;
  issue: string;
  pages: string;
  doi: string;
  isbn: string;
  url: string;
  keywords: string;
  domain: string;
  abstract: string;
  isUserAuthor: string;
};

const PUBLICATION_TYPES = [
  { value: "RESEARCH_PAPER", label: "Research Paper" },
  { value: "CONFERENCE_PROCEEDING", label: "Conference Proceeding" },
  { value: "PREPRINT", label: "Preprint" },
  { value: "BOOK", label: "Book" },
  { value: "BOOK_CHAPTER", label: "Book Chapter" },
  { value: "THESIS", label: "Thesis" },
  { value: "TECHNICAL_REPORT", label: "Technical Report" },
  { value: "OTHER", label: "Other" },
];

export default function PublicationForm({
  mode,
  publicationId,
  initialValues,
}: {
  mode: "create" | "edit";
  publicationId?: string;
  initialValues?: Partial<PublicationFormValues>;
}) {
  const initial = {
    title: initialValues?.title ?? "",
    authors: initialValues?.authors ?? "",
    publicationType: initialValues?.publicationType ?? "RESEARCH_PAPER",
    journalOrConference: initialValues?.journalOrConference ?? "",
    publisher: initialValues?.publisher ?? "",
    year: initialValues?.year ?? "",
    volume: initialValues?.volume ?? "",
    issue: initialValues?.issue ?? "",
    pages: initialValues?.pages ?? "",
    doi: initialValues?.doi ?? "",
    isbn: initialValues?.isbn ?? "",
    url: initialValues?.url ?? "",
    keywords: initialValues?.keywords ?? "",
    domain: initialValues?.domain ?? "",
    abstract: initialValues?.abstract ?? "",
    isUserAuthor: initialValues?.isUserAuthor ? "true" : "false",
  };

  const [draftFields, updateDraftField, resetDraft] = useFormDraft(
    `draft_publication_${mode}`,
    initial,
  );

  const { submitting, submit } = useFormSubmit(
    mode !== "edit" ? resetDraft : undefined,
    {
      resetOnSuccess: mode !== "edit",
      successMessage: "Publication added successfully!",
      errorMessage: "Failed to add publication.",
    },
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (mode === "edit" && publicationId) {
      await updatePublication(formData, publicationId);
    } else {
      await submit(() => createPublication(formData));
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="sb-surface-strong flex flex-col gap-5 p-8 md:p-10"
    >
      {/* Title */}
      <div>
        <label className="sb-label">Publication Title *</label>
        <input
          name="title"
          placeholder="e.g., A Novel Approach to Natural Language Processing"
          className="sb-input"
          required
          value={draftFields.title}
          onChange={(e) => updateDraftField("title", e.target.value)}
        />
      </div>

      {/* Authors */}
      <div>
        <label className="sb-label">Authors *</label>
        <input
          name="authors"
          placeholder="e.g., John Doe, Jane Smith, ..."
          className="sb-input"
          required
          value={draftFields.authors}
          onChange={(e) => updateDraftField("authors", e.target.value)}
        />
      </div>

      {/* Publication Type & Year */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="sb-label">Publication Type *</label>
          <select
            name="publicationType"
            className="sb-input"
            required
            value={draftFields.publicationType}
            onChange={(e) =>
              updateDraftField("publicationType", e.target.value)
            }
          >
            {PUBLICATION_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="sb-label">Year</label>
          <input
            name="year"
            type="number"
            placeholder="e.g., 2024"
            className="sb-input"
            value={draftFields.year}
            onChange={(e) => updateDraftField("year", e.target.value)}
          />
        </div>
      </div>

      {/* Journal/Conference & Publisher */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="sb-label">Journal / Conference / Book</label>
          <input
            name="journalOrConference"
            placeholder="e.g., Journal of AI Research"
            className="sb-input"
            value={draftFields.journalOrConference}
            onChange={(e) =>
              updateDraftField("journalOrConference", e.target.value)
            }
          />
        </div>
        <div>
          <label className="sb-label">Publisher</label>
          <input
            name="publisher"
            placeholder="e.g., Springer, IEEE"
            className="sb-input"
            value={draftFields.publisher}
            onChange={(e) => updateDraftField("publisher", e.target.value)}
          />
        </div>
      </div>

      {/* Volume, Issue, Pages */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="sb-label">Volume</label>
          <input
            name="volume"
            placeholder="e.g., 42"
            className="sb-input"
            value={draftFields.volume}
            onChange={(e) => updateDraftField("volume", e.target.value)}
          />
        </div>
        <div>
          <label className="sb-label">Issue</label>
          <input
            name="issue"
            placeholder="e.g., 3"
            className="sb-input"
            value={draftFields.issue}
            onChange={(e) => updateDraftField("issue", e.target.value)}
          />
        </div>
        <div>
          <label className="sb-label">Pages</label>
          <input
            name="pages"
            placeholder="e.g., 123-145"
            className="sb-input"
            value={draftFields.pages}
            onChange={(e) => updateDraftField("pages", e.target.value)}
          />
        </div>
      </div>

      {/* DOI & ISBN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="sb-label">DOI</label>
          <input
            name="doi"
            placeholder="e.g., 10.1000/xyz123"
            className="sb-input"
            value={draftFields.doi}
            onChange={(e) => updateDraftField("doi", e.target.value)}
          />
        </div>
        <div>
          <label className="sb-label">ISBN</label>
          <input
            name="isbn"
            placeholder="e.g., 978-0-123-45678-9"
            className="sb-input"
            value={draftFields.isbn}
            onChange={(e) => updateDraftField("isbn", e.target.value)}
          />
        </div>
      </div>

      {/* URL */}
      <div>
        <label className="sb-label">URL</label>
        <input
          name="url"
          placeholder="https://..."
          className="sb-input"
          value={draftFields.url}
          onChange={(e) => updateDraftField("url", e.target.value)}
        />
      </div>

      {/* Keywords & Domain */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="sb-label">Keywords</label>
          <input
            name="keywords"
            placeholder="e.g., NLP, deep learning, transformers"
            className="sb-input"
            value={draftFields.keywords}
            onChange={(e) => updateDraftField("keywords", e.target.value)}
          />
        </div>
        <div>
          <label className="sb-label">Domain / Area</label>
          <input
            name="domain"
            placeholder="e.g., Computer Science, Physics"
            className="sb-input"
            value={draftFields.domain}
            onChange={(e) => updateDraftField("domain", e.target.value)}
          />
        </div>
      </div>

      {/* Abstract */}
      <div>
        <label className="sb-label">Abstract / Description</label>
        <Editor
          value={draftFields.abstract}
          onChange={(data) => updateDraftField("abstract", data)}
        />
        <input type="hidden" name="abstract" value={draftFields.abstract} />
      </div>

      {/* I am an author checkbox */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          name="isUserAuthor"
          id="isUserAuthor"
          className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          checked={draftFields.isUserAuthor === "true"}
          onChange={(e) =>
            updateDraftField(
              "isUserAuthor",
              e.target.checked ? "true" : "false",
            )
          }
        />
        <label
          htmlFor="isUserAuthor"
          className="text-sm font-medium text-slate-700"
        >
          I am an author / co-author of this publication
        </label>
      </div>

      <SubmitBtnWithAuth className="sb-button-accent mt-2 self-end">
        {mode === "edit" ? "Save Changes" : "Add Publication"}
      </SubmitBtnWithAuth>
    </form>
  );
}
