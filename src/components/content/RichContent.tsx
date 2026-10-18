"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { sanitizeRichHtml } from "@/lib/sanitize";

type RichContentProps = {
  content?: string | null;
  className?: string;
  /**
   * Compact rendering for list/card previews (tighter margins).
   * Detail pages use the default comfortable spacing.
   */
  compact?: boolean;
};

const htmlLikePattern =
  /<(p|h[1-6]|ul|ol|li|blockquote|pre|code|sup|sub|strong|em|a|img|span|div|br|hr)(\s|>|\/)/i;

export function RichContent({
  content,
  className = "",
  compact = false,
}: RichContentProps) {
  const normalized = content?.trim();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  if (!normalized) {
    return null;
  }

  // Typography parity with the Tiptap editor (prose) + compact card density.
  // `sb-rich-content` in globals.css provides the unlayered fallback for
  // list bullets/numbers, headings and quotes killed by Tailwind preflight.
  const baseClass = `sb-rich-content prose prose-slate dark:prose-invert max-w-none break-words overflow-wrap-anywhere ${
    compact ? "prose-sm" : "prose-sm sm:prose-base"
  } ${className}`;

  if (htmlLikePattern.test(normalized)) {
    const safeHtml = sanitizeRichHtml(normalized);

    // The browser parses server HTML before React hydrates it. Sanitized rich
    // HTML can therefore produce a different child tree on the client (for
    // example around links), so keep the initial shell identical and mount
    // the HTML after hydration.
    if (!isHydrated) {
      return <div className={baseClass} />;
    }

    return (
      <div
        className={baseClass}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    );
  }

  return (
    <div className={baseClass}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
