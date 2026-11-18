/** Stable URL keys for real conference occurrences. */
export const MAX_EDITION_SLUG = 32;
const EDITION_SLUG_PATTERN = /^(?:[0-9]{4})(?:-(?:h[12]|q[1-4]))?$/;

export function normalizeEditionSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, MAX_EDITION_SLUG);
}

export function isValidEditionSlug(value: string): boolean {
  return value.length <= MAX_EDITION_SLUG && EDITION_SLUG_PATTERN.test(value);
}

export function editionTermLabel(term: string | null): string {
  if (!term) return "Annual edition";
  return term.toUpperCase().replace("H", "Half ").replace("Q", "Quarter ");
}

export function editionDisplayLabel(year: number, term: string | null): string {
  return `${year} — ${editionTermLabel(term)}`;
}
