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

export const MAX_CO_AUTHORS = 20;
export const MAX_CO_AUTHOR_NAME = 160;
export const MAX_CO_AUTHOR_AFFILIATION = 200;
export const MAX_CO_AUTHOR_ORCID = 64;
export const MAX_CO_AUTHOR_EMAIL = 320;

export type CoAuthorParseResult =
  | { ok: true; authors: CoAuthorDraft[] }
  | { ok: false; message: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
