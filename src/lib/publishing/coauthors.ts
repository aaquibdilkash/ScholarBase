/**
 * Co-author input, write side.
 *
 * The read side lives in `citations.ts` (`parseCoAuthors`), which tolerates
 * whatever historical shape is in the column. This module is the boundary the
 * browser posts to: it rejects rather than tolerates, because a malformed
 * co-author list is the author's mistake to fix and every accepted name is
 * printed on the most visible line of the article.
 *
 * The list is stored as `Manuscript.coAuthors` JSON: a deposit or rendering
 * consumer reads the whole array and never queries one co-author, so a join
 * table would add relations without adding a query.
 */

export type CoAuthorDraft = {
  name: string;
  affiliation?: string;
  orcid?: string;
  email?: string;
};

/**
 * The submitting author's byline for this manuscript.
 *
 * Deliberately separate from the account: an author may publish under a
 * different form of their name, list a current institution, or give an ORCID iD
 * and correspondence address that differ from their ScholarBase profile. The
 * account remains the identity that owns the row; this is what the article
 * prints.
 */
export type CorrespondingAuthorDraft = CoAuthorDraft;

/**
 * What `Manuscript.coAuthors` holds.
 *
 * A new row is the wrapper, so the corresponding author travels with the same
 * JSON column as the co-authors. A bare array is the historical shape and is
 * still accepted by the read side (`parseCoAuthors`); a request that predates
 * this field therefore keeps writing it.
 */
export type StoredAuthorList =
  | { correspondingAuthor: CorrespondingAuthorDraft; coAuthors?: CoAuthorDraft[] }
  | CoAuthorDraft[];

export const MAX_CO_AUTHORS = 20;
export const MAX_CO_AUTHOR_NAME = 160;
export const MAX_CO_AUTHOR_AFFILIATION = 200;
export const MAX_CO_AUTHOR_ORCID = 64;
export const MAX_CO_AUTHOR_EMAIL = 320;

export type CoAuthorParseResult =
  | { ok: true; authors: CoAuthorDraft[] }
  | { ok: false; message: string };

/** Email addresses in the stored byline, used for reviewer conflict checks. */
export function storedAuthorEmails(value: unknown): string[] {
  const entries = Array.isArray(value)
    ? value
    : typeof value === "object" && value !== null
      ? [
          (value as { correspondingAuthor?: unknown }).correspondingAuthor,
          ...((value as { coAuthors?: unknown }).coAuthors instanceof Array
            ? (value as { coAuthors: unknown[] }).coAuthors
            : []),
        ]
      : [];

  return [...new Set(
    entries
      .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
      .map((entry) => text(entry.email).toLowerCase())
      .filter(Boolean),
  )];
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Validates an ORCID iD using the ISO 7064 MOD 11-2 check digit. */
export function isValidOrcid(value: string): boolean {
  const match = value.trim().match(/(?:https?:\/\/)?(?:www\.)?orcid\.org\/([0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X])/i) ?? value.trim().match(/^([0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X])$/i);
  if (!match) return false;
  const id = match[1].replace(/-/g, "").toUpperCase();
  let total = 0;
  for (const digit of id.slice(0, 15)) total = (total + Number(digit)) * 2;
  const check = (12 - (total % 11)) % 11;
  return (check === 10 ? "X" : String(check)) === id[15];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Parses the hidden `coAuthors` field.
 *
 * Accepts an empty value as "no co-authors". Entries with no name are dropped
 * when every other field is empty too (a blank row the author never filled in)
 * and rejected when they carry data — silently discarding an affiliation would
 * publish the wrong byline.
 */
export function parseCoAuthorDraft(raw: string): CoAuthorParseResult {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "[]") return { ok: true, authors: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, message: "The co-author list could not be read. Reload and try again." };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, message: "The co-author list could not be read. Reload and try again." };
  }
  if (parsed.length > MAX_CO_AUTHORS) {
    return { ok: false, message: `List at most ${MAX_CO_AUTHORS} co-authors.` };
  }

  const authors: CoAuthorDraft[] = [];
  const seen = new Set<string>();

  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const name = text(record.name);
    const affiliation = text(record.affiliation);
    const orcid = text(record.orcid);
    const email = text(record.email);

    if (!name && !affiliation && !orcid && !email) continue;
    if (!name) {
      return { ok: false, message: "Every co-author needs a name." };
    }
    if (name.length > MAX_CO_AUTHOR_NAME) {
      return {
        ok: false,
        message: `A co-author name must be ${MAX_CO_AUTHOR_NAME} characters or fewer.`,
      };
    }
    if (affiliation.length > MAX_CO_AUTHOR_AFFILIATION) {
      return {
        ok: false,
        message: `A co-author affiliation must be ${MAX_CO_AUTHOR_AFFILIATION} characters or fewer.`,
      };
    }
    if (orcid.length > MAX_CO_AUTHOR_ORCID) {
      return { ok: false, message: "An ORCID iD must be 64 characters or fewer." };
    }
    if (orcid && !isValidOrcid(orcid)) {
      return { ok: false, message: `"${orcid}" is not a valid ORCID iD.` };
    }
    if (email && (email.length > MAX_CO_AUTHOR_EMAIL || !EMAIL_PATTERN.test(email))) {
      return { ok: false, message: `"${email}" is not a valid co-author email.` };
    }

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    authors.push({
      name,
      ...(affiliation ? { affiliation } : {}),
      ...(orcid ? { orcid } : {}),
      ...(email ? { email } : {}),
    });
  }

  return { ok: true, authors };
}

export type CorrespondingAuthorParseResult =
  | { ok: true; author: CorrespondingAuthorDraft | null }
  | { ok: false; message: string };

/**
 * Parses the hidden `correspondingAuthor` field.
 *
 * `null` means the request did not carry a byline (an older form, or an API
 * caller); the read side then falls back to the account, which is exactly the
 * previous behaviour. A request that carries data without a name is rejected:
 * the corresponding author is printed first in every citation.
 */
export function parseCorrespondingAuthorDraft(
  raw: string,
): CorrespondingAuthorParseResult {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "null" || trimmed === "{}") {
    return { ok: true, author: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      ok: false,
      message: "The corresponding author could not be read. Reload and try again.",
    };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      ok: false,
      message: "The corresponding author could not be read. Reload and try again.",
    };
  }

  const record = parsed as Record<string, unknown>;
  const name = text(record.name);
  const affiliation = text(record.affiliation);
  const orcid = text(record.orcid);
  const email = text(record.email);

  if (!name) {
    if (!affiliation && !orcid && !email) return { ok: true, author: null };
    return { ok: false, message: "The corresponding author needs a name." };
  }
  if (name.length > MAX_CO_AUTHOR_NAME) {
    return {
      ok: false,
      message: `The corresponding author's name must be ${MAX_CO_AUTHOR_NAME} characters or fewer.`,
    };
  }
  if (affiliation.length > MAX_CO_AUTHOR_AFFILIATION) {
    return {
      ok: false,
      message: `The corresponding author's affiliation must be ${MAX_CO_AUTHOR_AFFILIATION} characters or fewer.`,
    };
  }
  if (orcid.length > MAX_CO_AUTHOR_ORCID) {
    return {
      ok: false,
      message: "The corresponding author's ORCID iD must be 64 characters or fewer.",
    };
  }
  if (orcid && !isValidOrcid(orcid)) {
    return { ok: false, message: `"${orcid}" is not a valid ORCID iD.` };
  }
  if (email && (email.length > MAX_CO_AUTHOR_EMAIL || !EMAIL_PATTERN.test(email))) {
    return {
      ok: false,
      message: `"${email}" is not a valid correspondence email.`,
    };
  }

  return {
    ok: true,
    author: {
      name,
      ...(affiliation ? { affiliation } : {}),
      ...(orcid ? { orcid } : {}),
      ...(email ? { email } : {}),
    },
  };
}

/**
 * Builds the value stored in `Manuscript.coAuthors`.
 *
 * Returns `null` when there is nothing to store. Without a corresponding-author
 * byline the historical bare array is kept, so an old client does not silently
 * change the stored shape; with one, the wrapper adds it alongside the
 * co-authors.
 */
export function buildStoredAuthorList(
  correspondingAuthor: CorrespondingAuthorDraft | null,
  coAuthors: readonly CoAuthorDraft[],
): StoredAuthorList | null {
  if (!correspondingAuthor) {
    return coAuthors.length ? [...coAuthors] : null;
  }

  return {
    correspondingAuthor,
    ...(coAuthors.length ? { coAuthors: [...coAuthors] } : {}),
  };
}
