"use client";

import { useFormSubmit } from "@/hooks/useFormSubmit";
import { forgotPassword } from "@/app/actions/auth";
import { SubmitBtn } from "@/components/ui/SubmitBtn";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { AUTH_EMAIL_TIP } from "@/constants/tooltips";
import { MAX_AUTH_EMAIL } from "@/lib/constants";
import { useState } from "react";

export function ForgotPasswordForm({ callbackUrl }: { callbackUrl: string }) {
  const [email, setEmail] = useState("");
  const { submitting, submit } = useFormSubmit(undefined, {
    successMessage: "Password reset link sent! Check your email.",
    errorMessage: "Failed to send password reset link.",
    resetOnSuccess: true,
  });

  const handleSubmit = async (formData: FormData) => {
    await submit(async () => {
      const result = await forgotPassword(formData);
      return result;
    });
  };

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
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
      <SubmitBtn className="sb-button-primary w-full" loadingText="Sending..." disabled={submitting}>
        Send Recovery Link
      </SubmitBtn>
    </form>
  );
}
