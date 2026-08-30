"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { HelpCircle, Send, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { appealContent } from "@/app/actions/reports";
import type { ReportModule } from "@/types/reports";

interface AppealModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityId: string;
  module: ReportModule;
  /** Called after a successful appeal so the caller can hide the button locally. */
  onAppealed?: () => void;
}

const MAX_APPEAL_LENGTH = 1000;

export function AppealModal({
  isOpen,
  onClose,
  entityId,
  module,
  onAppealed,
}: AppealModalProps) {
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      dialogRef.current?.showModal();
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleClose = () => {
    if (isPending) return;
    setText("");
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending || text.trim().length === 0) return;

    startTransition(async () => {
      try {
        const result = await appealContent(module, entityId, text);
        if (result.success) {
          toast({
            title: "Appeal Submitted",
            description:
              "Your appeal has been sent to moderators. They will review it shortly.",
          });
          onAppealed?.();
          handleClose();
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to submit appeal.";
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
        className="absolute top-3 right-3 rounded-lg p-1 text-slate-500 opacity-60 transition hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </button>

      <div className="p-6">
        <div className="mb-4 flex items-start gap-3">
          <HelpCircle className="mt-0.5 h-6 w-6 text-blue-600 dark:text-blue-400" />
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Appeal Moderation Decision
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Explain why you believe this content should be restored. Our
              moderation team will review your appeal and respond via email.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <textarea
            value={text}
            onChange={(e) =>
              setText(e.target.value.slice(0, MAX_APPEAL_LENGTH))
            }
            placeholder="Why should this content be un-frozen / restored? Be specific and include any supporting context..."
            rows={4}
            maxLength={MAX_APPEAL_LENGTH}
            disabled={isPending}
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500"
          />
          <div className="mt-1 text-right text-xs text-slate-400 dark:text-slate-500">
            {text.length}/{MAX_APPEAL_LENGTH}
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
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
              disabled={isPending || text.trim().length === 0}
              className="sb-button-primary flex items-center gap-2"
            >
              {isPending ? (
                <>Sending…</>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit Appeal
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
