import type { CallForPaperCategory } from "@prisma/client";

const CATEGORY_LABELS: Record<CallForPaperCategory, string> = {
  CONFERENCE: "Conference",
  BOOK_CHAPTER: "Book chapter",
  JOURNAL: "Journal",
  WORKSHOP: "Workshop",
  SYMPOSIUM: "Symposium",
};

export function getCallForPaperCategoryLabel(
  category: CallForPaperCategory | null | undefined,
): string {
  return category ? CATEGORY_LABELS[category] : "Call for papers";
}
