/**
 * H1 of the launch-readiness audit — survey anonymity.
 *
 * `getSurveyResponses` returned FULL respondent identity (name, handle,
 * avatar, institution badge, and the raw respondentId column) for responses
 * flagged isAnonymous, while the CSV/XLSX export path correctly blanked it.
 * The redaction now lives in one shared helper (`redactRespondentIdentity`)
 * called by both paths.
 *
 * Two layers are asserted here:
 *  1. The helper's semantics (pure, exhaustive).
 *  2. The WIRING — both the action and the export route must actually call it.
 *     A helper nobody calls would be exactly the original bug again, so the
 *     source of each call site is checked the same way `db-ssl.test.ts` checks
 *     its branch.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { redactRespondentIdentity } from "@/lib/surveys/export";

const IDENTITY = {
  id: "u-respondent",
  name: "Ada Lovelace",
  handle: "ada",
  avatarUrl: "https://cdn.test/ada.png",
  institutionVerifiedAt: new Date("2026-01-01"),
};

type Row = {
  id: string;
  isAnonymous: boolean;
  respondentId: string | null;
  respondent: typeof IDENTITY | null;
};

const row = (isAnonymous: boolean): Row => ({
  id: "resp-1",
  isAnonymous,
  respondentId: "u-respondent",
  respondent: IDENTITY,
});

describe("redactRespondentIdentity", () => {
  it("leaves a non-anonymous response fully intact", () => {
    const r = row(false);
    expect(redactRespondentIdentity(r)).toBe(r);
  });

  it("strips the joined respondent for an anonymous response", () => {
    const redacted = redactRespondentIdentity(row(true));
    expect(redacted.respondent).toBeNull();
    // The flag survives: callers still need to know a response IS anonymous.
    expect(redacted.isAnonymous).toBe(true);
  });

  it("strips the raw respondentId too — a user id IS identity", () => {
    // Nulling only the relation would still ship the foreign key, which maps
    // straight back to the account.
    const redacted = redactRespondentIdentity(row(true));
    expect(redacted.respondentId).toBeNull();
  });

  it("forceAnonymous overrides a client-submitted isAnonymous=false", () => {
    // Survey-level ANONYMOUS privacy: a client that ignored the UI and
    // submitted false must still come back redacted.
    const redacted = redactRespondentIdentity(row(false), true);
    expect(redacted.respondent).toBeNull();
    expect(redacted.respondentId).toBeNull();
    expect(redacted.isAnonymous).toBe(false);
  });

  it("does not mutate the original row", () => {
    const original = row(true);
    redactRespondentIdentity(original);
    expect(original.respondent).toBe(IDENTITY);
    expect(original.respondentId).toBe("u-respondent");
  });

  it("handles a shape without respondentId (the export select) without inventing fields", () => {
    const exportShaped = { isAnonymous: true, respondent: { name: "A", handle: "a" } };
    const redacted = redactRespondentIdentity(exportShaped);
    expect(redacted.respondent).toBeNull();
    expect("respondentId" in redacted).toBe(false);
  });
});

describe("both read paths actually call the shared helper", () => {
  const actionsSource = readFileSync(
    join(process.cwd(), "src", "app", "actions", "surveys.ts"),
    "utf8",
  );
  const routeSource = readFileSync(
    join(process.cwd(), "src", "app", "api", "surveys", "[id]", "export", "route.ts"),
    "utf8",
  );

  it("getSurveyResponses maps every response through redactRespondentIdentity", () => {
    expect(actionsSource).toContain("redactRespondentIdentity(response, forceAnonymous)");
  });

  it("the export route maps every response through redactRespondentIdentity", () => {
    expect(routeSource).toContain("redactRespondentIdentity(response, forceAnonymous)");
  });

  it("both pass survey-level ANONYMOUS privacy as the force flag", () => {
    expect(actionsSource).toContain('survey.privacy === "ANONYMOUS"');
    expect(routeSource).toContain('survey.privacy === "ANONYMOUS"');
  });
});
