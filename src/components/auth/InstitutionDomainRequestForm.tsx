"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { requestInstitutionDomain } from "@/app/actions/institution";
import {
  MAX_INSTITUTION_NAME,
  MAX_INSTITUTION_REQUEST_DETAILS,
  MAX_INSTITUTION_REQUEST_EMAIL,
  MAX_INSTITUTION_WEBSITE,
} from "@/lib/constants";
import { useToast } from "@/components/ui/Toast";

type TurnstileWidget = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      size: "flexible";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  reset: (widgetId: string) => void;
};

function CharacterCount({ value, max }: { value: string; max: number }) {
  return (
    <p className="text-right text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
      {value.length}/{max}
    </p>
  );
}

declare global {
  interface Window {
    turnstile?: TurnstileWidget;
  }
}

export function InstitutionDomainRequestForm({
  defaultEmail,
  showHeader = true,
}: {
  defaultEmail: string;
  showHeader?: boolean;
}) {
  const { toast } = useToast();
  const [email, setEmail] = useState(defaultEmail);
  const [institutionName, setInstitutionName] = useState("");
  const [website, setWebsite] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const resetTurnstile = useCallback(() => {
    setTurnstileToken("");
    if (turnstileWidgetIdRef.current && window.turnstile) {
      window.turnstile.reset(turnstileWidgetIdRef.current);
    }
  }, []);

  const renderTurnstile = useCallback(() => {
    if (
      !turnstileSiteKey ||
      !window.turnstile ||
      !turnstileContainerRef.current ||
      turnstileWidgetIdRef.current
    ) {
      return;
    }

    turnstileWidgetIdRef.current = window.turnstile.render(
      turnstileContainerRef.current,
      {
        sitekey: turnstileSiteKey,
        action: "institution-domain-request",
        size: "flexible",
        callback: (token) => {
          setTurnstileError(null);
          setTurnstileToken(token);
        },
        "expired-callback": resetTurnstile,
        "error-callback": () => {
          setTurnstileToken("");
          setTurnstileError("Security verification failed. Please try again.");
        },
      },
    );
  }, [resetTurnstile, turnstileSiteKey]);

  useEffect(() => {
    renderTurnstile();
  }, [renderTurnstile]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!turnstileSiteKey || !turnstileToken) {
      setTurnstileError(
        turnstileSiteKey
          ? "Please complete the security check before submitting."
          : "Security verification is temporarily unavailable. Please try again later.",
      );
      return;
    }

    setSubmitting(true);
    setTurnstileError(null);

    try {
      const formData = new FormData(event.currentTarget);
      formData.set("turnstileToken", turnstileToken);
      const result = await requestInstitutionDomain(formData);
      if (!result.success) {
        toast(result.error, "error");
        resetTurnstile();
        return;
      }

      setSubmitted(true);
      toast("Your institution request was submitted.", "success");
    } catch {
      resetTurnstile();
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
      {showHeader && (
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">
            Request an institution domain
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Use your institutional or research-lab email. An administrator will
            review the domain before it is approved.
          </p>
        </div>
      )}

      <div className="space-y-3">
        <div className="space-y-1">
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
          <CharacterCount value={email} max={MAX_INSTITUTION_REQUEST_EMAIL} />
        </div>
        <div className="space-y-1">
          <input
            className="sb-input"
            name="institutionName"
            placeholder="Institution or research lab name"
            required
            maxLength={MAX_INSTITUTION_NAME}
            value={institutionName}
            onChange={(event) => setInstitutionName(event.target.value)}
          />
          <CharacterCount value={institutionName} max={MAX_INSTITUTION_NAME} />
        </div>
        <div className="space-y-1">
          <input
            className="sb-input"
            name="website"
            type="url"
            placeholder="https://institution.example"
            maxLength={MAX_INSTITUTION_WEBSITE}
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
          <CharacterCount value={website} max={MAX_INSTITUTION_WEBSITE} />
        </div>
        <div className="space-y-1">
          <textarea
            className="sb-input min-h-24 resize-y"
            name="details"
            placeholder="Optional details to help us verify the institution"
            maxLength={MAX_INSTITUTION_REQUEST_DETAILS}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
          />
          <CharacterCount value={details} max={MAX_INSTITUTION_REQUEST_DETAILS} />
        </div>
      </div>

      {turnstileSiteKey ? (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            strategy="afterInteractive"
            onLoad={renderTurnstile}
            onError={() =>
              setTurnstileError(
                "Security verification failed to load. Please try again.",
              )
            }
          />
          <div
            ref={turnstileContainerRef}
            className="w-full"
            aria-label="Security verification"
          />
        </>
      ) : (
        <p className="text-sm text-amber-700 dark:text-amber-300" role="alert">
          Security verification is temporarily unavailable. Please try again later.
        </p>
      )}

      {turnstileError && (
        <p className="text-sm text-red-600" role="alert">
          {turnstileError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !turnstileSiteKey || !turnstileToken}
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
