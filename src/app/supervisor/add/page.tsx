import type { Metadata } from "next";
import Link from "next/link";
import SupervisorForm from "@/components/supervisor/SupervisorForm";

export const metadata: Metadata = {
  title: "Add Supervisor",
  description: "Add a PhD supervisor or mentor to help fellow researchers.",
  robots: { index: false, follow: true },
};

export default function NewSupervisorPage() {
  return (
    <main className="mx-auto max-w-4xl py-6">
      <div className="mb-8">
        <Link
          href="/supervisor"
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Back to Supervisors
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Add Supervisor
        </h1>
        <p className="mt-2 text-slate-600">
          Add a PhD supervisor or mentor to help fellow researchers.
        </p>
      </div>

      <SupervisorForm mode="create" />
    </main>
  );
}