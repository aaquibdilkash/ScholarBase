import { Gift, Sparkles } from "lucide-react";

/**
 * Branded "Coming Soon" state for the Contributions feature.
 *
 * Shown while `isComingSoon` is true — ScholarBase does not yet have a way to
 * receive money, so every contribution surface renders this instead of the live
 * payment/UPI UI. Uses the shared `sb-card` surface and the platform's blue
 * accent, matching the rest of the ScholarBase theme in both light and dark.
 */
export function ComingSoon() {
  return (
    <main className="mx-auto w-full max-w-4xl py-6 sm:py-8">
      <div className="sb-card flex flex-col items-center gap-5 px-6 py-12 text-center sm:px-10 sm:py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition-colors dark:bg-blue-500/15 dark:text-blue-300 sm:h-20 sm:w-20">
          <Gift className="h-8 w-8 sm:h-10 sm:w-10" aria-hidden="true" />
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Coming Soon
        </span>

        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50 sm:text-3xl">
          Contributions are on the way
        </h1>

        <p className="max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base">
          We&apos;re setting up a safe, transparent way for you to support
          ScholarBase — one that keeps the servers running, the database humming,
          and development moving forward for the global research community.
        </p>

        <p className="max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base">
          Until the payment flow is live, this space stays quiet. No ads, no
          paywalls — just a community that believes good scholarship should
          float to the top. Thanks for your patience, and for being here.
        </p>

        <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
          Keep exploring — everything else on ScholarBase is up and running.
        </p>
      </div>
    </main>
  );
}

export default ComingSoon;
