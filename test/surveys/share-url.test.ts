import { describe, expect, it } from "vitest";
import { getSurveyShareUrl } from "@/lib/surveys/share";

describe("survey share URL", () => {
  it("uses the canonical ScholarBase domain", () => {
    expect(getSurveyShareUrl("survey-123")).toBe("https://scholarbase.app/surveys/survey-123");
  });

  it("uses the active deployment origin for local and staging links", () => {
    expect(getSurveyShareUrl("survey-123", "http://localhost:3000")).toBe(
      "http://localhost:3000/surveys/survey-123",
    );
    expect(getSurveyShareUrl("survey-123", "https://staging.scholarbase.app/")).toBe(
      "https://staging.scholarbase.app/surveys/survey-123",
    );
  });

  it("encodes survey IDs safely", () => {
    expect(getSurveyShareUrl("survey/with spaces")).toBe(
      "https://scholarbase.app/surveys/survey%2Fwith%20spaces",
    );
  });
});
