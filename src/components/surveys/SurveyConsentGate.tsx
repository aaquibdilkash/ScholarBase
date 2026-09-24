import { ShieldCheck } from "lucide-react";

/**
 * IRB informed-consent gate shown as the first page when a survey requires
 * consent. Shared by the live response form and the builder preview.
 */
export function SurveyConsentGate({
  consentText,
  consented,
  consentError = false,
  onChange,
}: {
  consentText?: string | null;
  consented: boolean;
  consentError?: boolean;
  onChange: (consented: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6 dark:border-indigo-500/30 dark:bg-indigo-500/10">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-200">
          Informed Consent
        </h3>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-indigo-800 dark:text-indigo-300">
        {consentText ||
          "By participating, you agree that your responses may be used for research purposes."}
      </p>
      <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-indigo-300 bg-white p-4 dark:border-indigo-500/40 dark:bg-slate-800/50">
        <input
          type="checkbox"
          checked={consented}
          onChange={(e) => onChange(e.target.checked)}
          className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          I have read and accept the terms above.
        </span>
      </label>
      {consentError && (
        <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
          You must accept the consent terms to continue.
        </p>
      )}
    </div>
  );
}
