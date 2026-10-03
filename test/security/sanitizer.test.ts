/**
 * `sanitizeRichHtml` — the last line of defence before user-authored HTML
 * reaches `dangerouslySetInnerHTML`.
 *
 * This suite did not exist until P1-4, which is the real problem it records:
 * `RichContent` is the app's only `dangerouslySetInnerHTML` sink, it renders
 * author-supplied content to every reader, and nothing asserted a single thing
 * about what it lets through. A regression that widened `allowedTags` or
 * `allowedSchemes` would have been invisible to the entire suite.
 *
 * The P1-4 change under test is the removal of `class` from `span`/`div`. The
 * editor is Tiptap with plain `StarterKit`, which emits no class attributes into
 * serialised content, so this closes a UI-redressing surface at no rendering
 * cost.
 */
import { describe, expect, it } from "vitest";
import { sanitizeRichHtml } from "@/lib/sanitize";

describe("sanitizeRichHtml — script execution", () => {
  it("strips script tags", () => {
    const out = sanitizeRichHtml("<p>hi</p><script>alert(1)</script>");
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toContain("alert(1)");
  });

  it("strips inline event handlers", () => {
    const out = sanitizeRichHtml('<img src="x" onerror="alert(1)">');
    expect(out).not.toMatch(/onerror/i);
  });

  it("strips javascript: URLs in href", () => {
    const out = sanitizeRichHtml('<a href="javascript:alert(1)">click</a>');
    expect(out.toLowerCase()).not.toContain("javascript:");
  });

  it("strips data: URLs in img src", () => {
    // `data:text/html` is a same-origin-ish XSS vector when allowed through.
    const out = sanitizeRichHtml(
      '<img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">',
    );
    expect(out.toLowerCase()).not.toContain("data:text/html");
  });

  it("strips iframes and objects", () => {
    const out = sanitizeRichHtml(
      '<iframe src="https://evil.example"></iframe><object data="x"></object>',
    );
    expect(out).not.toMatch(/<iframe/i);
    expect(out).not.toMatch(/<object/i);
  });

  it("strips style attributes and style tags", () => {
    const out = sanitizeRichHtml(
      '<p style="position:fixed;inset:0">x</p><style>body{display:none}</style>',
    );
    expect(out).not.toMatch(/style=/i);
    expect(out).not.toMatch(/<style/i);
  });
});

describe("sanitizeRichHtml — P1-4: class is no longer allowed", () => {
  it("strips class from span", () => {
    const out = sanitizeRichHtml('<span class="fixed inset-0">overlay</span>');
    expect(out).not.toMatch(/class=/i);
    // The text itself must survive — this is about the attribute, not the node.
    expect(out).toContain("overlay");
  });

  it("strips class from div", () => {
    const out = sanitizeRichHtml('<div class="sticky top-0 z-50">bar</div>');
    expect(out).not.toMatch(/class=/i);
    expect(out).toContain("bar");
  });

  it("still allows the structural tags it always did", () => {
    const out = sanitizeRichHtml('<span class="x">a</span><div class="y">b</div>');
    expect(out).toMatch(/<span>/);
    expect(out).toMatch(/<div>/);
  });
});

describe("sanitizeRichHtml — legitimate content survives", () => {
  it("keeps formatting tags", () => {
    const out = sanitizeRichHtml(
      "<p><strong>bold</strong> <em>italic</em> <code>code</code></p><ul><li>one</li></ul>",
    );
    expect(out).toMatch(/<strong>/);
    expect(out).toMatch(/<em>/);
    expect(out).toMatch(/<code>/);
    expect(out).toMatch(/<li>/);
    expect(out).toContain("one");
  });

  it("keeps http(s) and mailto links and forces safe rel", () => {
    const out = sanitizeRichHtml(
      '<a href="https://example.com" target="_blank">site</a>',
    );
    expect(out).toContain("https://example.com");
    // `target=_blank` without `noopener` hands the opener window to the target.
    expect(out).toMatch(/rel="[^"]*noopener/);
    expect(out).toMatch(/rel="[^"]*noreferrer/);

    const mail = sanitizeRichHtml('<a href="mailto:a@b.com">mail</a>');
    expect(mail).toContain("mailto:a@b.com");
  });

  it("keeps images with their dimensions", () => {
    const out = sanitizeRichHtml(
      '<img src="https://cdn.example/a.png" alt="a" width="10" height="20">',
    );
    expect(out).toContain("https://cdn.example/a.png");
    expect(out).toContain('alt="a"');
    expect(out).toContain('width="10"');
  });

  it("does not mangle plain prose", () => {
    expect(sanitizeRichHtml("just some text")).toBe("just some text");
  });
});