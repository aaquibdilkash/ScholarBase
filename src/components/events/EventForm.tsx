"use client";

import { useRouter } from "next/navigation";
import { updateResearchEvent, createResearchEvent } from "@/app/actions/events";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { Editor } from "@/components/ui/Editor";
import { FormCancelButton } from "@/components/ui/FormCancelButton";
import { useQueryClient } from "@tanstack/react-query";
import { upsertToList } from "@/utils/cacheMutation";
import { CautionNote } from "@/components/ui/CautionNote";
import {
  MAX_EVENT_TITLE,
  MAX_EVENT_LOCATION,
  MAX_EVENT_NOTIFICATION_LINK,
  MAX_EVENT_APPLY_LINK,
  MAX_EVENT_DESCRIPTION,
} from "@/lib/constants";
import type { EventWithAuthor } from "@/types/cards";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  EVENT_TITLE_TIP,
  EVENT_DATE_TIP,
  EVENT_LOCATION_TIP,
  EVENT_DEADLINE_TIP,
  EVENT_DESCRIPTION_TIP,
  EVENT_NOTIFICATION_LINK_TIP,
  EVENT_APPLY_LINK_TIP,
} from "@/constants/tooltips";

export type EventFormValues = {
  title: string;
  date: string;
  location: string;
  description: string;
  deadline: string;
  notificationLink: string;
  applyLink: string;
};

export default function EventForm({
  mode,
  eventId,
  initialValues,
}: {
  mode: "create" | "edit";
  eventId?: string;
  initialValues?: Partial<EventFormValues>;
}) {
  const router = useRouter();
  const initial = {
    title: initialValues?.title ?? "",
    date: initialValues?.date ?? "",
    location: initialValues?.location ?? "",
    description: initialValues?.description ?? "",
    deadline: initialValues?.deadline ?? "",
    notificationLink: initialValues?.notificationLink ?? "",
    applyLink: initialValues?.applyLink ?? "",
  };

  const draftKey = mode === "edit" ? null : "draft_event_create";
  const [draftFields, updateDraftField, resetDraft] = useFormDraft(
    draftKey,
    initial,
  );
  const queryClient = useQueryClient();

  const { submit } = useFormSubmit(mode !== "edit" ? resetDraft : undefined, {
    resetOnSuccess: mode !== "edit",
    successMessage:
      mode === "create"
        ? "Event published successfully!"
        : "Event updated successfully!",
    errorMessage:
      mode === "create"
        ? "Failed to publish event."
        : "Failed to update event.",
    onSuccess: (response) => {
      if (response.success && response.data) {
        const event = response.data as EventWithAuthor;
        upsertToList<EventWithAuthor>(
          queryClient,
          ["events"],
          event,
          mode,
        );
        router.push(`/events/${event.id}`);
      }
    },
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    await submit(() => {
      if (mode === "edit" && eventId) {
        return updateResearchEvent(formData, eventId);
      } else {
        return createResearchEvent(formData);
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
        <label className="sb-label inline-flex items-center gap-1.5">
          Conference Title
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="sb-label inline-flex items-center gap-1.5">
              Event Date
              <InfoTooltip message={EVENT_DATE_TIP} />
            </label>
            <input
              type="date"
              name="date"
              className="sb-input"
              required
              value={draftFields.date}
              onChange={(e) => updateDraftField("date", e.target.value)}
            />
          </div>
          <div>
            <label className="sb-label inline-flex items-center gap-1.5">
              Location
              <InfoTooltip message={EVENT_LOCATION_TIP} />
            </label>
            <input
              name="location"
              placeholder="e.g., New Delhi, India or Virtual"
              className="sb-input"
              required
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
            value={draftFields.deadline}
            onChange={(e) => updateDraftField("deadline", e.target.value)}
          />
        </div>

        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Description / Tracks
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
          Official Brochure URL
          <InfoTooltip message={EVENT_NOTIFICATION_LINK_TIP} />
        </label>
<input
            type="url"
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
            Submission Portal URL
            <InfoTooltip message={EVENT_APPLY_LINK_TIP} />
          </label>
          <input
            type="url"
            name="applyLink"
            placeholder="https://easychair.org/cfp/..."
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
        <SubmitBtnWithAuth className="sb-button-accent">
          {mode === "edit" ? "Save Changes" : "Publish Event"}
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}
