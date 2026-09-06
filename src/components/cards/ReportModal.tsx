"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useAuthModal } from "@/components/interactions/AuthModal";
import { useUser } from "@/hooks/useUser";
import { submitReport } from "@/app/actions/reports";
import type {
  ReportEntityType,
  ReportModule,
  ReportReason,
} from "@/types/reports";
import { MAX_REPORT_DETAILS } from "@/lib/constants";

const REPORT_REASONS: {
  value: ReportReason;
  label: string;
  description: string;
}[] = [
  {
    value: "SPAM",
    label: "Spam or Unsolicited",
    description: "Advertisements, promotional content, or spam",
  },
  {
    value: "HARASSMENT",
    label: "Harassment or Bullying",
    description: "Targeted abuse, threats, or harassment",
  },
  {
    value: "PLAGIARISM",
    label: "Plagiarism",
    description: "Copied content without attribution",
  },
  {
    value: "MISINFORMATION",
    label: "Misinformation",
    description: "False or misleading information",
  },
  {
    value: "OFF_TOPIC",
    label: "Off-Topic",
    description: "Content that doesn't belong here",
  },
  {
    value: "COPYRIGHT",
    label: "Copyright Violation",
    description: "Unauthorized use of copyrighted material",
  },
  { value: "OTHER", label: "Other", description: "Something else" },
];

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityId: string;
  entityType: ReportEntityType;
  module: ReportModule;
}

export function ReportModal({
  isOpen,
  onClose,
  entityId,
  entityType,
  module,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<ReportReason>("SPAM");
  const [details, setDetails] = useState("");
  const [isPending, setIsPending] = useState(false);
  const { toast } = useToast();
  const { openAuthModal } = useAuthModal();
  const { user } = useUser();

  const handleClose = () => {
    if (isPending) return;
    setSelectedReason("SPAM");
    setDetails("");
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;
    if (!user) {
      openAuthModal();
      return;
    }

    setIsPending(true);
    submitReport(entityId, entityType, module, selectedReason, details)
      .then((result) => {
        if (result.success) {
          toast({
            title: "Report Submitted",
            description: "Thank you for helping keep ScholarBase safe.",
          });
          handleClose();
        } else {
          toast({
            title: "Report not submitted",
            description:
              result.message ?? "Something went wrong. Please try again.",
            variant: "destructive",
          });
        }
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Failed to submit report.";
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
      })
      .finally(() => setIsPending(false));
  };

  if (!isOpen) return null;

  return (
    // Scrollable overlay: when the dialog is taller than the viewport
    // (small screens / zoomed in), the overlay scrolls instead of clipping
    // the top/bottom (and the submit button) out of reach.
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="flex min-h-full items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isPending) handleClose();
        }}
      >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Report Content
          </h3>
          <button
            type="button"
            onClick={handleClose}
            disabled={isPending}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <span className="sr-only">Close</span>×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
              Reason for report
            </legend>
            {REPORT_REASONS.map((r) => (
              <label
                key={r.value}
                className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                  selectedReason === r.value
                    ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30"
                    : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                }`}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={r.value}
                  checked={selectedReason === r.value}
                  onChange={() => setSelectedReason(r.value)}
                  disabled={isPending}
                  className="mt-0.5 accent-red-600"
                />
                <span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {r.label}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {r.description}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="report-details"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              Additional details
            </label>
            <textarea
              id="report-details"
              value={details}
              onChange={(e) =>
                setDetails(e.target.value.slice(0, MAX_REPORT_DETAILS))
              }
              maxLength={MAX_REPORT_DETAILS}
              rows={3}
              placeholder="Provide any additional context that will help moderators..."
              disabled={isPending}
              className="resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <span className="text-right text-xs text-slate-400">
              {details.length}/{MAX_REPORT_DETAILS}
            </span>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isPending}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit Report
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}
