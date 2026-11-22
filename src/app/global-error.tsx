"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="en">
      <body className="bg-slate-950 text-white">
        <main className="flex min-h-screen items-center justify-center px-6 py-16">
          <section className="w-full max-w-lg text-center">
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="mt-3 text-sm text-slate-300">
              Please try again. The error has been reported automatically.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="mt-6 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200"
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
