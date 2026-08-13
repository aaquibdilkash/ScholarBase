"use client";

import { useState } from "react";
import { inviteScholar } from "@/app/actions/scholars";
import { useToast } from "@/components/ui/Toast";

export function InviteScholarForm() {
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  return (
    <form
      className="space-y-5 sb-card p-6 md:p-8"
      onSubmit={async (event) => {
        event.preventDefault();
        setSubmitting(true);
        const result = await inviteScholar(new FormData(event.currentTarget));
        if (result.success) {
          event.currentTarget.reset();
          toast(result.message || "Invite sent successfully!", "success");
        } else {
          toast(result.error || "Could not send the invite.", "error");
        }
        setSubmitting(false);
      }}
    >
      <div>
        <label className="sb-label" htmlFor="name">Name</label>
        <input id="name" name="name" className="sb-input" placeholder="Scholar name" />
      </div>
      <div>
        <label className="sb-label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="sb-input" placeholder="scholar@university.edu" required />
      </div>
      <div>
        <label className="sb-label" htmlFor="message">Message</label>
        <textarea id="message" name="message" className="sb-textarea min-h-40" placeholder="Tell them why they should join ScholarBase." required />
      </div>
      <button type="submit" className="sb-button-primary" disabled={submitting}>
        {submitting ? "Sending..." : "Send invite"}
      </button>
    </form>
  );
}
