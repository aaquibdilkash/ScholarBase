import { createHelpPost } from "@/app/actions/help";
import Link from "next/link";

export default function NewHelpPostPage() {
  async function handleSubmit(formData: FormData) {
    "use server";
    await createHelpPost(formData);
  }

  return (
    <main className="mx-auto max-w-4xl py-6">
      <div className="mb-8">
        <Link
          href="/help"
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Back to Help & Support
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Create a New Help Post
        </h1>
        <p className="mt-2 text-slate-600">
          Have a question or need support? Post it here for the community to see
          and help.
        </p>
      </div>
      <div className="sb-surface-strong p-8 md:p-10">
        <form action={handleSubmit} className="flex flex-col gap-6">
          <div>
            <label className="sb-label">Title</label>
            <input
              type="text"
              name="title"
              placeholder="Enter a descriptive title"
              className="sb-input"
              required
            />
          </div>
          <div>
            <label className="sb-label">Category</label>
            <select name="category" className="sb-input" required>
              <option value="">Select a category</option>
              <option value="bug">Bug Report</option>
              <option value="feature">Feature Request</option>
              <option value="improvement">Site Improvement</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="sb-label">Subject</label>
            <input
              name="subject"
              placeholder="Short summary of your requirement..."
              className="sb-input"
              required
            />
          </div>
          <div>
            <label className="sb-label">Message</label>
            <textarea
              name="message"
              placeholder="Describe your issue or question in detail."
              className="sb-textarea"
              rows={8}
              required
            />
          </div>
          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button type="submit" className="sb-button-primary">
              Post
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
