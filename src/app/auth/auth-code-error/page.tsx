import type { Metadata } from "next";
import Link from "next/link";
import { buildNoindexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoindexMetadata(
  "Authentication - ScholarBase",
);

export default function AuthCodeError() {
  return (
    <main className="sb-auth-shell flex min-h-[calc(100dvh-2rem)] w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.18),_transparent_42%),linear-gradient(180deg,_#f8fafc_0%,_#eef2f7_48%,_#e2e8f0_100%)] p-4 sm:p-6 dark:bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.15),_transparent_40%),linear-gradient(180deg,_#020817_0%,_#0f172a_45%,_#020617_100%)]">
      <section className="relative w-full max-w-xl overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/80 backdrop-blur-sm sm:p-8 dark:border-slate-700 dark:bg-slate-900/85 dark:shadow-[0_30px_80px_rgba(2,6,23,0.55)] dark:ring-slate-700/80">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-600 dark:text-amber-300">
            Authentication
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Authentication Error
          </h1>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            There was a problem authenticating your request.
          </p>
        </div>

        <div className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/90 p-5 text-center text-sm leading-6 text-slate-700 shadow-inner shadow-slate-200/40 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:shadow-slate-950/30">
          <p>
            The link you used may have expired, already been used, or come from a
            different sign-in flow.
          </p>
          <p>
            Please request a fresh link from the relevant form and try again.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800 dark:focus-visible:ring-slate-600 dark:focus-visible:ring-offset-slate-900"
          >
            Back to sign in
          </Link>
          <Link
            href="/auth/update-password"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white/80 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus-visible:ring-slate-600 dark:focus-visible:ring-offset-slate-900"
          >
            Request a reset link
          </Link>
        </div>
      </section>
    </main>
  );
}
