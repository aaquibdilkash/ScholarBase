"use client";

import { createSupervisor } from "@/app/actions/supervisors";
import Link from "next/link";

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
        <form action={createSupervisor} className="flex flex-col gap-6">
          <div>
            <label className="sb-label">Full Name</label>
            <input
              name="name"
              placeholder="e.g., Prof. John Smith"
              className="sb-input"
              required
            />
          </div>

          <div>
            <label className="sb-label">University / Institution</label>
            <input
              name="university"
              placeholder="e.g., Jamia Millia Islamia"
              className="sb-input"
              required
            />
          </div>

          <div>
            <label className="sb-label">Department (Optional)</label>
            <input
              name="department"
              placeholder="e.g., Management and Finance"
              className="sb-input"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button type="submit" className="sb-button-accent">
              Add Supervisor
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
