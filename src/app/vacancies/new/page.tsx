import { createJobVacancy } from "@/app/actions/opportunities";

export default function NewVacancyPage() {
  return (
    <main className="max-w-xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6">Post an Academic Vacancy</h1>
      <form action={createJobVacancy} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Job Title
          </label>
          <input
            name="title"
            placeholder="e.g., Assistant Professor (Contractual)"
            className="w-full p-3 border rounded-lg"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Institution / College
          </label>
          <input
            name="institution"
            placeholder="e.g., Delhi University"
            className="w-full p-3 border rounded-lg"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Appointment Type
          </label>
          <select name="type" className="w-full p-3 border rounded-lg bg-white">
            <option value="Permanent">Permanent</option>
            <option value="Adhoc">Adhoc</option>
            <option value="Guest Faculty">Guest Faculty</option>
            <option value="Contractual">Contractual</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Last Date to Apply
          </label>
          <input
            type="date"
            name="deadline"
            className="w-full p-3 border rounded-lg"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Details (Pay Scale, Qualifications)
          </label>
          <textarea
            name="description"
            placeholder="Detail the eligibility metrics (e.g., UGC regulations compliance, API score requirements)..."
            className="w-full p-3 border rounded-lg h-32"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Official Advertisement link (Optional)
          </label>
          <input
            type="url"
            name="notificationLink"
            placeholder="https://institution.org/jobs/advt-2026.pdf"
            className="w-full p-3 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Application Link / Email (Optional)
          </label>
          <input
            type="url"
            name="applyLink"
            placeholder="https://recruitment.portal or mailto:hr@inst.edu"
            className="w-full p-3 border rounded-lg"
          />
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 transition mt-2"
        >
          Post Vacancy
        </button>
      </form>
    </main>
  );
}
