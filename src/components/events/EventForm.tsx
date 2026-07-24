import { createResearchEvent, updateResearchEvent } from "@/app/actions/events";
import { SubmitBtn } from "@/components/ui/SubmitBtn";

export type EventFormValues = {
  title: string;
  date: string; // yyyy-mm-dd
  location: string;
  description: string;
  deadline: string; // optional yyyy-mm-dd (can be empty)
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
  const values: EventFormValues = {
    title: initialValues?.title ?? "",
    date: initialValues?.date ?? "",
    location: initialValues?.location ?? "",
    description: initialValues?.description ?? "",
    deadline: initialValues?.deadline ?? "",
    notificationLink: initialValues?.notificationLink ?? "",
    applyLink: initialValues?.applyLink ?? "",
  };

  // 👇 1. Define the Server Action cleanly OUTSIDE of the JSX
  async function handleEditAction(formData: FormData) {
    "use server";
    await updateResearchEvent(formData, String(eventId));
  }

  // 👇 2. Decide which action to use before the return statement
  const formAction = mode === "edit" ? handleEditAction : createResearchEvent;

  return (
    <form
      action={formAction}
      className="sb-surface-strong flex flex-col gap-5 p-8 md:p-10"
    >
      <div>
        <label className="sb-label">Conference Title</label>
        <input
          name="title"
          placeholder="e.g., Annual Conference on Financial Econometrics"
          className="sb-input"
          required
          defaultValue={values.title}
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
            defaultValue={values.date}
          />
        </div>
        <div>
          <label className="sb-label">Location</label>
          <input
            name="location"
            placeholder="e.g., New Delhi, India or Virtual"
            className="sb-input"
            required
            defaultValue={values.location}
          />
        </div>
      </div>

      <div>
        <label className="sb-label">Submission Deadline (Optional)</label>
        <input
          type="date"
          name="deadline"
          className="sb-input"
          defaultValue={values.deadline}
        />
      </div>

      <div>
        <label className="sb-label">Description / Tracks</label>
        <textarea
          name="description"
          placeholder="Briefly describe the theme of the conference and presentation tracks..."
          className="sb-input h-32"
          required
          defaultValue={values.description}
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
          defaultValue={values.notificationLink}
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
          defaultValue={values.applyLink}
        />
      </div>

      <SubmitBtn className="sb-button-accent mt-2 self-end">
        {mode === "edit" ? "Save Changes" : "Publish Event"}
      </SubmitBtn>
    </form>
  );
}
