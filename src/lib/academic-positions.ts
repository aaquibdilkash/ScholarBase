import type { PositionType } from "@prisma/client";

export const POSITION_TYPES = [
  { value: "POSTDOC", label: "Postdoctoral position" },
  { value: "RESEARCH_ASSISTANT", label: "Research assistant" },
  { value: "RESEARCH_ASSOCIATE", label: "Research associate" },
  { value: "FACULTY", label: "Faculty position" },
  { value: "PHD_RESEARCHER", label: "PhD researcher position" },
  { value: "OTHER", label: "Other academic position" },
] as const satisfies readonly { value: PositionType; label: string }[];

const POSITION_TYPE_LABELS: Record<PositionType, string> = {
  POSTDOC: "Postdoctoral position",
  RESEARCH_ASSISTANT: "Research assistant",
  RESEARCH_ASSOCIATE: "Research associate",
  FACULTY: "Faculty position",
  PHD_RESEARCHER: "PhD researcher position",
  OTHER: "Other academic position",
};

export function getPositionTypeLabel(
  positionType: PositionType | null | undefined,
): string {
  return positionType ? POSITION_TYPE_LABELS[positionType] : "Academic position";
}

/** Parses a submitted position type, rejecting values outside the enum. */
export function parsePositionType(value: string): PositionType {
  const match = POSITION_TYPES.find((type) => type.value === value);
  if (!match) throw new Error("Invalid position type.");
  return match.value;
}
