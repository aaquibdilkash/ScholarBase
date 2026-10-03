import type { Metadata } from "next";
import Link from "next/link";
import { buildNoindexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoindexMetadata(
  "Authentication - ScholarBase",
);

export default function AuthCodeError() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-slate-950">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-300">
            Authentication
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Authentication Error
          </h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            There was a problem authenticating your request.
          </p>
        </div>

        <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
          <p>
            The link you used may have expired, already been used, or come from
            a different sign-in flow.
          </p>
          <p>
            Please request a fresh link from the relevant form and try again.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            Back to sign in
          </Link>
          <Link
            href="/auth/update-password"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Request a reset link
          </Link>
        </div>
      </section>
    </main>
  );
}
