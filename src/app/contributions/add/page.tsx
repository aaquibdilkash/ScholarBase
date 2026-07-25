import Link from "next/link";
import ContributionForm from "@/components/contributions/ContributionForm";

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
          Support ScholarBase
        </h1>
        <p className="mt-2 text-slate-600">
          Your contributions help maintain the server, database, and development
          costs. Every contribution makes a difference!
        </p>
      </div>

      <ContributionForm mode="create" />
    </main>
  );
}
