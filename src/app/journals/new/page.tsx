import { createJournal } from "@/app/actions/journals";
import Link from "next/link";

export default function NewJournalPage() {
  return (
    <main className="mx-auto max-w-4xl py-6">
      <div className="mb-8">
        <Link
          href="/journals"
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Back to Journals
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Add a new Journal
        </h1>
        <p className="mt-2 text-slate-600">
          Contribute to the community by adding a new journal to the database.
        </p>
      </div>
      <form
        action={createJournal}
        className="sb-surface-strong flex flex-col gap-5 p-8 md:p-10"
      >
        <div>
          <label className="sb-label">Journal Name</label>
          <input
            name="name"
            placeholder="e.g., Journal of Financial Economics"
            className="sb-input"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="sb-label">ISSN</label>
            <input
              name="issn"
              placeholder="e.g., 0304-405X"
              className="sb-input"
            />
          </div>
          <div>
            <label className="sb-label">Impact Factor</label>
            <input
              name="impactFactor"
              placeholder="e.g., 5.467"
              className="sb-input"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="sb-label">Scopus</label>
            <input name="scopus" placeholder="e.g., Q1" className="sb-input" />
          </div>
          <div>
            <label className="sb-label">ABDC Category</label>
            <input
              name="abdcCategory"
              placeholder="e.g., A*"
              className="sb-input"
            />
          </div>
        </div>

        <div>
          <label className="sb-label">Publisher</label>
          <input
            name="publisher"
            placeholder="e.g., Elsevier"
            className="sb-input"
          />
        </div>

        <div>
          <label className="sb-label">Website</label>
          <input
            name="website"
            placeholder="https.www.sciencedirect.com/journal/journal-of-financial-economics"
            className="sb-input"
          />
        </div>

        <div>
          <label className="sb-label">About</label>
          <textarea
            name="about"
            placeholder="Briefly describe the journal and its focus..."
            className="sb-input h-32"
          />
        </div>

        <button type="submit" className="sb-button-accent mt-2 self-end">
          Add Journal
        </button>
      </form>
    </main>
  );
}
