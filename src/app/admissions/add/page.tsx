import type { Metadata } from "next";
import Link from "next/link";
import AdmissionForm from "@/components/admissions/AdmissionForm";

export const metadata: Metadata = {
  title: "Post PhD Admission Notification",
  description: "Share PhD admissions, call for applications, and academic intake notifications with researchers.",
  robots: { index: false, follow: true },
};

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
          Post PhD Admission Notification
        </h1>
        <p className="mt-2 text-slate-600">
          Share PhD admissions, call for applications, and academic intake notifications.
        </p>
      </div>

      <AdmissionForm mode="create" />
    </main>
  );
}