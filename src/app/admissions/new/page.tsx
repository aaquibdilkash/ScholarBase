import { createPhdAdmission } from "@/app/actions/opportunities";
import Link from "next/link";

export default function NewAdmissionPage() {
  return (
    <main className="mx-auto max-w-4xl py-6">
      <div className="mb-8">
        <Link
          href="/admissions"
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Back to Admissions
        </Link>
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
            Notification Circular URL
          </label>
          <input
            type="url"
            name="notificationLink"
            placeholder="https://university.edu/admission-notice.pdf"
            className="sb-input"
            required
          />
        </div>

        <div>
          <label className="sb-label">Application Portal URL</label>
          <input
            type="url"
            name="applyLink"
            placeholder="https://jmicoe.in"
            className="sb-input"
            required
          />
        </div>

        <button type="submit" className="sb-button-accent mt-2 self-end">
          Post Notification
        </button>
      </form>
    </main>
  );
}
