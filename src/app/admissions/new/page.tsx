import { createPhdAdmission } from "@/app/actions/opportunities";

export default function NewAdmissionPage() {
  return (
    <main className="max-w-xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6">
        Add PhD Admission Notification
      </h1>
      <form action={createPhdAdmission} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            University / Institute
          </label>
          <input
            name="university"
            placeholder="e.g., Jamia Millia Islamia"
            className="w-full p-3 border rounded-lg"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Department / Faculty
          </label>
          <input
            name="department"
            placeholder="e.g., Department of Management Studies"
            className="w-full p-3 border rounded-lg"
            required
          />
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
            Seat Matrix / Eligibility Notes
          </label>
          <textarea
            name="description"
            placeholder="Specify JRF/NET exemptions, tentative seats, or specialization availability..."
            className="w-full p-3 border rounded-lg h-32"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Notification Circular URL (Optional)
          </label>
          <input
            type="url"
            name="notificationLink"
            placeholder="https://university.edu/admission-notice.pdf"
            className="w-full p-3 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Application Portal URL (Optional)
          </label>
          <input
            type="url"
            name="applyLink"
            placeholder="https://jmicoe.in"
            className="w-full p-3 border rounded-lg"
          />
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 transition mt-2"
        >
          Post Notification
        </button>
      </form>
    </main>
  );
}
