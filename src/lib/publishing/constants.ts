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
export const MAX_MANUSCRIPT_DECLARATION = 2000;
export const MAX_MANUSCRIPT_JEL_CODES = 5;
export const MAX_MANUSCRIPT_JEL_CODE_LENGTH = 3;

/**
 * Peer-review limits. Shared by the reviewer report form (counters) and the
 * Server Action that accepts it, so the counter can never advertise a ceiling
 * the server ignores.
 */
export const MAX_REVIEW_COMMENTS = 6000;
export const MAX_REVIEW_CONFLICT_REASON = 2000;
export const MIN_REVIEW_SCORE = 1;
export const MAX_REVIEW_SCORE = 10;
/** A decision letter is optional for accept/revision, required for reject. */
export const MAX_DECISION_NOTE = 4000;

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

/**
 * Editable starting copy for a new venue. These are intentionally stored in
 * the client form only until the editor saves them; an existing venue value
 * always wins.
 */
export const VENUE_STARTER_TEMPLATES = {
  aimsAndScope: `<h2>Aims and scope</h2><p>This venue publishes original, rigorous work in its field and welcomes contributions that advance theory, methods, practice, or policy.</p><p>Submissions should make a clear contribution, explain their methods transparently, and be relevant to the venue's audience.</p><p><strong>Topics covered:</strong></p><ul><li>Add the primary subject areas covered by this venue.</li><li>Add any methods, populations, or themes of particular interest.</li><li>Describe any work that is outside the venue's scope.</li></ul>`,
  authorGuidelines: `<h2>Author guidelines</h2><p>Authors should submit original work that is not under consideration elsewhere and that follows the venue's scope.</p><p>Before submitting, ensure that the manuscript includes a clear title, abstract, keywords, author information, references, and any required declarations.</p><p>Authors are responsible for accurate authorship, permissions, citations, conflict-of-interest disclosures, funding information, and ethical approvals where applicable.</p><p>Add the required file format, word limits, formatting rules, submission checklist, and contact instructions for this venue.</p>`,
  peerReviewPolicy: `<h2>Peer-review policy</h2><p>Each submission is screened by the editorial team for scope, completeness, originality, and ethical concerns before peer review.</p><p>Suitable submissions are normally assessed by at least two independent reviewers. Reviewers should provide constructive, evidence-based feedback and disclose conflicts of interest.</p><p>The editor makes the final decision after considering the reports. Possible outcomes are accept, minor or major revision, or reject. Authors may appeal a decision by providing a reasoned response to the editorial office.</p><p>Add the review model, anonymity rules, expected timelines, and appeal process used by this venue.</p>`,
  ethicsPolicy: `<h2>Publication ethics</h2><p>This venue follows recognized publication-ethics principles and expects honesty, transparency, and respect from authors, reviewers, editors, and the publisher.</p><p>Authors must report original work, obtain consent and approvals where required, acknowledge contributions and funding, disclose conflicts, and correct material errors promptly.</p><p>The editorial team investigates suspected plagiarism, fabrication, falsification, duplicate publication, manipulated peer review, and undisclosed conflicts. Corrections, expressions of concern, or retractions may be issued when necessary.</p><p>Add any discipline-specific requirements, reporting channels, and the standards or organizations followed by this venue.</p>`,
} as const;

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

/** Normalizes JEL classification codes such as `M12, O33` into unique codes. */
export function parseManuscriptJelCodes(raw: string): string[] {
  const seen = new Set<string>();
  const codes: string[] = [];
  for (const part of raw.split(",")) {
    const code = part.trim().toUpperCase();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }
  return codes;
}

/** Validates the standard three-character JEL code format. */
export function validateManuscriptJelCodes(raw: string): string | null {
  const codes = parseManuscriptJelCodes(raw);
  if (codes.length > MAX_MANUSCRIPT_JEL_CODES) {
    return `Use at most ${MAX_MANUSCRIPT_JEL_CODES} JEL codes.`;
  }
  if (codes.some((code) => !/^[A-Z][0-9]{2}$/.test(code))) {
    return "JEL codes must use the format one letter followed by two digits, for example M12 or O33.";
  }
  return null;
}
