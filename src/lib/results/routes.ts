/**
 * The canonical URLs for the Exams & Results module.
 *
 * The old `/results` routes are kept alive by permanent redirects in
 * `next.config.ts`; internal links must use these helpers so a future rename
 * does not need another sweep through twenty call sites.
 */
export const RESULTS_BASE_PATH = "/exams-and-results";

export const RESULTS_ADD_PATH = `${RESULTS_BASE_PATH}/add`;

export function resultHref(id: string): string {
  return `${RESULTS_BASE_PATH}/${id}`;
}

export function resultEditHref(id: string): string {
  return `${resultHref(id)}/edit`;
}
