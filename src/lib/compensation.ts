import {
  COURSE_CURRENCIES,
  DEFAULT_COURSE_CURRENCY,
  isCourseCurrency,
} from "@/lib/course-currency";

export { COURSE_CURRENCIES, DEFAULT_COURSE_CURRENCY, isCourseCurrency };

export const POSITION_DURATION_UNITS = [
  { value: "days", label: "Days" },
  { value: "months", label: "Months" },
  { value: "years", label: "Years" },
] as const;

export const COMPENSATION_PERIODS = [
  { value: "hour", label: "Per hour" },
  { value: "day", label: "Per day" },
  { value: "month", label: "Per month" },
  { value: "year", label: "Per year" },
  { value: "total", label: "Total compensation" },
] as const;

export const DEFAULT_COMPENSATION_PERIOD = "total";

const durationUnits = new Set<string>(POSITION_DURATION_UNITS.map(({ value }) => value));
const compensationPeriods = new Set<string>(COMPENSATION_PERIODS.map(({ value }) => value));

export function isPositionDurationUnit(value: string): boolean {
  return durationUnits.has(value);
}

export function isCompensationPeriod(value: string): boolean {
  return compensationPeriods.has(value);
}

export function parseOptionalDecimal(value: string, label: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) {
    throw new Error(`${label} must be a valid non-negative number.`);
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) throw new Error(`${label} is invalid.`);
  return parsed;
}

export function formatCompensation(
  value: number | null,
  currency: string | null,
  period: string | null,
): string | null {
  if (value == null) return null;
  const currencyLabel = currency && isCourseCurrency(currency) ? currency : DEFAULT_COURSE_CURRENCY;
  const periodLabel = COMPENSATION_PERIODS.find((item) => item.value === period)?.label ?? "Total compensation";
  return `${currencyLabel} ${value.toLocaleString("en-US")} (${periodLabel.toLowerCase()})`;
}

export function formatSalary(value: number | null, currency: string | null): string | null {
  if (value == null) return null;
  return `${currency ?? DEFAULT_COURSE_CURRENCY} ${value.toLocaleString("en-US")}`;
}

export function formatDuration(value: number | null, unit: string | null): string | null {
  if (value == null || !unit || !isPositionDurationUnit(unit)) return null;
  const label = POSITION_DURATION_UNITS.find((item) => item.value === unit)?.label.toLowerCase() ?? unit;
  return `${value} ${label}`;
}
