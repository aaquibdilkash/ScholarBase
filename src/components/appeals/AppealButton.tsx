"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { HelpCircle, Loader2 } from "lucide-react";
import { submitAppeal } from "@/app/actions/appeals";
import { useToast } from "@/components/ui/Toast";
import { MAX_APPEAL_REASON, APPEAL_CATEGORIES } from "@/lib/constants";

interface AppealButtonProps {
  entityId: string;
  module: string;
  entityType: "POST" | "COMMENT";
  hasActiveAppeal: boolean;
  path?: string;
}

export function AppealButton({
  entityId,
  module,
  entityType,
  hasActiveAppeal: initialHasActiveAppeal,
  path,
}: AppealButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>(
    APPEAL_CATEGORIES[0].value,
  );
  const [details, setDetails] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      submitAppeal({
        entityId,
        module,
        entityType,
        reasonCategory: selectedReason,
        details,
        path,
      }),
    onMutate: () => {
      queryClient.setQueriesData(
        { queryKey: ["appeal", entityId] },
        { hasActiveAppeal: true },
      );
    },
    onSuccess: () => {
      toast({
        title: "Appeal Submitted",
        description:
          "Your appeal has been sent to moderators. They will review it shortly.",
      });
      setIsModalOpen(false);
      setDetails("");
      setSelectedReason(APPEAL_CATEGORIES[0].value);
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Failed to submit appeal.";
      toast({ title: "Error", description: message, variant: "destructive" });
    },
  });

  if (initialHasActiveAppeal || mutation.isSuccess || mutation.isPending) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <HelpCircle className="h-3.5 w-3.5" />
        Appeal Pending Review
      </span>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (details.trim().length === 0 || mutation.isPending) return;
    mutation.mutate();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:bg-amber-950/60"
      >
        <HelpCircle className="h-3.5 w-3.5" />
        Appeal Removal
      </button>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !mutation.isPending)
              setIsModalOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Appeal Moderation
              </h3>
              <button
                type="button"
                onClick={() => !mutation.isPending && setIsModalOpen(false)}
                disabled={mutation.isPending}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <span className="sr-only">Close</span>×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Reason for appeal
                </legend>
                {APPEAL_CATEGORIES.map((r) => (
                  <label
                    key={r.value}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                      selectedReason === r.value
                        ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30"
                        : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    }`}
                  >
                    <input
                      type="radio"
                      name="appeal-reason"
                      value={r.value}
                      checked={selectedReason === r.value}
                      onChange={() => setSelectedReason(r.value)}
                      className="mt-0.5 accent-amber-600"
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
                  htmlFor="appeal-details"
                  className="text-sm font-semibold text-slate-700 dark:text-slate-300"
                >
                  Additional details
                </label>
                <textarea
                  id="appeal-details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  maxLength={MAX_APPEAL_REASON}
                  rows={3}
                  placeholder="Explain why you believe this moderation action should be reviewed..."
                  className="resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
                <span className="text-right text-xs text-slate-400">
                  {details.length}/{MAX_APPEAL_REASON}
                </span>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={mutation.isPending}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={mutation.isPending || details.trim().length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {mutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Submit Appeal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
