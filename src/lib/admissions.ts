import type { AdmissionLevel } from "@prisma/client";

export const ADMISSION_LEVELS = [
  { value: "PHD", label: "PhD" },
  { value: "MASTERS", label: "Master's" },
  { value: "UNDERGRADUATE", label: "Undergraduate" },
  { value: "MPHIL", label: "MPhil" },
  { value: "OTHER", label: "Other degree program" },
] as const satisfies readonly { value: AdmissionLevel; label: string }[];

const LEVEL_LABELS: Record<AdmissionLevel, string> = {
  PHD: "PhD",
  MASTERS: "Master's",
  UNDERGRADUATE: "Undergraduate",
  MPHIL: "MPhil",
  OTHER: "Other degree program",
};

export function getAdmissionLevelLabel(
  level: AdmissionLevel | null | undefined,
): string {
  return level ? LEVEL_LABELS[level] : "Admission";
}

/** Parses a submitted level, rejecting values outside the enum. */
export function parseAdmissionLevel(value: string): AdmissionLevel {
  const match = ADMISSION_LEVELS.find((level) => level.value === value);
  if (!match) throw new Error("Invalid admission level.");
  return match.value;
}
