"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { deleteAccount } from "@/app/actions/account";
import { ACCOUNT_RECOVERY_DAYS } from "@/lib/constants";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";

export function DeleteAccountForm() {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsModalOpen(true);
  }

  async function confirmDelete() {
    setSubmitting(true);

    try {
      const form = document.getElementById(
        "delete-account-form",
      ) as HTMLFormElement | null;
      if (!form) {
        setError("We could not confirm account deletion. Please try again.");
        return;
      }

      const result = await deleteAccount(new FormData(form));
      if (result.success) {
        setIsModalOpen(false);
        router.replace("/login?error=account-deleted");
        router.refresh();
        return;
      }
      setIsModalOpen(false);
      setError(result.error);
    } catch {
      setIsModalOpen(false);
      setError("We could not delete your account. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-6 border-t border-red-200/70 pt-6 dark:border-red-900/50">
      <h3 className="text-base font-semibold text-red-700 dark:text-red-300">
        Delete account
      </h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Your account will be disabled and hidden. Your existing contributions
        may remain as historical records. You have {ACCOUNT_RECOVERY_DAYS} days
        to recover it by signing in; after that, recovery expires and the
        account can be permanently deleted.
      </p>
      <form
        id="delete-account-form"
        onSubmit={handleSubmit}
        className="mt-4 space-y-3"
      >
        <label
          className="block text-xs font-semibold text-slate-600 dark:text-slate-300"
          htmlFor="delete-account-confirmation"
        >
          Type DELETE to confirm
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input
            id="delete-account-confirmation"
            name="confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="sb-input px-3 py-2 sm:max-w-xs"
            autoComplete="off"
            maxLength={6}
            required
          />
          <button
            type="submit"
            disabled={submitting || confirmation !== "DELETE"}
            className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-red-300 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto dark:border-red-700 dark:bg-red-700 dark:hover:bg-red-600"
          >
            {submitting ? "Deleting..." : "Delete account"}
          </button>
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
      </form>
      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => !submitting && setIsModalOpen(false)}
        onConfirm={confirmDelete}
        title="Confirm account deletion"
        message={`Your account will be hidden now. You can recover it by signing in within ${ACCOUNT_RECOVERY_DAYS} days. After ${ACCOUNT_RECOVERY_DAYS} days, recovery expires and the account can be permanently deleted. Continue?`}
        isConfirming={submitting}
        confirmLabel="Delete account"
        confirmingLabel="Deleting..."
      />
    </section>
  );
}
