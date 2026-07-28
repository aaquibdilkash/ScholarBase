import type { Metadata } from "next";
import Link from "next/link";
import JournalForm from "@/components/journals/JournalForm";

export const metadata: Metadata = {
  title: "Add Journal",
  description: "Add an academic journal with its rankings and impact factor.",
  robots: { index: false, follow: true },
};

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
          Add Journal
        </h1>
        <p className="mt-2 text-slate-600">
          Add an academic journal with its rankings and impact factor.
        </p>
      </div>

      <JournalForm mode="create" />
    </main>
  );
}