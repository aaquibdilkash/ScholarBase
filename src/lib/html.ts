/**
 * Strips HTML markup down to visible plain text (server-safe, no DOM).
 * Expands block-level tags to newlines and decodes common entities so the
 * result approximates what the user actually typed. Used to enforce
 * character limits on rich-text content without measuring the raw HTML.
 */
export function stripHtmlTags(html: string): string {
  if (!html) return "";

  return html
    // Preserve line structure from block elements (double newline matches
    // TipTap's default blockSeparator so multi-paragraph counts agree with
    // the Editor's editor.getText().length counter)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>/gi, "\n\n")
    // Drop every remaining tag (opening, closing, self-closing)
    .replace(/<[^>]*>/g, "")
    // Decode common HTML entities so they count as their real characters
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    // Remove any leftover entity fragments (prevents the phantom "&" bug)
    .replace(/&[a-zA-Z]+;|&#\d+;/g, "")
    // Structural newlines from closing block tags (e.g. "<p>a</p>" -> "a\n")
    // must not count toward the limit, and empty content ("<p></p>" -> "\n")
    // must measure as 0. Trim so plain-text length matches TipTap's
    // editor.getText() for the same visible content.
    .trim();
}

export function getRichTextLength(html: string): number {
  return stripHtmlTags(html ?? "").length;
}

export function isRichTextOverLimit(
  html: string,
  maxLength: number,
): boolean {
  if (!maxLength || maxLength <= 0) return false;
  return getRichTextLength(html) > maxLength;
}