import type { Metadata } from "next";
import Link from "next/link";
import SurveyForm from "@/components/surveys/SurveyForm";

export const metadata: Metadata = {
  title: "Create Survey",
  description: "Create a new survey to collect responses from the academic community.",
  robots: { index: false, follow: true },
};

export default function NewSurveyPage() {
  return (
    <main className="mx-auto max-w-4xl py-6">
      <div className="mb-8">
        <Link
          href="/surveys"
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Back to Surveys
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Create Survey
        </h1>
        <p className="mt-2 text-slate-600">
          Create a new survey to collect responses from the academic community.
        </p>
      </div>

      <SurveyForm mode="create" />
    </main>
  );
}