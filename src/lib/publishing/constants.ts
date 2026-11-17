/**
 * Manuscript submission limits.
 *
 * Shared by the Server Action (which is the enforcement point), the client
 * form (counters and the pre-upload file check), and `manuscript-storage.ts`
 * (bucket policy). One constant per limit so a counter can never advertise a
 * ceiling the server does not honour.
 *
 * These are product limits, not database limits: the columns are `TEXT` so a
 * future editorial migration can widen a cap without a schema change.
 */

/** Supabase Storage bucket. Private — no public read policy exists. */
export const MANUSCRIPT_BUCKET = "manuscripts";

/** The version of record is a PDF. No DOCX, no HTML conversion. */
export const MANUSCRIPT_PDF_MIME = "application/pdf";

/** Upload ceiling. Also applied to the bucket by `npm run storage:manuscripts`. */
export const MAX_MANUSCRIPT_BYTES = 25 * 1024 * 1024;

export const MAX_MANUSCRIPT_TITLE = 200;
export const MAX_MANUSCRIPT_ABSTRACT = 3000;
export const MAX_MANUSCRIPT_KEYWORDS = 256;
export const MAX_MANUSCRIPT_KEYWORD_LENGTH = 24;
export const MAX_MANUSCRIPT_KEYWORD_COUNT = 8;

/** Venue CMS limits shared by the settings form and its Server Action. */
export const MAX_VENUE_EDITOR_NAME = 120;
export const MAX_VENUE_EDITOR_AFFILIATION = 200;
export const MAX_VENUE_FREQUENCY = 80;
export const MAX_VENUE_CONTACT_EMAIL = 320;
export const MAX_VENUE_RICH_TEXT = 12000;
export const MAX_VENUE_BOARD_MEMBERS = 50;
export const MAX_VENUE_BOARD_NAME = 160;
export const MAX_VENUE_BOARD_ROLE = 100;
export const MAX_VENUE_BOARD_AFFILIATION = 200;
export const MAX_VENUE_BOARD_ORCID = 64;

/** Human-readable size ceiling used in error copy and the upload hint. */
export const MAX_MANUSCRIPT_SIZE_LABEL = `${MAX_MANUSCRIPT_BYTES / (1024 * 1024)} MB`;

/**
 * Accepts a PDF when the browser reports the right type OR the name ends in
 * `.pdf`. Some Linux browsers and every drag from a file manager report an
 * empty `file.type`, and rejecting those would make the form look broken.
 */
export function isPdfUpload(file: { type: string; name: string }): boolean {
  const nameIsPdf = file.name.toLowerCase().endsWith(".pdf");
  if (file.type === MANUSCRIPT_PDF_MIME) return true;
  // Some Linux browsers and every drag from a file manager report an empty
  // `file.type`; fall back to the extension rather than rejecting a real PDF.
  return file.type === "" && nameIsPdf;
}

/**
 * Normalizes the comma-separated keyword field into unique, trimmed values.
 * `Manuscript.keywords` stores the joined string; parsing here keeps the action
 * and any future deposit builder reading the same list.
 */
export function parseManuscriptKeywords(raw: string): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];

  for (const part of raw.split(",")) {
    const keyword = part.trim().replace(/\s+/g, " ");
    if (!keyword) continue;
    const key = keyword.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    keywords.push(keyword);
  }

  return keywords;
}

/**
 * Validates the keyword list against the caps. Returns the first problem as a
 * user-facing message, or `null` when the list is acceptable.
 */
export function validateManuscriptKeywords(raw: string): string | null {
  const keywords = parseManuscriptKeywords(raw);
  if (keywords.length > MAX_MANUSCRIPT_KEYWORD_COUNT) {
    return `Use at most ${MAX_MANUSCRIPT_KEYWORD_COUNT} keywords.`;
  }
  if (keywords.some((keyword) => keyword.length > MAX_MANUSCRIPT_KEYWORD_LENGTH)) {
    return `Each keyword must be ${MAX_MANUSCRIPT_KEYWORD_LENGTH} characters or fewer.`;
  }
  return null;
}
