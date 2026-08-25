export const QUARTILE_OPTIONS = [
  { label: "NONE", value: "NONE" },
  { label: "Q1 (Top 25%)", value: "Q1" },
  { label: "Q2 (Top 50%)", value: "Q2" },
  { label: "Q3 (Top 75%)", value: "Q3" },
  { label: "Q4 (Bottom 25%)", value: "Q4" },
] as const;

export const WOS_INDEX_OPTIONS = [
  { label: "NONE", value: "NONE" },
  { label: "SCIE (Science Citation Index Expanded)", value: "SCIE" },
  { label: "SSCI (Social Sciences Citation Index)", value: "SSCI" },
  { label: "AHCI (Arts & Humanities Citation Index)", value: "AHCI" },
  { label: "ESCI (Emerging Sources Citation Index)", value: "ESCI" },
] as const;

export const ABDC_OPTIONS = [
  { label: "NONE", value: "NONE" },
  { label: "A* (Elite)", value: "A_STAR" },
  { label: "A (Excellent)", value: "A" },
  { label: "B (Good)", value: "B" },
  { label: "C (Satisfactory)", value: "C" },
] as const;
