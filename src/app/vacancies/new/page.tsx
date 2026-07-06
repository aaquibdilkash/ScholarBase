import { createJobVacancy } from "@/app/actions/opportunities";

export default function NewVacancyPage() {
  return (
    <main className="mx-auto max-w-4xl py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Post an Academic Vacancy
        </h1>
        <p className="mt-2 text-slate-600">
          Share trustworthy openings for the academic community.
        </p>
      </div>
      <form
        action={createJobVacancy}
        className="sb-surface-strong flex flex-col gap-5 p-8 md:p-10"
      >
        <div>
          <label className="sb-label">Job Title</label>
          <input
            name="title"
            placeholder="e.g., Assistant Professor (Contractual)"
            className="sb-input"
            required
          />
        </div>

        <div>
          <label className="sb-label">Institution / College</label>
          <input
            name="institution"
            placeholder="e.g., Delhi University"
            className="sb-input"
            required
          />
        </div>

        <div>
          <label className="sb-label">Appointment Type</label>
          <select name="type" className="sb-input bg-white">
            <option value="Permanent">Permanent</option>
            <option value="Adhoc">Adhoc</option>
            <option value="Guest Faculty">Guest Faculty</option>
            <option value="Contractual">Contractual</option>
          </select>
        </div>

        <div>
          <label className="sb-label">Last Date to Apply</label>
          <input type="date" name="deadline" className="sb-input" required />
        </div>

        <div>
          <label className="sb-label">
            Details (Pay Scale, Qualifications)
          </label>
          <textarea
            name="description"
            placeholder="Detail the eligibility metrics (e.g., UGC regulations compliance, API score requirements)..."
            className="sb-input h-32"
            required
          />
        </div>

        <div>
          <label className="sb-label">
            Official Advertisement link (Optional)
          </label>
          <input
            type="url"
            name="notificationLink"
            placeholder="https://institution.org/jobs/advt-2026.pdf"
            className="sb-input"
          />
        </div>

        <div>
          <label className="sb-label">
            Application Link / Email (Optional)
          </label>
          <input
            type="url"
            name="applyLink"
            placeholder="https://recruitment.portal or mailto:hr@inst.edu"
            className="sb-input"
          />
        </div>

        <button type="submit" className="sb-button-accent mt-2 self-end">
          Post Vacancy
        </button>
      </form>
    </main>
  );
}
