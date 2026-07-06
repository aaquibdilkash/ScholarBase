import { createPhdAdmission } from "@/app/actions/opportunities";

export default function NewAdmissionPage() {
  return (
    <main className="mx-auto max-w-4xl py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Add PhD Admission Notification
        </h1>
        <p className="mt-2 text-slate-600">
          Share verified admission calls for the community.
        </p>
      </div>
      <form
        action={createPhdAdmission}
        className="sb-surface-strong flex flex-col gap-5 p-8 md:p-10"
      >
        <div>
          <label className="sb-label">University / Institute</label>
          <input
            name="university"
            placeholder="e.g., Jamia Millia Islamia"
            className="sb-input"
            required
          />
        </div>

        <div>
          <label className="sb-label">Department / Faculty</label>
          <input
            name="department"
            placeholder="e.g., Department of Management Studies"
            className="sb-input"
            required
          />
        </div>

        <div>
          <label className="sb-label">Last Date to Apply</label>
          <input type="date" name="deadline" className="sb-input" required />
        </div>

        <div>
          <label className="sb-label">Seat Matrix / Eligibility Notes</label>
          <textarea
            name="description"
            placeholder="Specify JRF/NET exemptions, tentative seats, or specialization availability..."
            className="sb-input h-32"
            required
          />
        </div>

        <div>
          <label className="sb-label">
            Notification Circular URL (Optional)
          </label>
          <input
            type="url"
            name="notificationLink"
            placeholder="https://university.edu/admission-notice.pdf"
            className="sb-input"
          />
        </div>

        <div>
          <label className="sb-label">Application Portal URL (Optional)</label>
          <input
            type="url"
            name="applyLink"
            placeholder="https://jmicoe.in"
            className="sb-input"
          />
        </div>

        <button type="submit" className="sb-button-accent mt-2 self-end">
          Post Notification
        </button>
      </form>
    </main>
  );
}
