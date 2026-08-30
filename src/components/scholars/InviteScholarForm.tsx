"use client";

import { Loader2, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { inviteScholar } from "@/app/actions/scholars";
import { useToast } from "@/components/ui/Toast";
import { useAuthModal } from "@/components/interactions/AuthModal";
import { useUser } from "@/hooks/useUser";
import {
  MAX_INVITE_NAME,
  MAX_INVITE_EMAIL,
  MAX_INVITE_MESSAGE,
} from "@/lib/constants";
import type { InviteFormState } from "@/types/invite";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  INVITE_NAME_TIP,
  INVITE_EMAIL_TIP,
  INVITE_MESSAGE_TIP,
} from "@/constants/tooltips";

const initialState: InviteFormState = {
  success: false,
  message: "",
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
        "Send invite"
      )}
    </button>
  );
}

export function InviteScholarForm() {
  const [state, formAction] = useFormState(inviteScholar, initialState);
  const { toast } = useToast();
  const { openAuthModal } = useAuthModal();
  const { user } = useUser();
  const lastShownRef = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

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

  useEffect(() => {
    if (state.message && state.message !== lastShownRef.current) {
      lastShownRef.current = state.message;
      toast(state.message, state.success ? "success" : "error");
      if (state.success) {
        formRef.current?.reset();
        setName("");
        setEmail("");
        setMessage("");
      }
    }
  }, [state, toast]);

  const handleFormAction = (formData: FormData) => {
    if (!user) {
      openAuthModal();
      return;
    }
    formAction(formData);
  };

  return (
    <form
      ref={formRef}
      action={handleFormAction}
      className="space-y-5 sb-card p-6 md:p-8"
    >
      {state.message && !state.success && (
        <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-500/30 rounded-md">
          <p className="text-sm text-red-700 dark:text-red-300">
            {state.message}
          </p>
        </div>
      )}
      <div>
        <label
          className="sb-label inline-flex items-center gap-1.5"
          htmlFor="name"
        >
          Name
          <InfoTooltip message={INVITE_NAME_TIP} />
        </label>
        <input
          id="name"
          name="name"
          className="sb-input"
          placeholder="Scholar name"
          maxLength={MAX_INVITE_NAME}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {name.length}/{MAX_INVITE_NAME} characters
        </div>
      </div>
      <div>
        <label
          className="sb-label inline-flex items-center gap-1.5"
          htmlFor="email"
        >
          Email
          <InfoTooltip message={INVITE_EMAIL_TIP} />
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="sb-input"
          placeholder="scholar@university.edu"
          required
          maxLength={MAX_INVITE_EMAIL}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {email.length}/{MAX_INVITE_EMAIL} characters
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70">
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            Invites are sent by email. If you do not have their email, share the
            homepage link with them.
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
        <label
          className="sb-label inline-flex items-center gap-1.5"
          htmlFor="message"
        >
          Message
          <InfoTooltip message={INVITE_MESSAGE_TIP} />
        </label>
        <textarea
          id="message"
          name="message"
          className="sb-textarea min-h-40"
          placeholder="Tell them why they should join ScholarBase."
          maxLength={MAX_INVITE_MESSAGE}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {message.length.toLocaleString("en-US")}/
          {MAX_INVITE_MESSAGE.toLocaleString("en-US")} characters
        </div>
      </div>
      <SubmitButton />
    </form>
  );
}
