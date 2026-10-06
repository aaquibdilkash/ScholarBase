"use client";

import { useState } from "react";
import { requestEmailChange, verifyEmailChangeOtp } from "@/app/actions/auth";
import { OtpInput } from "@/components/auth/OtpInput";
import { useToast } from "@/components/ui/Toast";
import { MAX_AUTH_EMAIL } from "@/lib/constants";

export function UpdateEmailForm({
  currentEmail,
  onEmailUpdated,
}: {
  currentEmail: string;
  onEmailUpdated?: (newEmail: string) => void;
}) {
  const { toast } = useToast();
  const [displayEmail, setDisplayEmail] = useState(currentEmail);
  const [email, setEmail] = useState("");
  const [pendingNewEmail, setPendingNewEmail] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);
    setOtpError(null);

    try {
      const result = await requestEmailChange(new FormData(event.currentTarget));
      if (result.success) {
        setPendingNewEmail(result.newEmail);
        setMessage(result.message);
        setEmail("");
        toast(result.message, "success");
      } else {
        setError(result.error);
        toast(result.error, "error");
      }
    } catch {
      setError("We could not start the email change. Please try again later.");
      toast("We could not start the email change. Please try again later.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(code: string) {
    if (!pendingNewEmail || verifying) return;
    setVerifying(true);
    setOtpError(null);
    try {
      const result = await verifyEmailChangeOtp(pendingNewEmail, code);
      if (result.success) {
        const confirmedEmail = pendingNewEmail;
        setPendingNewEmail(null);
        setDisplayEmail(confirmedEmail);
        onEmailUpdated?.(confirmedEmail);
        const successMessage = result.message ?? "Primary email updated successfully.";
        setMessage(successMessage);
        toast(successMessage, "success");
      } else {
        setOtpError(result.error);
        toast(result.error, "error");
      }
    } catch {
      setOtpError("Could not verify the code. Please try again.");
      toast("Could not verify the code. Please try again.", "error");
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    if (!pendingNewEmail) return;
    setOtpError(null);
    const formData = new FormData();
    formData.append("email", pendingNewEmail);
    const result = await requestEmailChange(formData);
    if (result.success) {
      setMessage(result.message);
      toast(result.message, "success");
    } else {
      setOtpError(result.error);
      toast(result.error, "error");
    }
  }

  return (
    <div className="mt-5 space-y-3 border-t border-slate-200/70 pt-5 dark:border-slate-800">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="sb-label" htmlFor="primary-email">
              Primary email
            </label>
            <p className="text-sm text-slate-500 dark:text-slate-400">Current: {displayEmail}</p>
            <input
              id="primary-email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="sb-input mt-2 px-3 py-2 sm:px-3 sm:py-2"
              placeholder="new-email@example.com"
              maxLength={MAX_AUTH_EMAIL}
              required
            />
          </div>
          <button
            type="submit"
            className="sb-button-primary w-full shrink-0 sm:w-auto"
            disabled={submitting || email.trim().length === 0}
          >
            {submitting ? "Sending..." : "Update email"}
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Only approved consumer or institutional domains can become your primary email.
          We will send a 6-digit code to the new address to confirm the change.
        </p>
        {message && !pendingNewEmail && (
          <p className="text-sm text-emerald-600" role="status">{message}</p>
        )}
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      </form>

      {pendingNewEmail && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <OtpInput
            email={pendingNewEmail}
            title="Enter the code"
            subtitle="sent to"
            submitLabel="Verify & Update Email"
            verifyingLabel="Verifying..."
            backLabel="← Use a different email"
            busy={verifying}
            error={otpError}
            onVerify={handleVerify}
            onResend={handleResend}
            onBack={() => {
              setPendingNewEmail(null);
              setOtpError(null);
            }}
          />
          {message && (
            <p className="mt-2 text-center text-xs text-emerald-600" role="status">{message}</p>
          )}
        </div>
      )}
    </div>
  );
}

