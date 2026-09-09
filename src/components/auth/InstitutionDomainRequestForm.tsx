"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { requestInstitutionDomain } from "@/app/actions/institution";
import {
  MAX_INSTITUTION_NAME,
  MAX_INSTITUTION_REQUEST_DETAILS,
  MAX_INSTITUTION_REQUEST_EMAIL,
  MAX_INSTITUTION_WEBSITE,
} from "@/lib/constants";
import { useToast } from "@/components/ui/Toast";

export function InstitutionDomainRequestForm({
  defaultEmail,
}: {
  defaultEmail: string;
}) {
  const { toast } = useToast();
  const [email, setEmail] = useState(defaultEmail);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const result = await requestInstitutionDomain(
        new FormData(event.currentTarget),
      );
      if (!result.success) {
        toast(result.error, "error");
        return;
      }

      setSubmitted(true);
      toast("Your institution request was submitted.", "success");
    } catch {
      toast("Could not submit the institution request.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300">
        Your request is with the ScholarBase team. You can register after the
        domain has been reviewed and added to the approved directory.
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/50 dark:bg-blue-950/20"
    >
      <div>
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">
          Request an institution domain
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Use your institutional or research-lab email. An administrator will
          review the domain before it is approved.
        </p>
      </div>

      <div className="hidden" aria-hidden="true">
        <label htmlFor="institution-company">Company</label>
        <input
          id="institution-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="space-y-3">
        <input
          className="sb-input"
          name="institutionEmail"
          type="email"
          placeholder="you@institution.edu"
          required
          maxLength={MAX_INSTITUTION_REQUEST_EMAIL}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <input
          className="sb-input"
          name="institutionName"
          placeholder="Institution or research lab name"
          required
          maxLength={MAX_INSTITUTION_NAME}
        />
        <input
          className="sb-input"
          name="website"
          type="url"
          placeholder="https://institution.example"
          maxLength={MAX_INSTITUTION_WEBSITE}
        />
        <textarea
          className="sb-input min-h-24 resize-y"
          name="details"
          placeholder="Optional details to help us verify the institution"
          maxLength={MAX_INSTITUTION_REQUEST_DETAILS}
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="sb-button-primary w-full"
      >
        {submitting ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending request...
          </span>
        ) : (
          "Request review"
        )}
      </button>
    </form>
  );
}
