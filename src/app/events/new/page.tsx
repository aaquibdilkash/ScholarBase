import { createResearchEvent } from "@/app/actions/opportunities";

export default function NewEventPage() {
  return (
    <main className="mx-auto max-w-4xl py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          List a Research Event / Conference
        </h1>
        <p className="mt-2 text-slate-600">
          Add conferences, calls, and events that matter to researchers.
        </p>
      </div>
      <form
        action={createResearchEvent}
        className="sb-surface-strong flex flex-col gap-5 p-8 md:p-10"
      >
        <div>
          <label className="sb-label">Conference Title</label>
          <input
            name="title"
            placeholder="e.g., Annual Conference on Financial Econometrics"
            className="sb-input"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="sb-label">Event Date</label>
            <input type="date" name="date" className="sb-input" required />
          </div>
          <div>
            <label className="sb-label">Location</label>
            <input
              name="location"
              placeholder="e.g., New Delhi, India or Virtual"
              className="sb-input"
              required
            />
          </div>
        </div>

        <div>
          <label className="sb-label">Submission Deadline (Optional)</label>
          <input type="date" name="deadline" className="sb-input" />
        </div>

        <div>
          <label className="sb-label">Description / Tracks</label>
          <textarea
            name="description"
            placeholder="Briefly describe the theme of the conference and presentation tracks..."
            className="sb-input h-32"
            required
          />
        </div>

        <div>
          <label className="sb-label">Official Brochure URL (Optional)</label>
          <input
            type="url"
            name="notificationLink"
            placeholder="https://university.edu/brochure.pdf"
            className="sb-input"
          />
        </div>

        <div>
          <label className="sb-label">Submission Portal URL (Optional)</label>
          <input
            type="url"
            name="applyLink"
            placeholder="https://easychair.org/cfp/..."
            className="sb-input"
          />
        </div>

        <button type="submit" className="sb-button-accent mt-2 self-end">
          Publish Event
        </button>
      </form>
    </main>
  );
}
