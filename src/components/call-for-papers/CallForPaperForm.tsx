"use client";

import { useRouter } from "next/navigation";
import { updateCallForPaper, createCallForPaper } from "@/app/actions/call-for-papers";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { Editor } from "@/components/ui/Editor";
import { FormCancelButton } from "@/components/ui/FormCancelButton";
import { useQueryClient } from "@tanstack/react-query";
import { upsertToList } from "@/utils/cacheMutation";
import { CautionNote } from "@/components/ui/CautionNote";
import { getTodayString } from "@/lib/date";
import {
  MAX_EVENT_TITLE,
  MAX_EVENT_PUBLISHER,
  MAX_EVENT_LOCATION,
  MAX_EVENT_NOTIFICATION_LINK,
  MAX_EVENT_APPLY_LINK,
  MAX_EVENT_DESCRIPTION,
} from "@/lib/constants";
import { getRichTextLength } from "@/lib/html";
import type { CallForPaperWithAuthor } from "@/types/cards";
import { JournalPicker } from "./JournalPicker";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { ContentImageUploadField } from "@/components/upload/ContentImageUploadField";
import {
  EVENT_TITLE_TIP,
  EVENT_PUBLISHER_TIP,
  EVENT_DATE_TIP,
  EVENT_LOCATION_TIP,
  EVENT_DEADLINE_TIP,
  EVENT_DESCRIPTION_TIP,
  EVENT_NOTIFICATION_LINK_TIP,
  EVENT_APPLY_LINK_TIP,
} from "@/constants/tooltips";

export type CallForPaperFormValues = {
  title: string;
  category: string;
  publisher: string;
  journalId: string;
  journal: string;
  eventDate: string;
  location: string;
  description: string;
  deadline: string;
  notificationLink: string;
  applyLink: string;
  imageUrl: string;
};

export default function CallForPaperForm({
  mode,
  eventId,
  initialValues,
}: {
  mode: "create" | "edit";
  eventId?: string;
  initialValues?: Partial<CallForPaperFormValues>;
}) {
  const router = useRouter();
  const initial = {
    title: initialValues?.title ?? "",
    category: initialValues?.category ?? "CONFERENCE",
    publisher: initialValues?.publisher ?? "",
    journalId: initialValues?.journalId ?? "",
    journal: initialValues?.journal ?? "",
    eventDate: initialValues?.eventDate ?? "",
    location: initialValues?.location ?? "",
    description: initialValues?.description ?? "",
    deadline: initialValues?.deadline ?? "",
    notificationLink: initialValues?.notificationLink ?? "",
    applyLink: initialValues?.applyLink ?? "",
    imageUrl: initialValues?.imageUrl ?? "",
  };

  const draftKey = mode === "edit" ? null : "draft_event_create";
  const [draftFields, updateDraftField, resetDraft] = useFormDraft(
    draftKey,
    initial,
  );
  const queryClient = useQueryClient();

  const today = getTodayString();

  const { submitting, submit } = useFormSubmit(mode !== "edit" ? resetDraft : undefined, {
    resetOnSuccess: mode !== "edit",
    successMessage:
      mode === "create"
        ? "Call for papers published successfully!"
        : "Event updated successfully!",
    errorMessage:
      mode === "create"
        ? "Failed to publish call for papers."
        : "Failed to update event.",
    onSuccess: (response) => {
      if (response.success && response.data) {
        const event = response.data as CallForPaperWithAuthor;
        upsertToList<CallForPaperWithAuthor>(
          queryClient,
          ["call-for-papers"],
          event,
          mode,
        );
        router.push(`/call-for-papers/${event.id}`);
      }
    },
  });

  const isDescriptionOverLimit =
    getRichTextLength(draftFields.description) > MAX_EVENT_DESCRIPTION;
  const isFormOverLimit = isDescriptionOverLimit;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isFormOverLimit) return;

    const formData = new FormData(e.currentTarget);

    await submit(() => {
      if (mode === "edit" && eventId) {
        return updateCallForPaper(formData, eventId);
      } else {
        return createCallForPaper(formData);
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="sb-surface-strong flex flex-col gap-5 p-4 sm:p-6 md:p-10"
    >
      <CautionNote />
      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          Call for Papers Title
          <InfoTooltip message={EVENT_TITLE_TIP} />
        </label>
<input
            name="title"
            placeholder="e.g., Annual Conference on Financial Econometrics"
            className="sb-input"
            required
            maxLength={MAX_EVENT_TITLE}
            value={draftFields.title}
            onChange={(e) => updateDraftField("title", e.target.value)}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.title.length}/{MAX_EVENT_TITLE} characters
          </div>
        </div>

        <div>
          <label className="sb-label">Call Type</label>
          <select
            name="category"
            className="sb-input"
            value={draftFields.category}
            onChange={(e) => updateDraftField("category", e.target.value)}
          >
            <option value="CONFERENCE">Conference</option>
            <option value="BOOK_CHAPTER">Book chapter</option>
            <option value="JOURNAL">Journal</option>
            <option value="WORKSHOP">Workshop</option>
            <option value="SYMPOSIUM">Symposium</option>
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="sb-label inline-flex items-center gap-1.5">
              Publisher (Optional)
              <InfoTooltip message={EVENT_PUBLISHER_TIP} />
            </label>
            <input
              name="publisher"
              className="sb-input"
              placeholder="e.g., Elsevier, Springer, Routledge"
              maxLength={MAX_EVENT_PUBLISHER}
              value={draftFields.publisher}
              onChange={(e) => updateDraftField("publisher", e.target.value)}
            />
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {draftFields.publisher.length}/{MAX_EVENT_PUBLISHER} characters
            </div>
          </div>
          <JournalPicker
            journal={draftFields.journal}
            journalId={draftFields.journalId}
            onJournalChange={(value) => updateDraftField("journal", value)}
            onJournalIdChange={(value) => updateDraftField("journalId", value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="sb-label inline-flex items-center gap-1.5">
              Event / Publication Date (Optional)
              <InfoTooltip message={EVENT_DATE_TIP} />
            </label>
            <input
              type="date"
              name="eventDate"
              className="sb-input"
              min={today}
              value={draftFields.eventDate}
              onChange={(e) => updateDraftField("eventDate", e.target.value)}
            />
          </div>
          <div>
            <label className="sb-label inline-flex items-center gap-1.5">
              Location (Optional)
              <InfoTooltip message={EVENT_LOCATION_TIP} />
            </label>
            <input
              name="location"
              placeholder="e.g., New Delhi, India or Virtual"
              className="sb-input"
              maxLength={MAX_EVENT_LOCATION}
              value={draftFields.location}
              onChange={(e) => updateDraftField("location", e.target.value)}
            />
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {draftFields.location.length}/{MAX_EVENT_LOCATION} characters
            </div>
          </div>
        </div>

        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Submission Deadline (Optional)
            <InfoTooltip message={EVENT_DEADLINE_TIP} />
          </label>
          <input
            type="date"
            name="deadline"
            className="sb-input"
            min={today}
            value={draftFields.deadline}
            onChange={(e) => updateDraftField("deadline", e.target.value)}
          />
        </div>

        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Cover Image (Optional)
            <InfoTooltip message="Main image shown on the call for papers list card and detail page header." />
          </label>
          <ContentImageUploadField
            kind="cfp-cover"
            value={draftFields.imageUrl}
            onChange={(url) => updateDraftField("imageUrl", url)}
          />
          <input type="hidden" name="coverImageUrl" value={draftFields.imageUrl} />
        </div>

        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Scope, Themes, or Submission Guidelines
            <InfoTooltip message={EVENT_DESCRIPTION_TIP} />
          </label>
          <Editor
            value={draftFields.description}
            onChange={(data) => updateDraftField("description", data)}
            maxLength={MAX_EVENT_DESCRIPTION}
          />
          <input
            type="hidden"
            name="description"
            value={draftFields.description}
          />
        </div>

      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          Official Call URL
          <InfoTooltip message={EVENT_NOTIFICATION_LINK_TIP} />
        </label>
<input
            type="url"
            pattern="https?://.+"
            name="notificationLink"
            placeholder="https://university.edu/brochure.pdf"
            className="sb-input"
            required
            maxLength={MAX_EVENT_NOTIFICATION_LINK}
            value={draftFields.notificationLink}
            onChange={(e) => updateDraftField("notificationLink", e.target.value)}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.notificationLink.length}/{MAX_EVENT_NOTIFICATION_LINK} characters
          </div>
        </div>

        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Submission Link / Email
            <InfoTooltip message={EVENT_APPLY_LINK_TIP} />
          </label>
          <input
            type="text"
            name="applyLink"
            placeholder="https://easychair.org/cfp/... or chair@conf.org"
            className="sb-input"
            required
            maxLength={MAX_EVENT_APPLY_LINK}
            value={draftFields.applyLink}
            onChange={(e) => updateDraftField("applyLink", e.target.value)}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.applyLink.length}/{MAX_EVENT_APPLY_LINK} characters
          </div>
        </div>

      <div className="mt-2 flex justify-end gap-3">
        <FormCancelButton />
        <SubmitBtnWithAuth
          className="sb-button-accent"
          disabled={submitting || isFormOverLimit}
          loadingText={mode === "edit" ? "Saving..." : "Publishing..."}
        >
          {mode === "edit" ? "Save Changes" : "Publish Call for Papers"}
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}
