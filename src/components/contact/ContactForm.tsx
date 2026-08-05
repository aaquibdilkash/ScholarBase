"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { useAuthModal } from "@/components/interactions/AuthModal";
import { useToast } from "@/components/ui/Toast";
import { useUser } from "@/hooks/useUser";
import { useFormDraft } from "@/hooks/useFormDraft";
import { sendContactMessage } from "@/app/actions/contact";

const DRAFT_KEY = "draft_contact";

const initialState = {
  message: "",
  success: false,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="sb-button-primary w-full justify-center py-3 text-base font-semibold"
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <svg
            className="animate-spin h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Sending...
        </span>
      ) : (
        "Send Message"
      )}
    </button>
  );
}

export function ContactForm() {
  const [state, formAction] = useFormState(sendContactMessage, initialState);
  const { toast } = useToast();
  const { openAuthModal } = useAuthModal();
  const { user } = useUser();

  const [draftFields, updateDraftField, resetDraft] = useFormDraft(DRAFT_KEY, {
    name: user?.user_metadata.name || "",
    email: user?.email || "",
    subject: "",
    message: "",
  });

  const { name, email, subject, message } = draftFields;

  useEffect(() => {
    if (state.message) {
      toast(state.message, state.success ? "success" : "error");
      if (state.success) {
        resetDraft();
      }
    }
  }, [state, toast, resetDraft]);

  const handleFormAction = (formData: FormData) => {
    if (!user) {
      openAuthModal();
      return;
    }
    formAction(formData);
  };

  return (
    <form action={handleFormAction} className="space-y-5">
      {/* Adding a hidden input to see the message for non-JS users */}
      {state.message && !state.success && (
         <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-500/30 rounded-md">
           <p className="text-sm text-red-700 dark:text-red-300">{state.message}</p>
         </div>
      )}
      <div>
        <label htmlFor="name" className="sb-label">
          Your Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={name}
          onChange={(e) => updateDraftField("name", e.target.value)}
          required
          className="sb-input"
          placeholder="John Doe"
        />
      </div>

      <div>
        <label htmlFor="email" className="sb-label">
          Email Address
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={email}
          onChange={(e) => updateDraftField("email", e.target.value)}
          required
          className="sb-input"
          placeholder="you@university.edu"
        />
      </div>

      <div>
        <label htmlFor="subject" className="sb-label">
          Subject
        </label>
        <input
          type="text"
          id="subject"
          name="subject"
          value={subject}
          onChange={(e) => updateDraftField("subject", e.target.value)}
          required
          className="sb-input"
          placeholder="Business Partnership Inquiry"
        />
      </div>

      <div>
        <label htmlFor="message" className="sb-label">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          value={message}
          onChange={(e) => updateDraftField("message", e.target.value)}
          required
          rows={6}
          className="sb-textarea resize-y"
          placeholder="Tell us about your inquiry..."
        />
      </div>

      <SubmitButton />

      <p className="text-xs text-center text-slate-500 dark:text-slate-400">
        By submitting this form, you agree to our{" "}
        <Link
          href="/privacy"
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          Privacy Policy
        </Link>
      </p>
    </form>
  );
}

