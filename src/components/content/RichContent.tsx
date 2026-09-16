"use client";

import ReactMarkdown from "react-markdown";
import sanitizeHtml from "sanitize-html";

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

function sanitizeRichHtml(content: string) {
  return sanitizeHtml(content, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "sup",
      "sub",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "a",
      "img",
      "span",
      "div",
      "hr",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel", "title"],
      img: ["src", "alt", "title", "width", "height"],
      span: ["class"],
      div: ["class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noreferrer noopener" }),
    },
  });
}

export function RichContent({
  content,
  className = "",
  compact = false,
}: RichContentProps) {
  const normalized = content?.trim();
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
