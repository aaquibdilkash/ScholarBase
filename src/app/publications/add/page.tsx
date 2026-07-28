import type { Metadata } from "next";
import Link from "next/link";
import PublicationForm from "@/components/publications/PublicationForm";

export const metadata: Metadata = {
  title: "Add Publication",
  description: "Add your research publication, paper, or academic work to your profile.",
  robots: { index: false, follow: true },
};

export default function NewPublicationPage() {
  return (
    <main className="mx-auto max-w-4xl py-6">
      <div className="mb-8">
        <Link
          href="/publications"
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Back to Publications
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Add Publication
        </h1>
        <p className="mt-2 text-slate-600">
          Add your research publication, paper, or academic work to your profile.
        </p>
      </div>

      <PublicationForm mode="create" />
    </main>
  );
}