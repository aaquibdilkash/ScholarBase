import Link from "next/link";
import AdmissionForm from "@/components/admissions/AdmissionForm";

export default function NewAdmissionPage() {
  return (
    <main className="mx-auto max-w-4xl py-6">
      <div className="mb-8">
        <Link
          href="/admissions"
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Back to Admissions
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Add PhD Admission Notification
        </h1>
        <p className="mt-2 text-slate-600">
          Share verified admission calls for the community.
        </p>
      </div>

      <AdmissionForm mode="create" />
    </main>
  );
}
