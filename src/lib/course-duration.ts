export const COURSE_DURATION_UNITS = [
  "minutes",
  "hours",
  "days",
  "weeks",
  "months",
] as const;

export type CourseDurationUnit = (typeof COURSE_DURATION_UNITS)[number];

const COURSE_DURATION_UNIT_SET = new Set<string>(COURSE_DURATION_UNITS);

export function isCourseDurationUnit(
  value: string,
): value is CourseDurationUnit {
  return COURSE_DURATION_UNIT_SET.has(value);
}

/**
 * Size of the longest legal duration string ("999.99"). HTML's maxLength is
 * ignored by `type="number"`, so the form truncates in onChange and the server
 * rejects anything longer.
 */
export const COURSE_DURATION_MAX_LENGTH = 6;

export function formatCourseDuration(
  value: number | null | undefined,
  unit: string | null | undefined,
) {
  if (value == null || !unit || !isCourseDurationUnit(unit)) return null;
  return `${value} ${unit}`;
}
