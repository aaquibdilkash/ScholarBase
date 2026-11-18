export const POSITION_DURATION_UNITS = [
  { value: "days", label: "Days" },
  { value: "months", label: "Months" },
  { value: "years", label: "Years" },
] as const;

const durationUnits = new Set<string>(POSITION_DURATION_UNITS.map(({ value }) => value));

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

export function isPositionDurationUnit(value: string): boolean {
  return durationUnits.has(value);
}

export function formatDuration(value: number | null, unit: string | null): string | null {
  if (value == null || !unit || !isPositionDurationUnit(unit)) return null;
  const label = POSITION_DURATION_UNITS.find((item) => item.value === unit)?.label.toLowerCase() ?? unit;
  return `${value} ${label}`;
}
