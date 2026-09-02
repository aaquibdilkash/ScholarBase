"use client";

import ReactMarkdown from "react-markdown";
import sanitizeHtml from "sanitize-html";

type RichContentProps = {
  content?: string | null;
  className?: string;
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

export function RichContent({ content, className = "" }: RichContentProps) {
  const normalized = content?.trim();
  if (!normalized) {
    return null;
  }

  if (htmlLikePattern.test(normalized)) {
    const safeHtml = sanitizeRichHtml(normalized);

    return (
      <div
        className={`sb-rich-content break-words overflow-wrap-anywhere ${className}`}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    );
  }

  return (
    <div className={`sb-rich-content break-words overflow-wrap-anywhere ${className}`}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
