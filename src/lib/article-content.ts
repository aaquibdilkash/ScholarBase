/**
 * Repairs legacy inline images in stored article content.
 *
 * Before the blog composer had the Tiptap Image extension, the editor schema
 * had no node that could hold an `<img>`, so inserting an image stored the tag
 * as ESCAPED TEXT (`&lt;img src="..."&gt;`) instead of an element. Those rows
 * render as literal markup — the URL is printed on the page instead of the
 * image, and the editor shows the raw tag as text.
 *
 * `repairLegacyInlineImages` converts the escaped sequence back into a real
 * `<img>` element.
 *
 * It is idempotent: content that already holds a real `<img>` tag is returned
 * untouched, so it is safe to run on every read. Repaired rows become
 * permanently correct the next time the article is saved, because the editor
 * then serialises a real image node.
 */

/** Decodes the HTML entities that can appear inside an escaped tag. */
function decodeAttributeEntities(attrs: string): string {
  return attrs
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export function repairLegacyInlineImages(html: string): string {
  if (!html || !html.includes("&lt;img")) return html;

  return html.replace(
    /&lt;img\s+([\s\S]*?)&gt;/g,
    (_match, attrs: string) => `<img ${decodeAttributeEntities(attrs)}>`,
  );
}
