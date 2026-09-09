"use client";

import { useState } from "react";
import { requestEmailChange } from "@/app/actions/auth";
import { MAX_AUTH_EMAIL } from "@/lib/constants";

export function UpdateEmailForm({ currentEmail }: { currentEmail: string }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const result = await requestEmailChange(new FormData(event.currentTarget));
      if (result.success) {
        setMessage(result.message);
        setEmail("");
      } else {
        setError(result.error);
      }
    } catch {
      setError("We could not start the email change. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-3 border-t border-slate-200/70 pt-5 dark:border-slate-800">
      <div>
        <label className="sb-label" htmlFor="primary-email">
          Primary email
        </label>
        <p className="text-sm text-slate-500 dark:text-slate-400">Current: {currentEmail}</p>
      </div>
      <input
        id="primary-email"
        name="email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="sb-input px-3 py-2 sm:px-3 sm:py-2"
        placeholder="new-email@example.com"
        maxLength={MAX_AUTH_EMAIL}
        required
      />
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Only approved consumer or institutional domains can become your primary email.
        Supabase may require confirmation from both email addresses.
      </p>
      {message && <p className="text-sm text-emerald-600" role="status">{message}</p>}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <button
        type="submit"
        className="sb-button-soft"
        disabled={submitting || email.trim().length === 0}
      >
        {submitting ? "Sending..." : "Update email"}
      </button>
    </form>
  );
}
