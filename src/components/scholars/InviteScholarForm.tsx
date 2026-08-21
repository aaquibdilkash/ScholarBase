"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { inviteScholar } from "@/app/actions/scholars";
import { useToast } from "@/components/ui/Toast";
import { Share2 } from "lucide-react";

export function InviteScholarForm() {
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const homepageUrl =
    typeof window === "undefined"
      ? "https://scholarbase.app"
      : window.location.origin;

  const copyHomepageLink = async () => {
    try {
      await navigator.clipboard.writeText(homepageUrl);
      toast("Homepage link copied.", "success");
    } catch {
      toast("Could not copy link.", "error");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const formData = new FormData(event.currentTarget);
      const result = await inviteScholar(formData);
      if (result?.success) {
        event.currentTarget.reset();
        toast(result.message || "Invite sent successfully!", "success");
      } else {
        toast(result?.error || result?.message || "Could not send the invite.", "error");
      }
    } catch (error) {
      console.error("Invite submission error:", error);
      toast("An unexpected error occurred. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      className="space-y-5 sb-card p-6 md:p-8"
      onSubmit={handleSubmit}
    >
      <div>
        <label className="sb-label" htmlFor="name">Name</label>
        <input id="name" name="name" className="sb-input" placeholder="Scholar name" />
      </div>
      <div>
        <label className="sb-label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="sb-input" placeholder="scholar@university.edu" required />
        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70">
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            Invites are sent by email. If you do not have their email, share the homepage link with them.
          </p>
          <button
            type="button"
            onClick={copyHomepageLink}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-blue-500/40 dark:hover:text-blue-300"
            aria-label="Copy homepage link"
            title="Copy homepage link"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div>
        <label className="sb-label" htmlFor="message">Message</label>
        <textarea id="message" name="message" className="sb-textarea min-h-40" placeholder="Tell them why they should join ScholarBase." required />
      </div>
      <button type="submit" className="sb-button-primary w-full justify-center py-3 text-base font-semibold" disabled={submitting}>
        {submitting ? (
          <span className="flex items-center gap-2">
            <Loader2 className="animate-spin h-5 w-5" />
            Sending...
          </span>
        ) : (
          "Send invite"
        )}
      </button>
    </form>
  );
}
