"use client";

import Link from "next/link";
import { useState } from "react";

import { requestInstitutionVerification } from "@/app/actions/institution-verification";
import { MAX_INSTITUTION_VERIFICATION_EMAIL } from "@/lib/constants";

type InstitutionVerificationFormProps = {
  institutionEmail: string | null;
  institutionVerifiedAt: Date | null;
};

export function InstitutionVerificationForm({
  institutionEmail: verifiedInstitutionEmail,
  institutionVerifiedAt,
}: InstitutionVerificationFormProps) {
  const [institutionEmail, setInstitutionEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setSubmitting(true);

    try {
      const result = await requestInstitutionVerification(
        new FormData(event.currentTarget),
      );

      if (result.success) {
        setMessage(result.message);
      } else {
        setError(result.error);
      }
    } catch {
      setError("We could not start verification. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-6 border-t border-slate-200/70 pt-6 dark:border-slate-800">
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">
        Institutional verification
      </h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Verify an institutional email without changing your ScholarBase sign-in
        email.
      </p>

      {institutionVerifiedAt ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">
          <p className="font-semibold">Institutional email verified</p>
          <p className="mt-1">{verifiedInstitutionEmail}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label className="sb-label" htmlFor="institution-email">
                Institutional email
              </label>
              <input
                id="institution-email"
                name="institutionEmail"
                type="email"
                value={institutionEmail}
                onChange={(event) => setInstitutionEmail(event.target.value)}
                className="sb-input mt-2 px-3 py-2 sm:px-3 sm:py-2"
                placeholder="you@university.edu"
                maxLength={MAX_INSTITUTION_VERIFICATION_EMAIL}
                required
              />
            </div>
            <button
              type="submit"
              disabled={submitting || institutionEmail.trim().length === 0}
              className="sb-button-primary w-full shrink-0 sm:w-auto"
            >
              {submitting ? "Sending..." : "Send verification email"}
            </button>
          </div>
          <div className="space-y-3">
            <Link
              href={
                institutionEmail.trim()
                  ? `/request-institution?email=${encodeURIComponent(institutionEmail.trim())}`
                  : "/request-institution"
              }
              className="block w-fit text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              Can’t find your institution? Request it here.
            </Link>
            {message && (
              <p className="text-sm text-emerald-600" role="status">
                {message}
              </p>
            )}
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
