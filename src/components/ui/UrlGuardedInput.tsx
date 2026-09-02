"use client";

import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { useUrlSanitizer } from "@/hooks/useUrlSanitizer";

export interface UrlGuardedInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  /**
   * Receives the sanitized value (URLs stripped) on every change.
   * Prefer this over `onChange` for reading the current value.
   */
  onValueChange?: (value: string) => void;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Custom toast message shown when a URL is blocked. */
  toastMessage?: string;
}

export const UrlGuardedInput = forwardRef<HTMLInputElement, UrlGuardedInputProps>(
  ({ onValueChange, onChange, toastMessage, ...props }, ref) => {
    const { sanitize } = useUrlSanitizer({ message: toastMessage });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const cleaned = sanitize(e.target.value);
      onValueChange?.(cleaned);
      onChange?.(e);
    };

    return <input ref={ref} {...props} onChange={handleChange} />;
  },
);

UrlGuardedInput.displayName = "UrlGuardedInput";
