/**
 * Shared survey page builder. The response form and the builder preview must
 * group questions into pages identically (sections become one page each,
 * section-free questions fill 3-question "General questions" pages), so both
 * surfaces share this pure function instead of duplicating the walk.
 */

/** Google Forms-style: section-free questions fill pages of this size. */
export const QUESTIONS_PER_PAGE = 3;

export interface PaginableBlock {
  id: string;
  title: string;
  order: number;
}

export interface PaginableQuestion {
  id: string;
  blockId?: string | null;
}

export interface SurveyPage<TQuestion extends PaginableQuestion> {
  title: string | null;
  questions: TQuestion[];
  /** 1-based position of the owning section, or null for General pages. */
  sectionIndex: number | null;
  sectionCount: number;
}

/**
 * Group visible questions into pages: one page per section run, and
 * QUESTIONS_PER_PAGE per page for section-free questions. Assumes questions
 * arrive in display order (see normalizeSurveyStructure).
 */
export function buildSurveyPages<
  TQuestion extends PaginableQuestion,
  TBlock extends PaginableBlock,
>(
  visibleQuestions: TQuestion[],
  blocks: TBlock[],
): SurveyPage<TQuestion>[] {
  const sortedBlocks = [...blocks].sort((a, b) => a.order - b.order);
  if (sortedBlocks.length === 0) {
    const fallbackPages: SurveyPage<TQuestion>[] = [];
    for (
      let i = 0;
      i < visibleQuestions.length;
      i += QUESTIONS_PER_PAGE
    ) {
      fallbackPages.push({
        title: null,
        questions: visibleQuestions.slice(i, i + QUESTIONS_PER_PAGE),
        sectionIndex: null,
        sectionCount: 0,
      });
    }
    return fallbackPages;
  }

  const blockById = new Map(
    sortedBlocks.map((block, index) => [block.id, { block, index }]),
  );
  const pages: SurveyPage<TQuestion>[] = [];
  // Identity of the section that owns the most recent page. Compare block ids,
  // NOT titles: two distinct sections may legitimately share the same title
  // and must still render as separate pages with their own section numbers.
  let lastPageBlockId: string | null = null;

  for (const question of visibleQuestions) {
    const section = question.blockId
      ? blockById.get(question.blockId)
      : undefined;
    const lastPage = pages[pages.length - 1];

    if (section) {
      if (lastPage && lastPageBlockId === section.block.id) {
        lastPage.questions.push(question);
      } else {
        pages.push({
          title: section.block.title,
          questions: [question],
          sectionIndex: section.index + 1,
          sectionCount: sortedBlocks.length,
        });
        lastPageBlockId = section.block.id;
      }
      continue;
    }

    // Section-free ("General") questions. `lastPageBlockId === null` means the
    // previous page is a General page, so its cap check is safe; a null blockId
    // here also resets the tracked section identity for the next question.
    if (
      lastPage &&
      lastPageBlockId === null &&
      lastPage.questions.length < QUESTIONS_PER_PAGE
    ) {
      lastPage.questions.push(question);
    } else {
      pages.push({
        title: "General questions",
        questions: [question],
        sectionIndex: null,
        sectionCount: sortedBlocks.length,
      });
      lastPageBlockId = null;
    }
  }

  return pages;
}
