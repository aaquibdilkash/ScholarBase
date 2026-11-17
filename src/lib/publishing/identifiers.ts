/**
 * ISSN and ISBN validation.
 *
 * Both numbers are typed into an admin form and printed on a public page and a
 * PDF, so a single wrong check digit silently corrupts every citation that
 * quotes it. Validation therefore happens at the write boundary (Server Action)
 * and never as a client-only convenience.
 *
 * `formatIssn` / `formatIsbn13` return the canonical hyphenated display form and
 * an empty string when the input is invalid, so a caller cannot accidentally
 * print a malformed identifier by skipping the validity check.
 *
 * RIS and Highwire builders live with the article page that consumes them, not
 * here — they need the manuscript shape and would only be dead code until then.
 */

/** ISSN check digit weights, left to right (ISO 3297). */
const ISSN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2] as const;

/** Strip separators and upper-case the `X` check digit. */
export function normalizeIssn(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

/**
 * Eighth character is the check digit: `11 - (weighted sum mod 11)`, where 11
 * becomes `0` and 10 becomes `X`.
 */
export function isValidIssn(value: string): boolean {
  const normalized = normalizeIssn(value ?? "");
  if (normalized.length !== 8) return false;

  const body = normalized.slice(0, 7);
  const check = normalized.charAt(7);

  if (!/^\d{7}$/.test(body)) return false;
  if (!/^[\dX]$/.test(check)) return false;

  const sum = ISSN_WEIGHTS.reduce(
    (total, weight, index) => total + Number(body[index]) * weight,
    0,
  );
  const expected = (11 - (sum % 11)) % 11;

  return (check === "X" ? 10 : Number(check)) === expected;
}

/** `1234567X` -> `1234-567X`; invalid input -> `""`. */
export function formatIssn(value: string): string {
  if (!isValidIssn(value)) return "";
  const normalized = normalizeIssn(value);
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

/** Strip the separators authors copy from a copyright page. */
export function normalizeIsbn(value: string): string {
  return (value ?? "").replace(/[\s-]/g, "").toUpperCase();
}

/**
 * ISBN-13 check digit: alternating 1/3 weights over the first twelve digits.
 *
 * ISBN-10 is deliberately unsupported — every volume published from now on gets
 * a 978/979 prefix, and accepting both forms would let a 10-digit legacy number
 * through the same field as an 13-digit one with no way to tell them apart.
 */
export function isValidIsbn13(value: string): boolean {
  const normalized = normalizeIsbn(value);
  if (!/^\d{13}$/.test(normalized)) return false;

  const sum = normalized
    .slice(0, 12)
    .split("")
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);

  return Number(normalized.charAt(12)) === (10 - (sum % 10)) % 10;
}

/** `9783161484100` -> `978-3-16-148410-0`; invalid input -> `""`. */
export function formatIsbn13(value: string): string {
  if (!isValidIsbn13(value)) return "";
  const n = normalizeIsbn(value);
  return `${n.slice(0, 3)}-${n.slice(3, 4)}-${n.slice(4, 6)}-${n.slice(6, 12)}-${n.slice(12)}`;
}
