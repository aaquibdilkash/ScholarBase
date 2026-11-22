"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          Please try again. If the problem continues, it has been reported automatically.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
