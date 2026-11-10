import { describe, expect, it } from "vitest";

import {
  DEFAULT_COURSE_CURRENCY,
  formatCoursePrice,
  isCourseCurrency,
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

  it("rejects unsupported currency codes", () => {
    expect(isCourseCurrency("INR")).toBe(true);
    expect(isCourseCurrency("JPY")).toBe(true);
    expect(isCourseCurrency("XXX")).toBe(false);
  });
});
