import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

/**
 * Shared pager for the live response form and the builder preview.
 *
 * CRITICAL: the Next control and the Submit control MUST be two separately
 * keyed elements. If they are branches of a ternary that renders `<button>` at
 * the same position, React reuses one DOM node and rewrites its `type` from
 * "button" to "submit" in the same commit the user clicked Next. Browsers run a
 * button's activation behavior *after* dispatch and read the *current* type, so
 * the form would submit instead of advancing a page — the "Next submits early"
 * bug. Distinct keys force React to unmount/remount, so the clicked node is
 * detached (form owner null) and cannot trigger submission.
 */
export function SurveyPager({
  onBack,
  onNext,
  backDisabled = false,
  nextDisabled = false,
  nextLabel = "Next",
  submit = false,
  submitLabel = "Submit Response",
  submitting = false,
  children,
}: {
  onBack: () => void;
  onNext?: () => void;
  backDisabled?: boolean;
  nextDisabled?: boolean;
  nextLabel?: string;
  /** Render the trailing control as a real submit button (live form only). */
  submit?: boolean;
  submitLabel?: string;
  submitting?: boolean;
  /** Center slot, e.g. the "Question 2-4 of 9" range indicator. */
  children?: React.ReactNode;
}) {
  // Mobile: the range label goes on its own line above a Back / Next row, so
  // the three items can never overlap on a narrow card. From `sm` up there is
  // room for the original single row with the label centered between them.
  return (
    <div className="flex flex-wrap items-center gap-2 py-4 sm:flex-nowrap sm:gap-3">
      <button
        type="button"
        onClick={onBack}
        disabled={backDisabled}
        className="sb-button-soft order-2 inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs sm:order-none sm:gap-2 sm:px-5 sm:py-3 sm:text-sm"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>
      <div className="order-1 min-w-0 w-full text-center text-xs text-slate-500 dark:text-slate-400 sm:order-none sm:w-auto sm:flex-1 sm:text-sm">
        {children}
      </div>
      {submit ? (
        <button
          key="survey-pager-submit"
          type="submit"
          disabled={submitting}
          className="sb-button-accent order-3 inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs sm:order-none sm:flex-none sm:gap-2 sm:px-5 sm:py-3 sm:text-sm"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="animate-spin h-5 w-5" />
              Submitting...
            </span>
          ) : (
            submitLabel
          )}
        </button>
      ) : (
        <button
          key="survey-pager-next"
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="sb-button-accent order-3 inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs sm:order-none sm:flex-none sm:gap-2 sm:px-5 sm:py-3 sm:text-sm"
        >
          {nextLabel}
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
