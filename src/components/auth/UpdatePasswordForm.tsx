"use client";

import { useFormSubmit } from "@/hooks/useFormSubmit";
import { updatePassword } from "@/app/actions/auth";

export function UpdatePasswordForm({ message }: { message?: string }) {
  const { submitting, submit } = useFormSubmit(undefined, {
    successMessage: "Password updated successfully! Please sign in.",
    errorMessage: "Failed to update password.",
    resetOnSuccess: false,
  });

  const handleSubmit = async (formData: FormData) => {
    // The `useFormSubmit` hook expects the action to return a specific shape.
    // We can't directly use the server action if it doesn't match.
    // So, we wrap it here.
    await submit(async () => {
      // Because `updatePassword` is modified to return a value, we can use it here
      const result = await updatePassword(formData);
      return result;
    });
  };

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="sb-label" htmlFor="password">
          New Password
        </label>
        <input
          className="sb-input"
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          required
          minLength={6}
          disabled={submitting}
        />
      </div>
      <div>
        <label className="sb-label" htmlFor="confirmPassword">
          Confirm Password
        </label>
        <input
          className="sb-input"
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder="••••••••"
          required
          minLength={6}
          disabled={submitting}
        />
      </div>

      {message && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-700">
          {message}
        </div>
      )}

      <button
        type="submit"
        className="sb-button-primary w-full mt-2"
        disabled={submitting}
      >
        {submitting ? "Updating..." : "Update Password"}
      </button>
    </form>
  );
}
