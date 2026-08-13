import Link from "next/link";

export default function EmailConfirmedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4 sm:p-6">
      <section className="sb-surface w-full max-w-md space-y-6 p-8 text-center md:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
          ✓
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-300">
            Email confirmed
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            Your account is ready
          </h1>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Your email has been verified successfully. You can now continue to
            ScholarBase with your new account.
          </p>
        </div>
        <Link href="/" className="sb-button-primary w-full">
          Continue to ScholarBase
        </Link>
      </section>
    </main>
  );
}
