import Link from "next/link";
import JournalForm from "@/components/journals/JournalForm";

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

      <JournalForm mode="create" />
    </main>
  );
}
