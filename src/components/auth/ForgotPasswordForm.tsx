"use client";

import { useFormSubmit } from "@/hooks/useFormSubmit";
import { forgotPassword } from "@/app/actions/auth";
import { SubmitBtn } from "@/components/ui/SubmitBtn";

export function ForgotPasswordForm({ callbackUrl }: { callbackUrl: string }) {
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
        <label className="sb-label" htmlFor="email-forgot">
          Email
        </label>
        <input
          className="sb-input"
          id="email-forgot"
          name="email"
          type="email"
          placeholder="scholar@university.edu"
          required
        />
      </div>
      <SubmitBtn className="w-full sb-button-soft" loadingText="Sending...">
        Send Recovery Link
      </SubmitBtn>
    </form>
  );
}
