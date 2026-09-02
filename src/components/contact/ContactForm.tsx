"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useActionState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { useAuthModal } from "@/components/interactions/AuthModal";
import { useToast } from "@/components/ui/Toast";
import { useUser } from "@/hooks/useUser";
import { useFormDraft } from "@/hooks/useFormDraft";
import { sendContactMessage } from "@/app/actions/contact";
import {
  MAX_CONTACT_NAME,
  MAX_CONTACT_EMAIL,
  MAX_CONTACT_SUBJECT,
  MAX_CONTACT_MESSAGE,
} from "@/lib/constants";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  CONTACT_NAME_TIP,
  CONTACT_EMAIL_TIP,
  CONTACT_SUBJECT_TIP,
  CONTACT_MESSAGE_TIP,
} from "@/constants/tooltips";

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
          <Loader2 className="animate-spin h-5 w-5" />
          Sending...
        </span>
      ) : (
        "Send Message"
      )}
    </button>
  );
}

export function ContactForm() {
  const [state, formAction] = useActionState(sendContactMessage, initialState);
  const { toast } = useToast();
  const { openAuthModal } = useAuthModal();
  const { user } = useUser();
  const lastShownRef = useRef<string | null>(null);

  const [draftFields, updateDraftField, resetDraft] = useFormDraft(DRAFT_KEY, {
    name: (user?.user_metadata.name as string | undefined) || "",
    email: user?.email || "",
    subject: "",
    message: "",
  });

  const { name, email, subject, message } = draftFields;

  useEffect(() => {
    if (state.message && state.message !== lastShownRef.current) {
      lastShownRef.current = state.message;
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
         <label htmlFor="name" className="sb-label inline-flex items-center gap-1.5">
           Your Name
           <InfoTooltip message={CONTACT_NAME_TIP} />
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
          maxLength={MAX_CONTACT_NAME}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {name.length}/{MAX_CONTACT_NAME} characters
        </div>
      </div>

       <div>
         <label htmlFor="email" className="sb-label inline-flex items-center gap-1.5">
           Email Address
           <InfoTooltip message={CONTACT_EMAIL_TIP} />
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
          maxLength={MAX_CONTACT_EMAIL}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {email.length}/{MAX_CONTACT_EMAIL} characters
        </div>
      </div>

       <div>
         <label htmlFor="subject" className="sb-label inline-flex items-center gap-1.5">
           Subject
           <InfoTooltip message={CONTACT_SUBJECT_TIP} />
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
          maxLength={MAX_CONTACT_SUBJECT}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {subject.length}/{MAX_CONTACT_SUBJECT} characters
        </div>
      </div>

       <div>
         <label htmlFor="message" className="sb-label inline-flex items-center gap-1.5">
           Message
           <InfoTooltip message={CONTACT_MESSAGE_TIP} />
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
          maxLength={MAX_CONTACT_MESSAGE}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {String(message.length).replace(/(\d+)(?=.(\d{3})*$)/g, "$1,")}/{MAX_CONTACT_MESSAGE} characters
        </div>
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

