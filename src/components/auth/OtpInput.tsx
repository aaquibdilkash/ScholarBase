"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCw } from "lucide-react";

export const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

type OtpInputProps = {
  email: string;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  verifyingLabel?: string;
  backLabel?: string;
  showBackButton?: boolean;
  autoSubmit?: boolean;
  busy?: boolean;
  error?: string | null;
  onVerify: (code: string) => void | Promise<void>;
  onResend: () => void | Promise<void>;
  onBack?: () => void;
};

export function OtpInput({
  email,
  title = "Enter the code",
  subtitle = "sent to",
  submitLabel = "Verify",
  verifyingLabel = "Verifying...",
  backLabel = "← Change email",
  showBackButton = true,
  autoSubmit = true,
  busy = false,
  error = null,
  onVerify,
  onResend,
  onBack,
}: OtpInputProps) {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    requestAnimationFrame(() => inputRefs.current[0]?.focus());
  }, []);

  const submitCode = (code: string) => {
    if (code.length !== OTP_LENGTH || busy) return;
    void onVerify(code);
  };

  const handleDigitChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, "");
    const next = [...digits];
    if (!clean) {
      next[index] = "";
      setDigits(next);
      return;
    }
    next[index] = clean[clean.length - 1];
    setDigits(next);
    if (index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    } else if (autoSubmit) {
      const full = next.join("");
      if (full.length === OTP_LENGTH) submitCode(full);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const paste = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);
    if (!paste) return;
    const next = [...digits];
    for (let i = 0; i < paste.length; i++) next[i] = paste[i];
    setDigits(next);
    inputRefs.current[Math.min(paste.length, OTP_LENGTH - 1)]?.focus();
    if (autoSubmit && paste.length === OTP_LENGTH) submitCode(paste);
  };

  const handleResend = () => {
    if (cooldown > 0 || busy) return;
    setCooldown(RESEND_COOLDOWN_SECONDS);
    void onResend();
  };

  return (
    <div className="space-y-3">
      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
        {title} {subtitle}{" "}
        <span className="font-semibold text-slate-700 dark:text-slate-200">{email}</span>
      </p>

      {error && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-center text-xs text-rose-500 dark:text-rose-400">
          {error}
        </div>
      )}

      <div className="flex justify-center gap-2">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleDigitChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            disabled={busy}
            aria-label={`Digit ${i + 1}`}
            className="sb-input h-12 w-10 !px-0 text-center font-mono text-lg font-bold disabled:opacity-50"
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => submitCode(digits.join(""))}
        disabled={digits.join("").length !== OTP_LENGTH || busy}
        className="sb-button-primary w-full disabled:opacity-40"
      >
        {busy ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {verifyingLabel}
          </span>
        ) : (
          submitLabel
        )}
      </button>

      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        {showBackButton ? (
          <button
            type="button"
            onClick={onBack}
            className="hover:text-slate-800 dark:hover:text-slate-200"
          >
            {backLabel}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || busy}
          className="flex items-center gap-1 hover:text-slate-800 disabled:opacity-40 dark:hover:text-slate-200"
        >
          <RotateCw className="h-3 w-3" />
          {cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
        </button>
      </div>
    </div>
  );
}
