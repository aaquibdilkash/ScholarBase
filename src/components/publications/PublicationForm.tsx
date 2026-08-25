"use client";

import { useRouter } from "next/navigation";
import {
  createPublication,
  updatePublication,
} from "@/app/actions/publications";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { Editor } from "@/components/ui/Editor";
import { FormCancelButton } from "@/components/ui/FormCancelButton";
import { useQueryClient } from "@tanstack/react-query";
import { upsertToList } from "@/utils/cacheMutation";
import { CautionNote } from "@/components/ui/CautionNote";
import {
  MAX_PUBLICATION_TITLE,
  MAX_PUBLICATION_AUTHORS,
  MAX_PUBLICATION_JOURNAL,
  MAX_PUBLICATION_PUBLISHER,
  MAX_PUBLICATION_DOI,
  MAX_PUBLICATION_ISBN,
  MAX_PUBLICATION_URL,
  MAX_PUBLICATION_KEYWORDS,
  MAX_PUBLICATION_DOMAIN,
  MAX_PUBLICATION_ABSTRACT,
  MAX_PUBLICATION_VOLUME,
  MAX_PUBLICATION_ISSUE,
  MAX_PUBLICATION_PAGES,
} from "@/lib/constants";
import type { PublicationWithAuthor } from "@/types/cards";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  PUBLICATION_TITLE_TIP,
  PUBLICATION_AUTHORS_TIP,
  PUBLICATION_TYPE_TIP,
  PUBLICATION_YEAR_TIP,
  PUBLICATION_JOURNAL_TIP,
  PUBLICATION_PUBLISHER_TIP,
  PUBLICATION_VOLUME_TIP,
  PUBLICATION_ISSUE_TIP,
  PUBLICATION_PAGES_TIP,
  PUBLICATION_DOI_TIP,
  PUBLICATION_ISBN_TIP,
  PUBLICATION_URL_TIP,
  PUBLICATION_KEYWORDS_TIP,
  PUBLICATION_DOMAIN_TIP,
  PUBLICATION_ABSTRACT_TIP,
  PUBLICATION_IS_USER_AUTHOR_TIP,
} from "@/constants/tooltips";

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
  const router = useRouter();
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

  const draftKey = mode === "edit" ? null : "draft_publication_create";
  const [draftFields, updateDraftField, resetDraft] = useFormDraft(
    draftKey,
    initial,
  );
  const queryClient = useQueryClient();

  const { submitting, submit } = useFormSubmit(
    mode !== "edit" ? resetDraft : undefined,
    {
      resetOnSuccess: mode !== "edit",
      successMessage:
        mode === "create"
          ? "Publication added successfully!"
          : "Publication updated successfully!",
      errorMessage:
        mode === "create"
          ? "Failed to add publication."
          : "Failed to update publication.",
      onSuccess: (response) => {
        if (response.success && response.data) {
          const data = response.data as PublicationWithAuthor;
          upsertToList<PublicationWithAuthor>(
            queryClient,
            ["publications"],
            data,
            mode,
          );
          router.push(`/publications/${data.id}`);
        }
      },
    },
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    await submit(() => {
      if (mode === "edit" && publicationId) {
        return updatePublication(formData, publicationId);
      } else {
        return createPublication(formData);
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="sb-surface-strong flex flex-col gap-5 p-8 md:p-10"
    >
      <CautionNote />
      {/* Title */}
      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          Publication Title *
          <InfoTooltip message={PUBLICATION_TITLE_TIP} />
        </label>
        <input
          name="title"
          placeholder="e.g., A Novel Approach to Natural Language Processing"
          className="sb-input"
          required
          maxLength={MAX_PUBLICATION_TITLE}
          value={draftFields.title}
          onChange={(e) => updateDraftField("title", e.target.value)}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.title.length}/{MAX_PUBLICATION_TITLE} characters
        </div>
      </div>

      {/* Authors */}
      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          Authors *
          <InfoTooltip message={PUBLICATION_AUTHORS_TIP} />
        </label>
        <input
          name="authors"
          placeholder="e.g., John Doe, Jane Smith, ..."
          className="sb-input"
          required
          maxLength={MAX_PUBLICATION_AUTHORS}
          value={draftFields.authors}
          onChange={(e) => updateDraftField("authors", e.target.value)}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.authors.length}/{MAX_PUBLICATION_AUTHORS} characters
        </div>
      </div>

      {/* Publication Type & Year */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Publication Type *
            <InfoTooltip message={PUBLICATION_TYPE_TIP} />
          </label>
          <select
            name="publicationType"
            className="sb-select"
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
          <label className="sb-label inline-flex items-center gap-1.5">
            Year
            <InfoTooltip message={PUBLICATION_YEAR_TIP} />
          </label>
          <select
            name="year"
            className="sb-select"
            value={draftFields.year}
            onChange={(e) => updateDraftField("year", e.target.value)}
          >
            <option value="">Select Year</option>
            {Array.from({ length: 2026 - 1950 + 1 }, (_, i) => 2026 - i).map(
              (year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ),
            )}
          </select>
        </div>
      </div>

      {/* Journal/Conference & Publisher */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Journal / Conference / Book
            <InfoTooltip message={PUBLICATION_JOURNAL_TIP} />
          </label>
          <input
            name="journalOrConference"
            placeholder="e.g., Journal of AI Research"
            className="sb-input"
            maxLength={MAX_PUBLICATION_JOURNAL}
            value={draftFields.journalOrConference}
            onChange={(e) =>
              updateDraftField("journalOrConference", e.target.value)
            }
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.journalOrConference.length}/{MAX_PUBLICATION_JOURNAL}{" "}
            characters
          </div>
        </div>
        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Publisher
            <InfoTooltip message={PUBLICATION_PUBLISHER_TIP} />
          </label>
          <input
            name="publisher"
            placeholder="e.g., Springer, IEEE"
            className="sb-input"
            maxLength={MAX_PUBLICATION_PUBLISHER}
            value={draftFields.publisher}
            onChange={(e) => updateDraftField("publisher", e.target.value)}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.publisher.length}/{MAX_PUBLICATION_PUBLISHER}{" "}
            characters
          </div>
        </div>
      </div>

      {/* Volume, Issue, Pages */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Volume
            <InfoTooltip message={PUBLICATION_VOLUME_TIP} />
          </label>
          <input
            name="volume"
            placeholder="e.g., 42"
            className="sb-input"
            maxLength={MAX_PUBLICATION_VOLUME}
            value={draftFields.volume}
            onChange={(e) => updateDraftField("volume", e.target.value)}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.volume.length}/{MAX_PUBLICATION_VOLUME} characters
          </div>
        </div>
        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Issue
            <InfoTooltip message={PUBLICATION_ISSUE_TIP} />
          </label>
          <input
            name="issue"
            placeholder="e.g., 3"
            className="sb-input"
            maxLength={MAX_PUBLICATION_ISSUE}
            value={draftFields.issue}
            onChange={(e) => updateDraftField("issue", e.target.value)}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.issue.length}/{MAX_PUBLICATION_ISSUE} characters
          </div>
        </div>
        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Pages
            <InfoTooltip message={PUBLICATION_PAGES_TIP} />
          </label>
          <input
            name="pages"
            placeholder="e.g., 123-145"
            className="sb-input"
            maxLength={MAX_PUBLICATION_PAGES}
            value={draftFields.pages}
            onChange={(e) => updateDraftField("pages", e.target.value)}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.pages.length}/{MAX_PUBLICATION_PAGES} characters
          </div>
        </div>
      </div>

      {/* DOI & ISBN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            DOI
            <InfoTooltip message={PUBLICATION_DOI_TIP} />
          </label>
          <input
            name="doi"
            placeholder="e.g., 10.1000/xyz123"
            className="sb-input"
            maxLength={MAX_PUBLICATION_DOI}
            value={draftFields.doi}
            onChange={(e) => updateDraftField("doi", e.target.value)}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.doi.length}/{MAX_PUBLICATION_DOI} characters
          </div>
        </div>
        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            ISBN
            <InfoTooltip message={PUBLICATION_ISBN_TIP} />
          </label>
          <input
            name="isbn"
            placeholder="e.g., 978-0-123-45678-9"
            className="sb-input"
            maxLength={MAX_PUBLICATION_ISBN}
            value={draftFields.isbn}
            onChange={(e) => updateDraftField("isbn", e.target.value)}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.isbn.length}/{MAX_PUBLICATION_ISBN} characters
          </div>
        </div>
      </div>

      {/* URL */}
      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          URL
          <InfoTooltip message={PUBLICATION_URL_TIP} />
        </label>
        <input
          name="url"
          placeholder="https://..."
          className="sb-input"
          maxLength={MAX_PUBLICATION_URL}
          value={draftFields.url}
          onChange={(e) => updateDraftField("url", e.target.value)}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.url.length}/{MAX_PUBLICATION_URL} characters
        </div>
      </div>

      {/* Keywords & Domain */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Keywords
            <InfoTooltip message={PUBLICATION_KEYWORDS_TIP} />
          </label>
          <input
            name="keywords"
            placeholder="e.g., NLP, deep learning, transformers"
            className="sb-input"
            maxLength={MAX_PUBLICATION_KEYWORDS}
            value={draftFields.keywords}
            onChange={(e) => updateDraftField("keywords", e.target.value)}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.keywords.length}/{MAX_PUBLICATION_KEYWORDS} characters
          </div>
        </div>
        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Domain / Area
            <InfoTooltip message={PUBLICATION_DOMAIN_TIP} />
          </label>
          <input
            name="domain"
            placeholder="e.g., Computer Science, Physics"
            className="sb-input"
            maxLength={MAX_PUBLICATION_DOMAIN}
            value={draftFields.domain}
            onChange={(e) => updateDraftField("domain", e.target.value)}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.domain.length}/{MAX_PUBLICATION_DOMAIN} characters
          </div>
        </div>
      </div>

      {/* Abstract */}
      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          Abstract / Description
          <InfoTooltip message={PUBLICATION_ABSTRACT_TIP} />
        </label>
        <Editor
          value={draftFields.abstract}
          onChange={(data) => updateDraftField("abstract", data)}
          maxLength={MAX_PUBLICATION_ABSTRACT}
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
          className="text-sm font-medium text-slate-700 inline-flex items-center gap-1.5"
        >
          I am an author / co-author of this publication
          <InfoTooltip message={PUBLICATION_IS_USER_AUTHOR_TIP} />
        </label>
      </div>

      <div className="mt-2 flex justify-end gap-3">
        <FormCancelButton />
        <SubmitBtnWithAuth className="sb-button-accent" disabled={submitting}>
          {mode === "edit" ? "Save Changes" : "Add Publication"}
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}
