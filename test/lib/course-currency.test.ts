import { describe, expect, it } from "vitest";

import {
  COURSE_PRICING_OPTIONS,
  DEFAULT_COURSE_CURRENCY,
  formatCoursePrice,
  isCourseCurrency,
  isCoursePricing,
} from "@/lib/course-currency";

describe("course currency", () => {
  it("uses INR as the backward-compatible default", () => {
    expect(DEFAULT_COURSE_CURRENCY).toBe("INR");
    expect(formatCoursePrice(500, undefined)).toBe("₹500");
  });

  it("formats supported currencies and free courses", () => {
    expect(formatCoursePrice(25, "USD")).toBe("$25");
    expect(formatCoursePrice(25, "EUR")).toBe("€25");
    expect(formatCoursePrice(25, "GBP")).toBe("£25");
    expect(formatCoursePrice(25, "JPY")).toBe("¥25");
    expect(formatCoursePrice(0, "USD")).toBe("Free");
    expect(formatCoursePrice(null, "USD")).toBeNull();
  });

  it("keeps decimals instead of rounding them away", () => {
    expect(formatCoursePrice(9.99, "USD")).toBe("$9.99");
    expect(formatCoursePrice(499.5, "INR")).toBe("₹499.5");
  });

  it("rejects unsupported currency codes", () => {
    expect(isCourseCurrency("INR")).toBe(true);
    expect(isCourseCurrency("JPY")).toBe(true);
    expect(isCourseCurrency("XXX")).toBe(false);
  });

  it("exposes exactly the free/paid classification", () => {
    expect(COURSE_PRICING_OPTIONS.map((option) => option.value)).toEqual([
      "FREE",
      "PAID",
    ]);
    expect(isCoursePricing("FREE")).toBe(true);
    expect(isCoursePricing("PAID")).toBe(true);
    expect(isCoursePricing("paid")).toBe(false);
    expect(isCoursePricing("")).toBe(false);
  });
});
