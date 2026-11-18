import { describe, expect, it } from "vitest";

import { validatePublicationNoticeInput } from "@/lib/publishing/integrity";

describe("publication integrity notice validation", () => {
  it("accepts a substantive correction notice", () => {
    expect(validatePublicationNoticeInput({ type: "CORRECTION", title: "Updated affiliation", body: "<p>The affiliation was corrected.</p>" })).toBeNull();
  });

  it("rejects an empty notice and unknown type", () => {
    expect(validatePublicationNoticeInput({ type: "NOTICE", title: "Notice", body: "<p>Reason</p>" })).toMatch(/valid/i);
    expect(validatePublicationNoticeInput({ type: "CORRECTION", title: "Notice", body: "<p><strong></strong></p>" })).toMatch(/reason/i);
  });
});
