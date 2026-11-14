import { describe, expect, it } from "vitest";

import {
  ADMISSION_LEVELS,
  getAdmissionLevelLabel,
  parseAdmissionLevel,
} from "@/lib/admissions";

/**
 * Admissions are research-only: PhD, MS/MSc by Research, or another research
 * degree. MPhil was discontinued by UGC Regulation 14 of the PhD Regulations
 * 2022, so it must never become a writable value again.
 */
describe("admission levels", () => {
  it("offers only research degrees", () => {
    expect(ADMISSION_LEVELS.map((level) => level.value)).toEqual([
      "PHD",
      "MS_BY_RESEARCH",
      "OTHER",
    ]);
  });

  it("parses every offered value", () => {
    for (const level of ADMISSION_LEVELS) {
      expect(parseAdmissionLevel(level.value)).toBe(level.value);
    }
  });

  it.each(["MASTERS", "UNDERGRADUATE", "MPHIL", "NOT_A_LEVEL", ""])(
    "rejects %s",
    (value) => {
      expect(() => parseAdmissionLevel(value)).toThrow("Invalid admission level.");
    },
  );

  it("labels each research degree", () => {
    expect(getAdmissionLevelLabel("PHD")).toBe("PhD");
    expect(getAdmissionLevelLabel("MS_BY_RESEARCH")).toBe("MS / MSc by Research");
    expect(getAdmissionLevelLabel("OTHER")).toBe("Other research degree");
  });

  it("falls back when the level is missing", () => {
    expect(getAdmissionLevelLabel(null)).toBe("Admission");
    expect(getAdmissionLevelLabel(undefined)).toBe("Admission");
  });
});
