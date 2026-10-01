/**
 * Settings tab routing.
 *
 * The settings page was one long scroll of four forms. It is now three tabs,
 * selected by `?tab=`, because the digest preference is not a security
 * concern and had no business living in the Security panel.
 *
 * `resolveSettingsTab` is the only piece with real logic: it maps an arbitrary
 * query value onto a real tab, and it has to fail CLOSED — a stale or
 * hand-typed `?tab=banana` must show the default panel, not a blank page. That
 * matters because this is a user-facing URL that people bookmark and share.
 */
import { describe, expect, it } from "vitest";

import {
  DEFAULT_SETTINGS_TAB,
  resolveSettingsTab,
} from "@/components/settings/SettingsTabs";

describe("resolveSettingsTab", () => {
  it("resolves each real tab", () => {
    expect(resolveSettingsTab("profile")).toBe("profile");
    expect(resolveSettingsTab("security")).toBe("security");
    expect(resolveSettingsTab("notifications")).toBe("notifications");
  });

  it("falls back to the default when no tab is requested", () => {
    // The profile page's "Edit profile" button links here with no query, so
    // this is the single most common arrival.
    expect(resolveSettingsTab(undefined)).toBe(DEFAULT_SETTINGS_TAB);
    expect(resolveSettingsTab(undefined)).toBe("profile");
  });

  it("falls back for an unknown tab instead of rendering nothing", () => {
    for (const bad of ["banana", "", "PROFILE", "security ", "0", "../admin"]) {
      expect(resolveSettingsTab(bad), `tab: ${bad}`).toBe(DEFAULT_SETTINGS_TAB);
    }
  });

  it("uses the first value when a tab is repeated in the query", () => {
    // `?tab=security&tab=notifications` — Next hands us an array.
    expect(resolveSettingsTab(["security", "notifications"])).toBe("security");
    expect(resolveSettingsTab([])).toBe(DEFAULT_SETTINGS_TAB);
  });

  it("is case-sensitive, so a near-miss cannot silently open another panel", () => {
    // `?tab=Security` is not `security`. Defaulting is right; guessing is not.
    expect(resolveSettingsTab("Security")).toBe(DEFAULT_SETTINGS_TAB);
  });
});
