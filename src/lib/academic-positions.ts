import type { EmploymentType, PositionType } from "@prisma/client";

export const POSITION_TYPES = [
  { value: "POSTDOC", label: "Postdoctoral position" },
  { value: "RESEARCH_ASSISTANT", label: "Research assistant" },
  { value: "RESEARCH_ASSOCIATE", label: "Research associate" },
  { value: "FACULTY", label: "Faculty position" },
  { value: "PHD_RESEARCHER", label: "PhD researcher position" },
  { value: "OTHER", label: "Other academic position" },
] as const satisfies readonly { value: PositionType; label: string }[];

export const EMPLOYMENT_TYPES = [
  { value: "PERMANENT", label: "Permanent" },
  { value: "CONTRACTUAL", label: "Contractual" },
  { value: "ADHOC", label: "Adhoc" },
  { value: "VISITING", label: "Visiting" },
  { value: "GUEST", label: "Guest faculty" },
  { value: "OTHER", label: "Other" },
] as const satisfies readonly { value: EmploymentType; label: string }[];

const POSITION_TYPE_LABELS: Record<PositionType, string> = {
  POSTDOC: "Postdoctoral position",
  RESEARCH_ASSISTANT: "Research assistant",
  RESEARCH_ASSOCIATE: "Research associate",
  FACULTY: "Faculty position",
  PHD_RESEARCHER: "PhD researcher position",
  OTHER: "Other academic position",
};

const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  PERMANENT: "Permanent",
  CONTRACTUAL: "Contractual",
  ADHOC: "Adhoc",
  VISITING: "Visiting",
  GUEST: "Guest faculty",
  OTHER: "Other",
};

export function getPositionTypeLabel(
  positionType: PositionType | null | undefined,
): string {
  return positionType ? POSITION_TYPE_LABELS[positionType] : "Academic position";
}

export function getEmploymentTypeLabel(
  employmentType: EmploymentType | null | undefined,
): string {
  return employmentType ? EMPLOYMENT_TYPE_LABELS[employmentType] : "Other";
}

/** Parses a submitted position type, rejecting values outside the enum. */
export function parsePositionType(value: string): PositionType {
  const match = POSITION_TYPES.find((type) => type.value === value);
  if (!match) throw new Error("Invalid position type.");
  return match.value;
}

/** Parses a submitted employment type, rejecting values outside the enum. */
export function parseEmploymentType(value: string): EmploymentType {
  const match = EMPLOYMENT_TYPES.find((type) => type.value === value);
  if (!match) throw new Error("Invalid employment type.");
  return match.value;
}
