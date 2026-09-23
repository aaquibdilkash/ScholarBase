import type { BlockInput, Question } from "@/types/survey";

/**
 * Pure survey structure helpers shared by the builder, the response form and
 * the preview.
 *
 * A survey's questions are a flat, ordered list; each question may belong to at
 * most one `SurveyBlock` (a "section"). The published response form turns
 * *contiguous runs* of the same `blockId` into one page per section, so the
 * invariant enforced here is:
 *
 *   General questions (`blockId === null`) first, then every section in
 *   `blocks[].order`, with each section's questions kept contiguous.
 *
 * `blocks[].order` is authoritative for section sequence, which means
 * reordering a section must move its whole run of questions — otherwise the
 * published survey would never change.
 *
 * This module is deliberately dependency-free (type-only imports) so it can be
 * unit-tested in isolation and reused by every surface.
 */

/** Bucket key used for questions that are not assigned to any section. */
export const GENERAL_BUCKET = "__general__";

export type MoveDirection = "up" | "down";

export interface StructureResult {
  questions: Question[];
  blocks: BlockInput[];
  /** False when the move was impossible (already at the boundary). */
  moved: boolean;
}

export interface QuestionPosition {
  /** True when the question is the first in the whole survey. */
  isFirst: boolean;
  /** True when the question is the last in the whole survey. */
  isLast: boolean;
  /** True when the question is the first of its section (or of General). */
  isFirstInSection: boolean;
  /** True when the question is the last of its section (or of General). */
  isLastInSection: boolean;
}

/** Collapse a blockId into the bucket key used for grouping. */
export function bucketKey(blockId: string | null | undefined): string {
  return blockId ?? GENERAL_BUCKET;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Bucket sequence: General first, then sections in `blocks[].order`.
 * Section order is authoritative for page order.
 */
function bucketSequence(blocks: BlockInput[]): string[] {
  const sequence: string[] = [GENERAL_BUCKET];
  for (const block of [...blocks].sort((a, b) => a.order - b.order)) {
    const id = block.id;
    if (typeof id === "string" && id.length > 0) sequence.push(id);
  }
  return sequence;
}

/**
 * Re-lay-out questions so each section's run is contiguous and sections appear
 * in block order, renumbering `order` densely. Orphaned `blockId`s (pointing at
 * a deleted section) are cleared to `null` so those questions fall back to
 * General.
 */
export function normalizeSurveyStructure(
  questions: Question[],
  blocks: BlockInput[],
): { questions: Question[]; blocks: BlockInput[] } {
  const normalizedBlocks = [...blocks]
    .sort((a, b) => a.order - b.order)
    .map((block, index) => ({ ...block, order: index }));

  const validBlockIds = new Set(
    normalizedBlocks
      .map((block) => block.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  );

  // Group questions into buckets, preserving their relative order, and clear
  // orphaned block references in the same pass.
  const buckets = new Map<string, Question[]>();
  for (const question of questions) {
    const requested = question.blockId ?? null;
    const blockId =
      requested !== null && validBlockIds.has(requested) ? requested : null;
    const key = bucketKey(blockId);
    const sanitized = { ...question, blockId };
    const bucket = buckets.get(key);
    if (bucket) bucket.push(sanitized);
    else buckets.set(key, [sanitized]);
  }

  const sequence = bucketSequence(normalizedBlocks);
  // Defensive: never drop questions. Any bucket we did not anticipate (for
  // example a block without an id) is appended after the known sequence.
  for (const key of buckets.keys()) {
    if (!sequence.includes(key)) sequence.push(key);
  }

  const orderedQuestions: Question[] = [];
  for (const key of sequence) {
    const bucket = buckets.get(key);
    if (!bucket) continue;
    for (const question of bucket) {
      orderedQuestions.push({ ...question, order: orderedQuestions.length });
    }
  }

  return { questions: orderedQuestions, blocks: normalizedBlocks };
}

/**
 * Describe where a question sits so the UI can disable the arrows that would
 * move it past a boundary.
 */
export function getQuestionPosition(
  questions: Question[],
  questionId: string,
): QuestionPosition | null {
  const index = questions.findIndex((question) => question.id === questionId);
  if (index < 0) return null;

  const key = bucketKey(questions[index].blockId ?? null);
  const bucketIndices: number[] = [];
  questions.forEach((question, i) => {
    if (bucketKey(question.blockId ?? null) === key) bucketIndices.push(i);
  });

  return {
    isFirst: index === 0,
    isLast: index === questions.length - 1,
    isFirstInSection: index === bucketIndices[0],
    isLastInSection: index === bucketIndices[bucketIndices.length - 1],
  };
}

/**
 * Move a question one slot up or down (the ▲/▼ buttons).
 *
 * Crossing a section boundary also transfers membership: pressing ▼ on the last
 * question of a section drops it into the next section, and ▲ on the first
 * question of a section lifts it into the previous one. The question always
 * moves exactly one visual slot, which is what an arrow implies, so a pure
 * membership change without a positional change never happens.
 */
export function moveQuestion(
  questions: Question[],
  blocks: BlockInput[],
  questionId: string,
  direction: MoveDirection,
): StructureResult {
  const base = normalizeSurveyStructure(questions, blocks);
  const index = base.questions.findIndex(
    (question) => question.id === questionId,
  );
  const target = direction === "up" ? index - 1 : index + 1;

  if (index < 0 || target < 0 || target >= base.questions.length) {
    return { ...base, moved: false };
  }

  const next = [...base.questions];
  const moving = next[index];
  const neighbour = next[target];
  const crossingSection =
    bucketKey(moving.blockId) !== bucketKey(neighbour.blockId);

  next[index] = neighbour;
  next[target] = crossingSection
    ? { ...moving, blockId: neighbour.blockId ?? null }
    : moving;

  return {
    ...normalizeSurveyStructure(next, base.blocks),
    moved: true,
  };
}

/**
 * Move an entire section (its whole run of questions) up or down.
 *
 * Published page order follows question order, so reordering sections has to
 * carry their questions along — reordering only the `blocks` array would leave
 * the published survey unchanged.
 */
export function moveSection(
  questions: Question[],
  blocks: BlockInput[],
  blockId: string,
  direction: MoveDirection,
): StructureResult {
  const base = normalizeSurveyStructure(questions, blocks);
  const index = base.blocks.findIndex((block) => block.id === blockId);
  const target = direction === "up" ? index - 1 : index + 1;

  if (index < 0 || target < 0 || target >= base.blocks.length) {
    return { ...base, moved: false };
  }

  const nextBlocks = [...base.blocks];
  [nextBlocks[index], nextBlocks[target]] = [
    nextBlocks[target],
    nextBlocks[index],
  ];
  const relaid = nextBlocks.map((block, order) => ({ ...block, order }));

  return {
    ...normalizeSurveyStructure(base.questions, relaid),
    moved: true,
  };
}

/**
 * Resolve the absolute insertion index for a question landing at `targetIndex`
 * inside `targetBlockId`'s run.
 *
 * Runs are contiguous after normalization, so this is a simple offset. An empty
 * section has no run, so it inherits the position of the next non-empty bucket
 * in the sequence (or is appended at the end).
 */
function resolveInsertionIndex(
  questions: Question[],
  blocks: BlockInput[],
  targetBlockId: string | null,
  targetIndex: number,
): number {
  const key = bucketKey(targetBlockId);
  const runIndices: number[] = [];
  questions.forEach((question, i) => {
    if (bucketKey(question.blockId ?? null) === key) runIndices.push(i);
  });

  if (runIndices.length > 0) {
    const first = runIndices[0];
    const last = runIndices[runIndices.length - 1];
    return clamp(first + targetIndex, first, last + 1);
  }

  const sequence = bucketSequence(blocks);
  const startAt = sequence.indexOf(key);
  const laterKeys = startAt >= 0 ? sequence.slice(startAt + 1) : sequence;
  for (const laterKey of laterKeys) {
    const index = questions.findIndex(
      (question) => bucketKey(question.blockId ?? null) === laterKey,
    );
    if (index >= 0) return index;
  }

  return questions.length;
}

/** Remove a question and re-insert it at the requested position. */
function relocate(
  questions: Question[],
  blocks: BlockInput[],
  questionId: string,
  targetBlockId: string | null,
  targetIndex: number,
): StructureResult {
  const base = normalizeSurveyStructure(questions, blocks);
  const currentIndex = base.questions.findIndex(
    (question) => question.id === questionId,
  );
  if (currentIndex < 0) return { ...base, moved: false };

  const moving = base.questions[currentIndex];
  const remaining = base.questions.filter((_, i) => i !== currentIndex);
  const insertAt = resolveInsertionIndex(
    remaining,
    base.blocks,
    targetBlockId,
    targetIndex,
  );

  const reordered = [
    ...remaining.slice(0, insertAt),
    { ...moving, blockId: targetBlockId },
    ...remaining.slice(insertAt),
  ];

  const result = normalizeSurveyStructure(reordered, base.blocks);
  const moved = result.questions.some(
    (question, i) =>
      question.id !== base.questions[i]?.id ||
      (question.blockId ?? null) !== (base.questions[i]?.blockId ?? null),
  );

  return { ...result, moved };
}

/**
 * Reassign a question to another section (the section dropdown), appending it
 * to the end of that section's run. Relocating — rather than only changing
 * `blockId` — is what keeps section runs contiguous.
 */
export function moveQuestionToSection(
  questions: Question[],
  blocks: BlockInput[],
  questionId: string,
  targetBlockId: string | null,
): StructureResult {
  return relocate(
    questions,
    blocks,
    questionId,
    targetBlockId,
    Number.MAX_SAFE_INTEGER,
  );
}

/**
 * Drag-and-drop placement: drop a question into `targetBlockId` at
 * `targetIndex` within that section's run.
 */
export function placeQuestion(
  questions: Question[],
  blocks: BlockInput[],
  questionId: string,
  targetBlockId: string | null,
  targetIndex: number,
): StructureResult {
  return relocate(questions, blocks, questionId, targetBlockId, targetIndex);
}
