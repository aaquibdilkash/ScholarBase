/**
 * One result banner for every workspace Server Action.
 *
 * Each workspace form previously carried its own copy of this markup, which
 * meant a success tone change had to be made five times. `success`/`message` is
 * the shape every action returns, so one component covers all of them.
 */
export function ActionResultMessage({
  state,
  className = "",
}: {
  state: { success: boolean; message: string };
  className?: string;
}) {
  if (!state.message) return null;

  return (
    <p
      role={state.success ? "status" : "alert"}
      className={`${className} rounded-lg border p-3 text-sm ${
        state.success
          ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-200"
          : "border-red-300 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-300"
      }`}
    >
      {state.message}
    </p>
  );
}
