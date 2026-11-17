/**
 * Venue slug primitives.
 *
 * Shared by the Server Action that creates a venue and the form that shows the
 * live preview and character counter, so the two cannot disagree about what a
 * valid slug is. Kept out of `src/app/actions/publishing.ts` because a
 * `"use server"` module may only export async server functions.
 */

export const MAX_VENUE_SLUG = 48;
export const MIN_VENUE_SLUG = 3;
export const MAX_VENUE_NAME = 80;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `"Indian Journal of Optics!"` -> `"indian-journal-of-optics"`. */
export function normalizeVenueSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_VENUE_SLUG);
}

/** True for a slug that can be used as-is, without normalization. */
export function isValidVenueSlug(value: string): boolean {
  return (
    value.length >= MIN_VENUE_SLUG &&
    value.length <= MAX_VENUE_SLUG &&
    SLUG_PATTERN.test(value)
  );
}
