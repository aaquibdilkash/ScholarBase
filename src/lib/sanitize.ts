import sanitizeHtml from "sanitize-html";

/**
 * Allowlist for stored rich content.
 *
 * This is the last line of defence before user HTML reaches
 * `dangerouslySetInnerHTML` in `RichContent`, and it is the app's ONLY such sink.
 * It was previously untested, which is why it lived inside the component and
 * why P1-4 could not safely be actioned — see `test/security/sanitizer.test.ts`.
 *
 * Note there is deliberately NO `class` on `span`/`div` (removed for P1-4). The
 * only editor in the app is Tiptap with plain `StarterKit`, which emits no class
 * attributes into serialised content — its `editorProps.attributes.class` styles
 * the editor DOM wrapper and never reaches `getHTML()`. Allowing `class` here
 * therefore bought nothing and cost a UI-redressing surface: an author could
 * write `<span class="fixed inset-0 ...">` and overlay arbitrary UI on a page
 * that is otherwise trusted.
 *
 * The scheme allowlist is what blocks `javascript:` URLs, and it is the reason
 * this function exists rather than a regex. Keep it.
 */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
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
    // No `class`, and no `style` anywhere — both removed for P1-4.
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noreferrer noopener" }),
  },
};

/**
 * Sanitizes stored HTML for rendering.
 *
 * Exported from `lib/` rather than kept private to the component so it can be
 * tested directly, without pulling in React or jsdom for what is pure string
 * handling. Same pattern as `lib/search-guard.ts` in P0-3.
 */
export function sanitizeRichHtml(content: string): string {
  return sanitizeHtml(content, SANITIZE_OPTIONS);
}