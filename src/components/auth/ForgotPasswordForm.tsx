"use client";

import { useState } from "react";
import { forgotPassword, verifyRecoveryOtp } from "@/app/actions/auth";
import { OtpInput } from "@/components/auth/OtpInput";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { SubmitBtn } from "@/components/ui/SubmitBtn";
import { AUTH_EMAIL_TIP } from "@/constants/tooltips";
import { MAX_AUTH_EMAIL } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

type RecoveryStep = "email" | "otp";

export function ForgotPasswordForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<RecoveryStep>("email");
  const [error, setError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  async function handleSendCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError(null);
    setOtpError(null);
    try {
      const result = await forgotPassword(new FormData(event.currentTarget));
      if (!result.success) {
        setError(result.error ?? "Failed to send recovery code.");
        return;
      }
      if (result.email) setEmail(result.email);
      // Tag the URL (without remounting) so /login keeps rendering during
      // the recovery session. router.replace would reset the step state.
      window.history.replaceState(null, "", "/login?flow=recovery");
      setStep("otp");
      toast("Recovery code sent. Check your email.", "success");
    } catch {
      setError("Failed to send recovery code.");
    } finally {
      setSending(false);
    }
  }

  async function handleVerify(code: string) {
    if (verifying) return;
    setVerifying(true);
    setOtpError(null);
    try {
      const result = await verifyRecoveryOtp(email, code);
      if (!result.success) {
        setOtpError(result.error ?? "Invalid or expired recovery code.");
        return;
      }
      toast("Code verified. Choose a new password.", "success");
      // /auth/update-password owns the recovery session for the new password.
      // Push immediately so no stale inline form flashes underneath.
      router.push("/auth/update-password");
    } catch {
      setOtpError("Could not verify the code. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    const formData = new FormData();
    formData.append("email", email);
    formData.append("callbackUrl", callbackUrl);
    setOtpError(null);
    const result = await forgotPassword(formData);
    if (!result.success) setOtpError(result.error ?? "Failed to resend code.");
  }

  if (step === "otp") {
    return (
      <div className="flex flex-col gap-4">
        <OtpInput
          email={email}
          title="Enter the code"
          subtitle="sent to"
          submitLabel="Verify Code"
          verifyingLabel="Verifying..."
          backLabel="← Use a different email"
          busy={verifying}
          error={otpError}
          onVerify={handleVerify}
          onResend={handleResend}
          onBack={() => {
            setStep("email");
            setOtpError(null);
          }}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSendCode} className="flex flex-col gap-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <div>
        <label className="sb-label inline-flex items-center gap-1.5" htmlFor="email-forgot">
          Email
          <InfoTooltip message={AUTH_EMAIL_TIP} />
        </label>
        <input
          className="sb-input"
          id="email-forgot"
          name="email"
          type="email"
          placeholder="scholar@university.edu"
          required
          maxLength={MAX_AUTH_EMAIL}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {email.length}/{MAX_AUTH_EMAIL} characters
        </div>
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">{error}</p>
      )}
      <SubmitBtn className="sb-button-primary w-full" loadingText="Sending..." disabled={sending}>
        Send Recovery Code
      </SubmitBtn>
    </form>
  );
}

