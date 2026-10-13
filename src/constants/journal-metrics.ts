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

export const OA_OPTIONS = [
  { label: "Unknown / Not Specified", value: "UNKNOWN" },
  { label: "Closed (Subscription Only)", value: "CLOSED" },
  { label: "Hybrid (Mix of OA and Closed)", value: "HYBRID" },
  { label: "Gold (Author pays APC, free to read)", value: "GOLD" },
  { label: "Diamond (Free to publish and read)", value: "DIAMOND" },
] as const;

// ── Metric input bounds (industry-realistic) ─────────────────────────────
// Single source of truth shared by JournalForm (HTML min/max) and the server
// action (parseOptionalMetric). Ranges reflect what the indices actually
// publish:
//   • SJR (SCImago): 3-decimal indicator; real-world tops out ~15 (Nature).
//   • CiteScore (Scopus): integer or 1 decimal; real-world tops out ~160
//     (CA Cancer J Clin). Cap 200 leaves headroom.
//   • Impact Factor (JCR): 3-decimal indicator; real-world outlier ~300.
// Caps block garbage input (999999) without rejecting any legitimate value.
// step 0.001 on the inputs accepts integers and any 1–3-decimal value.
// maxLength = size of the longest legal input string ("50.000", "200.0",
// "1000.000"). HTML's maxLength attribute is ignored by type="number"
// inputs, so JournalForm truncates in onChange instead; the counter under
// each input shows len/maxLength.
export const METRIC_BOUNDS = {
  sjrScore: { min: 0, max: 50, maxLength: 8 },
  citeScore: { min: 0, max: 200, maxLength: 8 },
  impactFactor: { min: 0, max: 1000, maxLength: 8 },
} as const;

// ── Publication frequency (dropdown) ─────────────────────────────────────
// Canonical display strings. Existing free-text rows ("Monthly", "Quarterly",
// "Bi-annually", typos) keep rendering; new writes are constrained to these.
export const FREQUENCY_OPTIONS = [
  { label: "Select frequency", value: "" },
  { label: "Annual (1/year)", value: "Annual" },
  { label: "Biannual (2/year)", value: "Biannual" },
  { label: "Quarterly (4/year)", value: "Quarterly" },
  { label: "Bimonthly (6/year)", value: "Bimonthly" },
  { label: "Monthly (12/year)", value: "Monthly" },
  { label: "Fortnightly (26/year)", value: "Fortnightly" },
  { label: "Weekly (52/year)", value: "Weekly" },
  { label: "Continuous (online-first)", value: "Continuous" },
  { label: "Irregular", value: "Irregular" },
] as const;
