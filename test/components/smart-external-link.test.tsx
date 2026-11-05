/**
 * @vitest-environment jsdom
 *
 * Regression: "Email to Apply" must render a real `mailto:` anchor when the
 * apply field holds a bare email, and a normal external link for an http(s)
 * URL. Cards that used the URL-only `SafeExternalLink` silently dropped the
 * button for email values.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { SmartExternalLink } from "@/components/ui/SmartExternalLink";

describe("SmartExternalLink", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const draw = (element: React.ReactElement) =>
    act(() => {
      root.render(element);
    });

  it("renders a mailto anchor with the email label for a bare email", () => {
    draw(
      <SmartExternalLink
        url="hr@inst.edu"
        urlLabel="Apply Now"
        emailLabel="Email to Apply"
      />,
    );

    const link = container.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("mailto:hr@inst.edu");
    expect(link.textContent).toBe("Email to Apply");
  });

  it("collapses a legacy mailto prefix into a single mailto anchor", () => {
    draw(
      <SmartExternalLink
        url="mailto:mailto:hr@inst.edu"
        emailLabel="Email to Apply"
      />,
    );

    const link = container.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("mailto:hr@inst.edu");
  });

  it("renders a normal external link for an http(s) URL", () => {
    draw(
      <SmartExternalLink
        url="https://institution.edu/apply"
        urlLabel="Apply Now"
        emailLabel="Email to Apply"
      />,
    );

    const link = container.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("https://institution.edu/apply");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.textContent).toBe("Apply Now");
  });
});
