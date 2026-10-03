import "server-only";

/**
 * Content-Security-Policy violation sink.
 *
 * DELETE THIS FILE, and drop `report-uri` from `lib/csp.ts`, at the end of Phase
 * 1 once the observation window is clean. It exists only to make violations
 * observable before the policy is switched to enforcing.
 *
 * Design constraints, all of which matter more than the logging:
 *
 * - **Always 204.** The browser posts this automatically. A redirect, a slow
 *   response, or an error here is visible to every user as a stalled page load.
 * - **Never throws.** Malformed JSON is normal (truncated body, wrong
 *   content-type), not exceptional, so it is swallowed.
 * - **No auth and no DB.** Unauthenticated by design; writing to Postgres would
 *   trade free-tier space for a firehose we intend to delete.
 *
 * The payload is flattened to a single line. The raw `csp-report` JSON nests the
 * directive and blocked URI inconsistently (both are sometimes arrays), so one
 * grep of the function logs answers "what broke and on which route" instead of
 * requiring someone to read nested JSON by eye.
 */

type CspReport = {
  "document-uri"?: string;
  "blocked-uri"?: string | string[];
  "violated-directive"?: string | string[];
  "original-policy"?: string;
  "disposition"?: string;
  "line-number"?: number;
  "column-number"?: number;
  "source-file"?: string;
};

/**
 * Chrome's `report-uri` (as opposed to the CSP3 `report-to`) wraps the whole
 * report in a top-level `"csp-report"` key:
 *
 *   { "csp-report": { "violated-directive": "script-src-elem", ... } }
 *
 * The first version of this route read the fields from the top level and logged
 * `directive= blocked= page=` with everything empty — caught by watching the real
 * dev server, not by a test, because no test posted a realistic body.
 *
 * Both shapes are accepted so the route works either way.
 */
function unwrap(body: unknown): CspReport {
  if (body && typeof body === "object" && "csp-report" in body) {
    const inner = (body as { "csp-report": CspReport })["csp-report"];
    return inner ?? {};
  }
  return (body as CspReport) ?? {};
}

/** Flatten a possibly-absent, possibly-array field to a single readable string. */
function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export async function POST(request: Request) {
  try {
    const body = unwrap(await request.json());
    const directive = first(body["violated-directive"]);
    const blocked = first(body["blocked-uri"]);
    const page = body["document-uri"] ?? "";

    console.warn(
      `[csp-violation] directive=${directive} blocked=${blocked} page=${page}`,
    );
  } catch {
    // A malformed report must never surface as an error to the browser.
  }

  return new Response(null, { status: 204 });
}