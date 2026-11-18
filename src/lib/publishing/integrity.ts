import { assertRichTextWithinLimit } from "@/lib/form";

export const PUBLICATION_NOTICE_TYPES = [
  "CORRECTION",
  "RETRACTION",
  "EXPRESSION_OF_CONCERN",
] as const;

const MAX_TITLE = 160;
const MAX_BODY = 12000;

export function validatePublicationNoticeInput(input: {
  type: string;
  title: string;
  body: string;
}): string | null {
  if (!PUBLICATION_NOTICE_TYPES.includes(input.type as (typeof PUBLICATION_NOTICE_TYPES)[number])) {
    return "Choose a valid publication notice type.";
  }
  if (!input.title.trim() || input.title.trim().length > MAX_TITLE) {
    return `The notice title must be between 1 and ${MAX_TITLE} characters.`;
  }
  try {
    assertRichTextWithinLimit(input.body, MAX_BODY, "Publication notice");
  } catch (error) {
    return error instanceof Error ? error.message : "The publication notice is too long.";
  }
  if (!input.body.replace(/<[^>]*>/g, "").trim()) {
    return "Add the reason and editorial explanation for this notice.";
  }
  return null;
}
