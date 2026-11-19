/**
 * One vocabulary for the Exams & Results module.
 *
 * `kind` says what the row is: a result notification declares an outcome, an
 * exam notification announces an upcoming exam. `type` describes the outcome
 * subject for a result notification and is always EXAM for an exam
 * notification. Keeping the labels and parsers here means the form, the card,
 * the detail page, and both Server Actions cannot disagree about the values.
 */

export const RESULT_KINDS = [
  "RESULT_NOTIFICATION",
  "EXAM_NOTIFICATION",
] as const;
export type ResultKindValue = (typeof RESULT_KINDS)[number];

export const RESULT_KIND_LABELS: Record<ResultKindValue, string> = {
  RESULT_NOTIFICATION: "Result",
  EXAM_NOTIFICATION: "Exam Notification",
};

export const RESULT_KIND_OPTIONS: ReadonlyArray<{
  value: ResultKindValue;
  label: string;
}> = RESULT_KINDS.map((value) => ({
  value,
  label: RESULT_KIND_LABELS[value],
}));

export const RESULT_OUTCOME_TYPES = [
  "EXAM",
  "ADMISSION",
  "VACANCY",
  "EVENT",
  "OTHER",
] as const;
export type ResultOutcomeType = (typeof RESULT_OUTCOME_TYPES)[number];

export const RESULT_OUTCOME_LABELS: Record<ResultOutcomeType, string> = {
  EXAM: "Exam Result",
  ADMISSION: "Admission Result",
  VACANCY: "Vacancy Result",
  EVENT: "Event Result",
  OTHER: "Other Result",
};

export const RESULT_OUTCOME_OPTIONS: ReadonlyArray<{
  value: ResultOutcomeType;
  label: string;
}> = RESULT_OUTCOME_TYPES.map((value) => ({
  value,
  label: RESULT_OUTCOME_LABELS[value],
}));

/** Returns the canonical kind, or `null` for a missing/unknown value. */
export function parseResultKind(
  value: string | null | undefined,
): ResultKindValue | null {
  const normalized = value?.trim().toUpperCase();
  return RESULT_KINDS.includes(normalized as ResultKindValue)
    ? (normalized as ResultKindValue)
    : null;
}

/** Returns the canonical outcome type, or `null` for a missing/unknown value. */
export function parseResultOutcomeType(
  value: string | null | undefined,
): ResultOutcomeType | null {
  const normalized = value?.trim().toUpperCase();
  return RESULT_OUTCOME_TYPES.includes(normalized as ResultOutcomeType)
    ? (normalized as ResultOutcomeType)
    : null;
}

export function isExamNotification(
  kind: string | null | undefined,
): boolean {
  return parseResultKind(kind) === "EXAM_NOTIFICATION";
}

/**
 * Badge text for a row. An exam notification is labelled by its kind; a result
 * is labelled by its outcome type, falling back to the generic result label for
 * a legacy row with an unrecognised type.
 */
export function resultBadgeLabel(
  kind: string | null | undefined,
  type: string | null | undefined,
): string {
  if (isExamNotification(kind)) {
    return RESULT_KIND_LABELS.EXAM_NOTIFICATION;
  }

  const outcome = parseResultOutcomeType(type);
  return outcome ? RESULT_OUTCOME_LABELS[outcome] : RESULT_KIND_LABELS.RESULT_NOTIFICATION;
}

export type ResultLinkAction = {
  href: string;
  label: string;
};

/**
 * The two outbound actions on a result card/detail page, ordered by kind.
 *
 * An exam notification leads with the official notice; a result leads with the
 * page where candidates check their outcome. A missing link is omitted rather
 * than rendered as a dead button.
 */
export function resultLinkActions(
  kind: string | null | undefined,
  links: {
    notificationLink?: string | null;
    checkOrApplyLink?: string | null;
  },
): { primary: ResultLinkAction | null; secondary: ResultLinkAction | null } {
  const notification = links.notificationLink
    ? {
        href: links.notificationLink,
        label: "View official notification",
      }
    : null;
  const checkOrApply = links.checkOrApplyLink
    ? {
        href: links.checkOrApplyLink,
        label: isExamNotification(kind)
          ? "Apply / check details"
          : "Check result",
      }
    : null;

  const primary = isExamNotification(kind)
    ? (notification ?? checkOrApply)
    : (checkOrApply ?? notification);
  const secondary = primary === notification ? checkOrApply : notification;

  return { primary, secondary };
}
