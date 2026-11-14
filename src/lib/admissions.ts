import type { AdmissionLevel } from "@prisma/client";

export const ADMISSION_LEVELS = [
  { value: "PHD", label: "PhD" },
  { value: "MS_BY_RESEARCH", label: "MS / MSc by Research" },
  { value: "OTHER", label: "Other research degree" },
] as const satisfies readonly { value: AdmissionLevel; label: string }[];

const LEVEL_LABELS: Record<AdmissionLevel, string> = {
  PHD: "PhD",
  MS_BY_RESEARCH: "MS / MSc by Research",
  OTHER: "Other research degree",
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
