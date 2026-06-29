"use client";

import { createSupervisor } from "@/app/actions/supervisors";
import Link from "next/link";

export default function AddSupervisorPage() {
  return (
    <main className="max-w-3xl mx-auto py-10 px-4">
      <div className="mb-8">
        <Link
          href="/supervisor"
          className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-blue-600 mb-6 transition-colors"
        >
          ← Back to Search
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Add a Supervisor
        </h1>
        <p className="text-slate-500 mt-2">
          Can't find a professor in the directory? Add their details below.
        </p>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-8 md:p-10">
        <form action={createSupervisor} className="flex flex-col gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Full Name
            </label>
            <input
              name="name"
              placeholder="e.g., Prof. Pankaj Kumar Gupta"
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all text-slate-900 placeholder:text-slate-400"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              University / Institution
            </label>
            <input
              name="university"
              placeholder="e.g., Jamia Millia Islamia"
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all text-slate-900 placeholder:text-slate-400"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Department (Optional)
            </label>
            <input
              name="department"
              placeholder="e.g., Management and Finance"
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-sm shadow-blue-600/20 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-600/30 transition-all duration-200"
            >
              Add Supervisor
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
