import { createResearchEvent } from "@/app/actions/opportunities";

export default function NewEventPage() {
  return (
    <main className="max-w-xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6">
        List a Research Event / Conference
      </h1>
      <form action={createResearchEvent} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Conference Title
          </label>
          <input
            name="title"
            placeholder="e.g., Annual Conference on Financial Econometrics"
            className="w-full p-3 border rounded-lg"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Event Date
            </label>
            <input
              type="date"
              name="date"
              className="w-full p-3 border rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Location
            </label>
            <input
              name="location"
              placeholder="e.g., New Delhi, India or Virtual"
              className="w-full p-3 border rounded-lg"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Submission Deadline (Optional)
          </label>
          <input
            type="date"
            name="deadline"
            className="w-full p-3 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Description / Tracks
          </label>
          <textarea
            name="description"
            placeholder="Briefly describe the theme of the conference and presentation tracks..."
            className="w-full p-3 border rounded-lg h-32"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Official Brochure URL (Optional)
          </label>
          <input
            type="url"
            name="notificationLink"
            placeholder="https://university.edu/brochure.pdf"
            className="w-full p-3 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Submission Portal URL (Optional)
          </label>
          <input
            type="url"
            name="applyLink"
            placeholder="https://easychair.org/cfp/..."
            className="w-full p-3 border rounded-lg"
          />
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 transition mt-2"
        >
          Publish Event
        </button>
      </form>
    </main>
  );
}
