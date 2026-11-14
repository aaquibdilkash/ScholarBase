/**
 * @vitest-environment jsdom
 *
 * Regression: on the last survey page the pager used a fixed three-column grid
 * with a `whitespace-nowrap` centre label. On a narrow card the range label
 * ("Question 11–13 of 13") overflowed its `minmax(0,1fr)` column and visually
 * collided with Back / Submit. The label now takes its own full-width row on
 * mobile, with the two controls sharing the row beneath it.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { SurveyPager } from "@/components/surveys/SurveyPager";

describe("SurveyPager layout", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
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

  it("stacks the range label above the controls on narrow screens", () => {
    draw(
      <SurveyPager
        onBack={() => {}}
        onNext={() => {}}
        submit
        submitLabel="Submit Response"
      >
        <span>Question 11–13 of 13</span>
      </SurveyPager>,
    );

    const row = container.firstElementChild as HTMLDivElement;
    // Wraps on mobile, single row from `sm` up.
    expect(row.className).toContain("flex-wrap");
    expect(row.className).toContain("sm:flex-nowrap");

    // The row owns its vertical rhythm on both edges. With only `pt-4` the
    // controls sat flush against whatever the page renders after the form (the
    // "results are available" banner on the survey detail page).
    expect(row.className).toContain("py-4");

    // DOM order stays Back, label, Submit; `order-*` only changes the visual
    // order inside the wrapping flex container.
    const [back, label, submit] = [
      row.children[0],
      row.children[1],
      row.children[2],
    ] as [HTMLButtonElement, HTMLDivElement, HTMLButtonElement];

    // The label owns a full-width, first (order-1) row so it cannot overlap.
    expect(label.textContent).toBe("Question 11–13 of 13");
    expect(label.className).toContain("w-full");
    expect(label.className).toContain("order-1");
    expect(label.className).toContain("text-xs");
    expect(label.className).toContain("sm:text-sm");

    // Controls share the row below; Submit grows to avoid a truncated label.
    expect(back.className).toContain("order-2");
    expect(back.className).toContain("whitespace-nowrap");
    expect(submit.className).toContain("order-3");
    expect(submit.className).toContain("flex-1");
    expect(submit.className).toContain("whitespace-nowrap");
    expect(submit.getAttribute("type")).toBe("submit");
  });

  it("keeps Next as its own button element, never the submit control", () => {
    draw(
      <SurveyPager onBack={() => {}} onNext={() => {}} nextLabel="Next">
        <span>Question 1–3 of 9</span>
      </SurveyPager>,
    );

    const buttons = [...container.querySelectorAll("button")];
    expect(buttons).toHaveLength(2);
    expect(buttons[0].getAttribute("type")).toBe("button");
    expect(buttons[1].getAttribute("type")).toBe("button");
    expect(buttons[1].textContent).toContain("Next");
    expect(container.querySelector('button[type="submit"]')).toBeNull();
  });
});
