import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const profileTabs = readFileSync("src/components/profile/ProfileTabs.tsx", "utf8");

describe("profile publication preview", () => {
  it("does not render a publication card until the preview has data", () => {
    expect(profileTabs).toContain("{publications.length > 0 ? (");
    expect(profileTabs).toContain("publication={publications[0]}");
    expect(profileTabs).toContain(") : isPublicationsPending ? (");
  });
});
