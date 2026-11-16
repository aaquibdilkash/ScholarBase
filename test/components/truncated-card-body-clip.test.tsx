/**
 * @vitest-environment jsdom
 *
 * Regression: `TruncatedCardBody` keeps a hidden, full-height measurement copy
 * of the body absolutely positioned on top of the clamped one. Without clipping
 * the wrapper, that copy adds its whole natural height to the scrollable
 * overflow of every ancestor, so the document grew past the footer and left a
 * blank strip below it on list pages (reported on `/admissions` and `/learn`).
 *
 * The clone must still be measurable — clipping the parent does not change its
 * `getBoundingClientRect()` — so this asserts clipping, not removal.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { TruncatedCardBody } from "@/components/cards/TruncatedCardBody";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("TruncatedCardBody measurement clipping", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const draw = async (constrainBody = true) => {
    await act(async () => {
      root.render(
        <TruncatedCardBody
          detailPageHref="/admissions/1"
          noBodyLink={false}
          constrainBody={constrainBody}
        >
          <p>Body copy</p>
        </TruncatedCardBody>,
      );
    });
  };

  const measure = () =>
    container.querySelector<HTMLElement>('[aria-hidden="true"]');

  it("clips the wrapper that holds the hidden measurement copy", async () => {
    await draw();

    const clone = measure();
    expect(clone).not.toBeNull();

    const wrapper = clone!.parentElement;
    expect(wrapper).not.toBeNull();
    expect(wrapper!.className.split(/\s+/)).toContain("overflow-clip");
  });

  it("still renders the measurement copy with its natural layout", async () => {
    await draw();

    const clone = measure()!;
    // Visibility, not display: a `display:none` clone would measure as zero.
    expect(clone.style.visibility).toBe("hidden");
    expect(clone.textContent).toContain("Body copy");
    expect(clone.className.split(/\s+/)).toContain("absolute");
  });

  it("does not introduce a measurement clone when the body is unconstrained", async () => {
    await draw(false);

    expect(measure()).toBeNull();
    expect(container.textContent).toContain("Body copy");
  });
});
