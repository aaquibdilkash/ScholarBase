import { describe, expect, it } from "vitest";

import { getTimeLeft } from "@/utils/time-ago";

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/**
 * `getTimeLeft` returns a tone (not a class string) so the list-card chips can
 * render theme-aware colors from one place. Each branch must map to a tone the
 * chip component knows.
 */
describe("getTimeLeft", () => {
  it("returns null when there is no deadline", () => {
    expect(getTimeLeft(null)).toBeNull();
    expect(getTimeLeft(undefined)).toBeNull();
  });

  it("returns no badge when the deadline is more than 30 days away", () => {
    expect(getTimeLeft(new Date(Date.now() + 31 * DAY + HOUR))).toBeNull();
  });

  it("maps a comfortable deadline to the info tone", () => {
    const result = getTimeLeft(new Date(Date.now() + 15 * DAY + HOUR));
    expect(result).toEqual({ label: "15 days left", tone: "info" });
  });

  it("maps an imminent deadline to the warning tone", () => {
    const result = getTimeLeft(new Date(Date.now() + 3 * DAY + 2 * HOUR + 30 * 60 * 1000));
    expect(result).toEqual({ label: "3d 2h left", tone: "warning" });
  });

  it("maps a same-day deadline to the danger tone", () => {
    const result = getTimeLeft(new Date(Date.now() + 6 * HOUR));
    expect(result?.tone).toBe("danger");
  });

  it("maps a passed deadline to the danger tone", () => {
    expect(getTimeLeft(new Date(Date.now() - DAY))).toEqual({
      label: "Closed",
      tone: "danger",
    });
  });
});
