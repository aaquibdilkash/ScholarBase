/**
 * Reading a stored reviewer report.
 *
 * `ReviewTask.inlineComments` is a JSON list of anchored notes
 * (`{ page?, quote?, body }`). A whole-report comment has no anchor, so its
 * entry is just `{ body }`. Historical rows and any hand-written row may hold a
 * bare string, so the reader tolerates both rather than throwing on a shape it
 * did not write — same contract as the co-author reader.
 */
export type ReviewReportNote = {
  page?: number;
  quote?: string;
  body: string;
};

function noteBody(entry: unknown): string {
  if (typeof entry === "string") return entry;
  if (!entry || typeof entry !== "object") return "";

  const body = (entry as { body?: unknown }).body;
  return typeof body === "string" ? body : "";
}

export function reviewReportBody(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";

  return value
    .map(noteBody)
    .map((body) => body.trim())
    .filter(Boolean)
    .join("\n\n");
}
