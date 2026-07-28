import type { Metadata } from "next";
import Link from "next/link";
import ResearchToolForm from "@/components/research-tools/ResearchToolForm";

export const metadata: Metadata = {
  title: "Add Research Tool",
  description: "Add a research tool or software to help fellow researchers.",
  robots: { index: false, follow: true },
};

export default function NewResearchToolPage() {
  return (
    <main className="mx-auto max-w-4xl py-6">
      <div className="mb-8">
        <Link
          href="/research-tools"
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Back to Research Tools
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Add Research Tool
        </h1>
        <p className="mt-2 text-slate-600">
          Add a research tool or software to help fellow researchers.
        </p>
      </div>

      <ResearchToolForm mode="create" />
    </main>
  );
}