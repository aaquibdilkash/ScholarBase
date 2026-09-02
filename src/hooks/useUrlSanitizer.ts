"use client";

import { useCallback, useRef } from "react";
import { useToast } from "@/components/ui/Toast";

/**
 * Matches `http://...`, `https://...`, and `www.` URLs. Does *not* match bare
 * domains (e.g. `example.com`) so email addresses and file names are safe.
 */
export const URL_REGEX = /https?:\/\/[^\s]+|www\.[^\s]+/gi;

export interface UseUrlSanitizerOptions {
  /** Toast message shown the first time a URL is stripped in a typing burst. */
  message?: string;
}

/**
 * Core logic behind `UrlGuardedInput` / `UrlGuardedTextarea`.
 *
 * `sanitize(value)` returns the value with every URL removed and fires a
 * toast (once per "URL episode") when a URL was actually stripped.
 */
export function useUrlSanitizer({
  message = "URLs are not allowed in this field.",
}: UseUrlSanitizerOptions = {}) {
  const { toast } = useToast();
  const toastedRef = useRef(false);

  const sanitize = useCallback(
    (value: string): string => {
      const hasUrl = URL_REGEX.test(value);
      URL_REGEX.lastIndex = 0;

      if (hasUrl) {
        if (!toastedRef.current) {
          toast(message, "error");
          toastedRef.current = true;
        }
        const cleaned = value.replace(URL_REGEX, "").trim();
        URL_REGEX.lastIndex = 0;
        return cleaned;
      }

      // No URL present anymore – allow the next URL to toast again.
      toastedRef.current = false;
      return value;
    },
    [toast, message],
  );

  return { sanitize };
}
