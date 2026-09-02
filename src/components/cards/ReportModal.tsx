"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Flag, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
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
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstOptionRef = useRef<HTMLInputElement>(null);

  // Lock body scroll when modal is open.
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      dialogRef.current?.showModal();
      firstOptionRef.current?.focus();
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleClose = () => {
    if (isPending) return;
    setSelectedReason("SPAM");
    setDetails("");
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;

    startTransition(async () => {
      try {
        const result = await submitReport(
          entityId,
          entityType,
          module,
          selectedReason,
          details,
        );

        if (result.success) {
          toast({
            title: "Report Submitted",
            description: "Thank you for helping keep ScholarBase safe.",
          });
          handleClose();
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to submit report.";
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
      }
    });
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="sb-surface-strong w-full max-w-lg rounded-2xl border border-slate-200 p-0 text-slate-900 dark:border-slate-800 dark:bg-slate-900"
    >
      <button
        type="button"
        onClick={handleClose}
        disabled={isPending}
        className="absolute top-3 right-3 rounded-lg p-1 text-slate-500 opacity-50 hover:opacity-100 hover:text-slate-700"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      <form onSubmit={handleSubmit} className="p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-300">
            <Flag className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Report Content
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Help us moderate content by reporting inappropriate material.
            </p>
          </div>
        </div>

        <fieldset className="mb-4 space-y-2">
          <legend className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Select a reason
          </legend>
          {REPORT_REASONS.map((reason, idx) => (
            <label
              key={reason.value}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <input
                ref={idx === 0 ? firstOptionRef : undefined}
                type="radio"
                name="reason"
                value={reason.value}
                checked={selectedReason === reason.value}
                onChange={() => setSelectedReason(reason.value)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-blue-600"
                disabled={isPending}
              />
              <div className="flex-1">
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">
                  {reason.label}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {reason.description}
                </span>
              </div>
            </label>
          ))}
        </fieldset>

        <div className="mb-6">
          <label
            htmlFor="report-details"
            className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Additional details (optional)
          </label>
          <textarea
            id="report-details"
            value={details}
            onChange={(e) =>
              setDetails(e.target.value.slice(0, MAX_REPORT_DETAILS))
            }
            placeholder="Provide any additional context that will help moderators..."
            rows={3}
            maxLength={MAX_REPORT_DETAILS}
            disabled={isPending}
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500"
          />
          <div className="mt-1 text-right text-xs text-slate-400 dark:text-slate-500">
            {details.length}/{MAX_REPORT_DETAILS}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={handleClose}
            disabled={isPending}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="sb-button-primary"
          >
            {isPending ? "Submitting..." : "Submit Report"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
