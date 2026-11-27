import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const profileTabs = readFileSync("src/components/profile/ProfileTabs.tsx", "utf8");

describe("profile publication preview", () => {
  it("renders every publication in the carousel, not just the first", () => {
    expect(profileTabs).toContain("publications.map((publication) => (");
    expect(profileTabs).not.toContain("publication={publications[0]}");
  });

  it("does not use the useless 'View all' anchor", () => {
    expect(profileTabs).not.toContain("View all {publicationCount ?? 0} publications");
  });

  it("exposes an add-publication control for the owner", () => {
    expect(profileTabs).toContain('href="/publications/add"');
    expect(profileTabs).toContain("Add publication");
  });

  it("loads publications for every viewer, not only the owner", () => {
    expect(profileTabs).toContain('enabled: activeTab === "about",');
    expect(profileTabs).not.toContain('enabled: activeTab === "about" && isOwnProfile,');
  });
});
