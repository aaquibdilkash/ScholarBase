import Link from "next/link";
import SupervisorForm from "@/app/supervisor/components/SupervisorForm";

export default function AddSupervisorPage() {
  return (
    <main className="mx-auto max-w-4xl py-6">
      <div className="mb-8">
        <Link
          href="/supervisor"
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Back to Search
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Add a Supervisor
        </h1>
        <p className="mt-2 text-slate-600">
          Can&apos;t find a professor in the directory? Add their details below.
        </p>
      </div>

      <div className="sb-surface-strong p-8 md:p-10">
        <SupervisorForm mode="create" />
      </div>
    </main>
  );
}
