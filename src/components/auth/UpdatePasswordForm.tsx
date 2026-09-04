"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Loader2 } from "lucide-react";
import { AUTH_NEW_PASSWORD_TIP, AUTH_CONFIRM_PASSWORD_TIP } from "@/constants/tooltips";
import { MAX_AUTH_PASSWORD } from "@/lib/constants";

export function UpdatePasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const router = useRouter();
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setSubmitting(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/update-password", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        toast(data.message, "success");
        const callbackUrl = new URLSearchParams(window.location.search).get("callbackUrl");
        router.replace(callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login");
      } else {
        setError(data.error || "Could not update password. Please try again.");
        setSubmitting(false);
      }
    } catch {
      setError("Could not update password. Please try again.");
      setSubmitting(false);
    }
  }

   return (
     <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="sb-label inline-flex items-center gap-1.5" htmlFor="password">
            New Password
            <InfoTooltip message={AUTH_NEW_PASSWORD_TIP} />
          </label>
         <PasswordInput
           id="password"
           name="password"
           placeholder="••••••••"
           required
           minLength={6}
           maxLength={MAX_AUTH_PASSWORD}
           value={password}
           onChange={(e) => setPassword(e.target.value)}
         />
       </div>
        <div>
          <label className="sb-label inline-flex items-center gap-1.5" htmlFor="confirmPassword">
            Confirm Password
            <InfoTooltip message={AUTH_CONFIRM_PASSWORD_TIP} />
          </label>
         <PasswordInput
           id="confirmPassword"
           name="confirmPassword"
           placeholder="••••••••"
           required
           minLength={6}
           maxLength={MAX_AUTH_PASSWORD}
           value={confirmPassword}
           onChange={(e) => setConfirmPassword(e.target.value)}
         />
       </div>

      {error && (
        <div
          className={`rounded-2xl border p-3 text-center text-sm ${
            error.includes("successfully")
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        className="sb-button-primary w-full mt-2"
        disabled={submitting}
      >
        {submitting ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="animate-spin h-4 w-4" />
            Updating...
          </span>
        ) : (
          "Update Password"
        )}
      </button>
    </form>
  );
}
