import type { Metadata } from "next";
import Link from "next/link";
import ResultForm from "@/components/results/ResultForm";

export const metadata: Metadata = {
  title: "Add Result Information",
  description: "Share exam results, admission outcomes, vacancy results, and other important notifications for the research community.",
  robots: { index: false, follow: true },
};

export default function NewResultPage() {
  return (
    <main className="mx-auto max-w-4xl py-6">
      <div className="mb-8">
        <Link
          href="/results"
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Back to Results
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Add Result Information
        </h1>
        <p className="mt-2 text-slate-600">
          Share exam results, admission outcomes, vacancy results, and other
          important notifications for the research community.
        </p>
      </div>

      <ResultForm mode="create" />
    </main>
  );
}
