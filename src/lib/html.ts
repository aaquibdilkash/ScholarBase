/**
 * Strips HTML markup down to visible plain text (server-safe, no DOM).
 * Expands block-level tags to newlines and decodes common entities so the
 * result approximates what the user actually typed. Used to enforce
 * character limits on rich-text content without measuring the raw HTML.
 */
export function stripHtmlTags(html: string): string {
  if (!html) return "";

  return html
    // Preserve line structure from block elements
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>/gi, "\n")
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
    .replace(/&[a-zA-Z]+;|&#\d+;/g, "");
}