"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/Toast";
import { createOutreachContact } from "@/app/actions/outreach";
import { useFormDraft } from "@/hooks/useFormDraft";
import { Loader2, Mail, Plus, X } from "lucide-react";
import {
  OUTREACH_QUERY_KEY,
  addOutreachContactOptimistically,
  confirmOptimisticOutreachContact,
  createOptimisticOutreachId,
  outreachQueryKey,
  removeOutreachContactFromList,
  type OutreachListData,
} from "@/utils/outreach-cache";
import {
  EMPTY_OUTREACH_FIELDS,
  OutreachContactFields,
} from "@/components/admin/OutreachContactFields";

const EMPTY_FORM = EMPTY_OUTREACH_FIELDS;
const DRAFT_KEY = "admin-outreach-contact-draft-v1";

export function OutreachForm({ onCreated }: { onCreated?: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Drafts survive closing the modal, refreshing, or navigating away.
  const [formData, updateField, resetDraft, isRestored] = useFormDraft(
    DRAFT_KEY,
    EMPTY_FORM,
  );

  // A new contact sorts to the top of page 1, which is where the optimistic
  // insert belongs (and where the panel navigates after a successful add).
  const pageKey = outreachQueryKey(1);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || !isRestored) return;
    setSubmitting(true);

    const draft = { ...formData };
    const optimisticId = createOptimisticOutreachId();
    const previous = queryClient.getQueryData<OutreachListData>(pageKey);

    queryClient.setQueryData<OutreachListData>(pageKey, (old) =>
      addOutreachContactOptimistically(old, draft, optimisticId),
    );

    const rollback = () => {
      queryClient.setQueryData<OutreachListData>(pageKey, (old) =>
        previous ?? removeOutreachContactFromList(old, optimisticId),
      );
    };

    try {
      const result = await createOutreachContact(draft);

      if (!result.success) {
        rollback();
        toast(result.error, "error");
        return;
      }

      queryClient.setQueryData<OutreachListData>(pageKey, (old) =>
        confirmOptimisticOutreachContact(old, optimisticId, result.data.id),
      );
      toast("Contact added to your outreach list.", "success");
      resetDraft();
      setIsOpen(false);
      onCreated?.();
      void queryClient.invalidateQueries({ queryKey: OUTREACH_QUERY_KEY });
    } catch {
      rollback();
      toast("Failed to add contact. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="sb-button-primary w-full gap-2"
      >
        <Plus className="h-4 w-4" />
        Add Contact
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="relative max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Add Outreach Contact
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              The email address will be validated before it is added. If this
              address has already opted out, it cannot be added.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <OutreachContactFields
                values={formData}
                onChange={updateField}
                disabled={submitting}
                autoFocusName
              />

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={submitting}
                  className="sb-button-soft"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !isRestored}
                  className="sb-button-primary gap-2 disabled:opacity-60"
                >
                  {submitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Adding…
                    </span>
                  ) : (
                    <>
                      <Mail className="h-3.5 w-3.5" />
                      Add Contact
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
