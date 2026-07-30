"use client";

import {
  createResearchEvent,
  updateResearchEvent,
  createEventSafe,
} from "@/app/actions/events";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { Editor } from "@/components/ui/Editor";
import { useAuthModal } from "@/components/interactions/AuthModal";

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
  isLoggedIn,
}: {
  mode: "create" | "edit";
  eventId?: string;
  initialValues?: Partial<EventFormValues>;
  isLoggedIn?: boolean;
}) {
  const { openAuthModal } = useAuthModal();
  const initial = {
    title: initialValues?.title ?? "",
    date: initialValues?.date ?? "",
    location: initialValues?.location ?? "",
    description: initialValues?.description ?? "",
    deadline: initialValues?.deadline ?? "",
    notificationLink: initialValues?.notificationLink ?? "",
    applyLink: initialValues?.applyLink ?? "",
  };

  const [draftFields, updateDraftField, resetDraft] = useFormDraft(
    `draft_event_${mode}`,
    initial,
  );

  const { submitting, submit } = useFormSubmit(
    mode !== "edit" ? resetDraft : undefined,
    {
      resetOnSuccess: mode !== "edit",
      successMessage: "Event published successfully!",
      errorMessage: "Failed to publish event.",
    },
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mode === "create" && !isLoggedIn) {
      openAuthModal();
      return;
    }
    const formData = new FormData(e.currentTarget);

    if (mode === "edit" && eventId) {
      await updateResearchEvent(formData, eventId);
    } else {
      await submit(() => createEventSafe(formData));
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="sb-surface-strong flex flex-col gap-5 p-8 md:p-10"
    >
      <div>
        <label className="sb-label">Conference Title</label>
        <input
          name="title"
          placeholder="e.g., Annual Conference on Financial Econometrics"
          className="sb-input"
          required
          value={draftFields.title}
          onChange={(e) => updateDraftField("title", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="sb-label">Event Date</label>
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
          <label className="sb-label">Location</label>
          <input
            name="location"
            placeholder="e.g., New Delhi, India or Virtual"
            className="sb-input"
            required
            value={draftFields.location}
            onChange={(e) => updateDraftField("location", e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="sb-label">Submission Deadline (Optional)</label>
        <input
          type="date"
          name="deadline"
          className="sb-input"
          value={draftFields.deadline}
          onChange={(e) => updateDraftField("deadline", e.target.value)}
        />
      </div>

      <div>
        <label className="sb-label">Description / Tracks</label>
        <Editor
          value={draftFields.description}
          onChange={(data) => updateDraftField("description", data)}
        />
        <input
          type="hidden"
          name="description"
          value={draftFields.description}
        />
      </div>

      <div>
        <label className="sb-label">Official Brochure URL</label>
        <input
          type="url"
          name="notificationLink"
          placeholder="https://university.edu/brochure.pdf"
          className="sb-input"
          required
          value={draftFields.notificationLink}
          onChange={(e) => updateDraftField("notificationLink", e.target.value)}
        />
      </div>

      <div>
        <label className="sb-label">Submission Portal URL</label>
        <input
          type="url"
          name="applyLink"
          placeholder="https://easychair.org/cfp/..."
          className="sb-input"
          required
          value={draftFields.applyLink}
          onChange={(e) => updateDraftField("applyLink", e.target.value)}
        />
      </div>

      <SubmitBtnWithAuth className="sb-button-accent mt-2 self-end">
        {mode === "edit" ? "Save Changes" : "Publish Event"}
      </SubmitBtnWithAuth>
    </form>
  );
}
