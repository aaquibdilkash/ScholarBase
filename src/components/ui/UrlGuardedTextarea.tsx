"use client";

import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";
import { useUrlSanitizer } from "@/hooks/useUrlSanitizer";

export interface UrlGuardedTextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  /**
   * Receives the sanitized value (URLs stripped) on every change.
   * Prefer this over `onChange` for reading the current value.
   */
  onValueChange?: (value: string) => void;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  /** Custom toast message shown when a URL is blocked. */
  toastMessage?: string;
}

export const UrlGuardedTextarea = forwardRef<
  HTMLTextAreaElement,
  UrlGuardedTextareaProps
>(({ onValueChange, onChange, toastMessage, ...props }, ref) => {
  const { sanitize } = useUrlSanitizer({ message: toastMessage });

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const cleaned = sanitize(e.target.value);
    onValueChange?.(cleaned);
    onChange?.(e);
  };

  return <textarea ref={ref} {...props} onChange={handleChange} />;
});

UrlGuardedTextarea.displayName = "UrlGuardedTextarea";
