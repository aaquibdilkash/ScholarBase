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
  return (
    <div className="flex justify-between pt-4">
      <button
        type="button"
        onClick={onBack}
        disabled={backDisabled}
        className="sb-button-soft inline-flex items-center gap-2"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>
      <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
        {children}
      </div>
      {submit ? (
        <button
          key="survey-pager-submit"
          type="submit"
          disabled={submitting}
          className="sb-button-accent inline-flex items-center gap-2"
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
          className="sb-button-accent inline-flex items-center gap-2"
        >
          {nextLabel}
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
