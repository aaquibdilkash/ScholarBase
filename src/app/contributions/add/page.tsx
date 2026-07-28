import type { Metadata } from "next";
import Link from "next/link";
import ContributionForm from "@/components/contributions/ContributionForm";

export const metadata: Metadata = {
  title: "Make a Contribution",
  description: "Support ScholarBase development by making a contribution.",
  robots: { index: false, follow: true },
};

export default function NewContributionPage() {
  return (
    <main className="mx-auto max-w-4xl py-6">
      <div className="mb-8">
        <Link
          href="/contributions"
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Back to Contributions
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Make a Contribution
        </h1>
        <p className="mt-2 text-slate-600">
          Support ScholarBase development by making a contribution.
        </p>
      </div>

      <ContributionForm mode="create" />
    </main>
  );
}