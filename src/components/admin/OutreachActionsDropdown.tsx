"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Mail,
  MailCheck,
  MailX,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import {
  OutreachContactFields,
  type OutreachContactFieldValues,
} from "@/components/admin/OutreachContactFields";
import {
  deleteOutreachContact,
  markOutreachStatus,
  resubscribeOutreachContact,
  sendOutreachEmail,
  updateOutreachContact,
  type OutreachContactItem,
} from "@/app/actions/outreach";
import {
  OUTREACH_QUERY_KEY,
  isOptimisticOutreachId,
  outreachQueryKey,
  patchOutreachContactInList,
  removeOutreachContactFromList,
  type OutreachListData,
} from "@/utils/outreach-cache";

type OutreachStatus =
  | "PENDING"
  | "OUTREACHED"
  | "BOUNCED"
  | "REPLIED"
  | "UNSUBSCRIBED";

function toFieldValues(item: OutreachContactItem): OutreachContactFieldValues {
  return {
    name: item.name,
    email: item.email,
    institution: item.institution ?? "",
    role: item.role ?? "",
    source: item.source ?? "",
    notes: item.notes ?? "",
  };
}

export function OutreachActionsDropdown({
  contact,
  page,
}: {
  contact: OutreachContactItem;
  /** Current list page — optimistic patches target exactly that cache entry. */
  page: number;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(
    null,
  );
  const [confirmAction, setConfirmAction] = useState<
    "resend" | "subscribe" | "unsubscribe" | "delete" | null
  >(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editValues, setEditValues] = useState<OutreachContactFieldValues>(() =>
    toFieldValues(contact),
  );

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const pageKey = outreachQueryKey(page);

  const snapshot = () =>
    queryClient.getQueryData<OutreachListData>(pageKey);

  const restore = (previous: OutreachListData | undefined) => {
    queryClient.setQueryData<OutreachListData>(pageKey, previous);
  };

  const sendMutation = useMutation({
    mutationFn: async (resend: boolean) => {
      const result = await sendOutreachEmail({
        contactId: contact.id,
        resend,
      });
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: pageKey });
      const previous = snapshot();
      const now = new Date();

      queryClient.setQueryData<OutreachListData>(pageKey, (old) =>
        patchOutreachContactInList(old, contact.id, {
          status: "OUTREACHED",
          sendCount: contact.sendCount + 1,
          emailSentAt: now,
          outreachedAt: now,
        }),
      );

      return { previous };
    },
    onSuccess: (_data, resend) => {
      toast(
        resend
          ? "Email resent — contact marked as outreached."
          : "Email sent — contact marked as outreached.",
        "success",
      );
      void queryClient.invalidateQueries({ queryKey: OUTREACH_QUERY_KEY });
    },
    onError: (error: Error, _resend, context) => {
      restore(context?.previous);
      toast(error.message || "Failed to send email. Please try again.", "error");
    },
    onSettled: () => {
      setConfirmAction(null);
    },
  });

  const optOutMutation = useMutation({
    mutationFn: async () => {
      const result = await markOutreachStatus({
        contactId: contact.id,
        status: "UNSUBSCRIBED",
      });
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: pageKey });
      const previous = snapshot();

      queryClient.setQueryData<OutreachListData>(pageKey, (old) =>
        patchOutreachContactInList(old, contact.id, {
          status: "UNSUBSCRIBED",
        }),
      );

      return { previous };
    },
    onSuccess: () => {
      toast("Contact marked as unsubscribed.", "success");
      void queryClient.invalidateQueries({ queryKey: OUTREACH_QUERY_KEY });
    },
    onError: (error: Error, _variables, context) => {
      restore(context?.previous);
      toast(error.message || "Failed to update contact.", "error");
    },
    onSettled: () => {
      setConfirmAction(null);
    },
  });

  const resubscribeMutation = useMutation({
    mutationFn: async () => {
      const result = await resubscribeOutreachContact({ contactId: contact.id });
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: pageKey });
      const previous = snapshot();

      queryClient.setQueryData<OutreachListData>(pageKey, (old) =>
        patchOutreachContactInList(old, contact.id, {
          // A contact that was already emailed stays OUTREACHED; only a never
          // contacted one returns to PENDING.
          status: contact.sendCount > 0 ? "OUTREACHED" : "PENDING",
        }),
      );

      return { previous };
    },
    onSuccess: () => {
      toast("Contact is subscribed again.", "success");
      void queryClient.invalidateQueries({ queryKey: OUTREACH_QUERY_KEY });
    },
    onError: (error: Error, _variables, context) => {
      // The recipient's own unsubscribe wins; the row snaps back to
      // UNSUBSCRIBED and the server's explanation is shown.
      restore(context?.previous);
      toast(error.message || "Failed to update contact.", "error");
    },
    onSettled: () => {
      setConfirmAction(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const result = await deleteOutreachContact({ contactId: contact.id });
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: pageKey });
      const previous = snapshot();

      queryClient.setQueryData<OutreachListData>(pageKey, (old) =>
        removeOutreachContactFromList(old, contact.id),
      );

      return { previous };
    },
    onSuccess: () => {
      toast("Contact removed.", "success");
      void queryClient.invalidateQueries({ queryKey: OUTREACH_QUERY_KEY });
    },
    onError: (error: Error, _variables, context) => {
      restore(context?.previous);
      toast(error.message || "Failed to remove contact.", "error");
    },
    onSettled: () => {
      setConfirmAction(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: OutreachContactFieldValues) => {
      const result = await updateOutreachContact({
        contactId: contact.id,
        ...values,
      });
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: pageKey });
      const previous = snapshot();

      queryClient.setQueryData<OutreachListData>(pageKey, (old) =>
        patchOutreachContactInList(old, contact.id, {
          name: values.name,
          email: values.email.trim().toLowerCase(),
          institution: values.institution || null,
          role: values.role || null,
          source: values.source || null,
          notes: values.notes || null,
        }),
      );

      return { previous };
    },
    onSuccess: () => {
      toast("Contact updated.", "success");
      setEditOpen(false);
      void queryClient.invalidateQueries({ queryKey: OUTREACH_QUERY_KEY });
    },
    onError: (error: Error, _values, context) => {
      restore(context?.previous);
      toast(error.message || "Failed to update contact.", "error");
    },
  });

  const isPending =
    sendMutation.isPending ||
    optOutMutation.isPending ||
    resubscribeMutation.isPending ||
    deleteMutation.isPending ||
    updateMutation.isPending;

  useEffect(() => {
    if (!open) return;

    const onDocMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (btnRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    const onScrollOrResize = () => setOpen(false);

    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  const status = contact.status as OutreachStatus;
  // Imported contacts may have no name; fall back to the address so menus and
  // confirmations never read " (email)" or "Actions for ".
  const contactLabel = contact.name
    ? `${contact.name} (${contact.email})`
    : contact.email;
  const canSend = status === "PENDING";
  const canResend = status !== "PENDING" && status !== "UNSUBSCRIBED";
  const canOptOut = status !== "UNSUBSCRIBED";
  const canResubscribe = status === "UNSUBSCRIBED";

  const openEdit = () => {
    setEditValues(toFieldValues(contact));
    setOpen(false);
    setEditOpen(true);
  };

  const submitEdit = (event: React.FormEvent) => {
    event.preventDefault();
    if (updateMutation.isPending) return;
    updateMutation.mutate(editValues);
  };

  const confirmations: Record<
    NonNullable<typeof confirmAction>,
    {
      title: string;
      message: string;
      confirmLabel: string;
      confirmingLabel: string;
      confirmVariant: "default" | "destructive";
    }
  > = {
    resend: {
      title: "Resend outreach email?",
      message: `Another email will be sent to ${contactLabel}, using the next template in the rotation.`,
      confirmLabel: "Resend email",
      confirmingLabel: "Sending…",
      confirmVariant: "default",
    },
    subscribe: {
      title: "Mark contact as subscribed?",
      message: `${contactLabel} will be able to receive outreach emails from this list again.`,
      confirmLabel: "Mark as subscribed",
      confirmingLabel: "Updating…",
      confirmVariant: "default",
    },
    unsubscribe: {
      title: "Mark contact as unsubscribed?",
      message: `This stops future outreach emails to ${contactLabel} from this list. It does not change the recipient's own unsubscribe preference.`,
      confirmLabel: "Mark unsubscribed",
      confirmingLabel: "Updating…",
      confirmVariant: "default",
    },
    delete: {
      title: "Remove outreach contact?",
      message: `This will delete ${contactLabel} from your outreach list. This cannot be undone.`,
      confirmLabel: "Delete contact",
      confirmingLabel: "Deleting…",
      confirmVariant: "destructive",
    },
  };

  const confirmation = confirmAction ? confirmations[confirmAction] : null;

  const isConfirming =
    confirmAction === "resend"
      ? sendMutation.isPending
      : confirmAction === "subscribe"
        ? resubscribeMutation.isPending
        : confirmAction === "unsubscribe"
          ? optOutMutation.isPending
          : confirmAction === "delete"
            ? deleteMutation.isPending
            : false;

  const handleConfirm = () => {
    switch (confirmAction) {
      case "resend":
        sendMutation.mutate(true);
        break;
      case "subscribe":
        resubscribeMutation.mutate();
        break;
      case "unsubscribe":
        optOutMutation.mutate();
        break;
      case "delete":
        deleteMutation.mutate();
        break;
      default:
        break;
    }
  };

  return (
    <>
      <div className="relative">
        <button
          ref={btnRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={isPending || isOptimisticOutreachId(contact.id)}
          onClick={() => {
            const rect = btnRef.current?.getBoundingClientRect();
            if (rect) {
              setMenuPos({
                top: rect.bottom + 6,
                right: Math.max(8, window.innerWidth - rect.right),
              });
            }
            setOpen((value) => !value);
          }}
          className="sb-menu-trigger"
          aria-label={`Actions for ${contact.name || contact.email}`}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
        </button>

        {open &&
          menuPos &&
          createPortal(
            <div
              ref={menuRef}
              role="menu"
              className="sb-menu fixed z-menu w-48"
              style={{ top: menuPos.top, right: menuPos.right }}
            >
              {canSend && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    sendMutation.mutate(false);
                  }}
                  className="sb-menu-item flex items-center gap-2"
                >
                  <Mail className="h-4 w-4" />
                  <span>Send email</span>
                </button>
              )}

              {canResend && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    setConfirmAction("resend");
                  }}
                  className="sb-menu-item flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Resend email</span>
                </button>
              )}

              <button
                type="button"
                role="menuitem"
                onClick={openEdit}
                className="sb-menu-item flex items-center gap-2"
              >
                <Pencil className="h-4 w-4" />
                <span>Edit contact</span>
              </button>

              {canResubscribe && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    setConfirmAction("subscribe");
                  }}
                  className="sb-menu-item flex items-center gap-2"
                >
                  <MailCheck className="h-4 w-4" />
                  <span>Mark as subscribed</span>
                </button>
              )}

              {canOptOut && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    setConfirmAction("unsubscribe");
                  }}
                  className="sb-menu-item flex items-center gap-2"
                >
                  <MailX className="h-4 w-4" />
                  <span>Mark unsubscribed</span>
                </button>
              )}

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  setConfirmAction("delete");
                }}
                className="sb-menu-item flex items-center gap-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-400/10"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete contact</span>
              </button>
            </div>,
            document.body,
          )}
      </div>

      {editOpen && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!updateMutation.isPending) setEditOpen(false);
          }}
        >
          <div
            className="relative max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Edit Outreach Contact
              </h2>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                aria-label="Close"
                disabled={updateMutation.isPending}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={submitEdit} className="space-y-4">
              <OutreachContactFields
                values={editValues}
                onChange={(field, value) =>
                  setEditValues((current) => ({ ...current, [field]: value }))
                }
                disabled={updateMutation.isPending}
                autoFocusName
              />

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  disabled={updateMutation.isPending}
                  className="sb-button-soft"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="sb-button-primary gap-2 disabled:opacity-60"
                >
                  {updateMutation.isPending ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving…
                    </span>
                  ) : (
                    "Save changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmation && (
        <ConfirmationModal
          isOpen
          onClose={() => {
            if (!isConfirming) setConfirmAction(null);
          }}
          onConfirm={handleConfirm}
          title={confirmation.title}
          message={confirmation.message}
          isConfirming={isConfirming}
          confirmLabel={confirmation.confirmLabel}
          confirmingLabel={confirmation.confirmingLabel}
          confirmVariant={confirmation.confirmVariant}
        />
      )}
    </>
  );
}
