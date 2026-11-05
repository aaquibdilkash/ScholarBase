/**
 * @vitest-environment jsdom
 *
 * Regression: survey text used `break-words break-all` together. `word-break:
 * break-all` wins and splits ordinary words mid-word ("m|aking"), even though
 * there was a perfectly good space to wrap at. Only genuinely unbreakable runs
 * (URLs, IDs) need to break, so these components must use `overflow-wrap:
 * break-word` (`break-words`) alone. Normal words then move to the next line
 * intact while long URLs still wrap inside the card's padding.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { SurveyQuestionCard } from "@/components/surveys/SurveyQuestionCard";
import { SurveyConsentGate } from "@/components/surveys/SurveyConsentGate";

const option = (id: string) => ({ id, value: id, label: id, order: 0 });

const question = {
  id: "q1",
  type: "MULTIPLE_CHOICE",
  title:
    "How strongly do you agree with the following statement: Technological progress is making us more globally connected?",
  required: true,
  options: [option("agree"), option("disagree")],
};

describe("Survey text wrapping", () => {
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

  it("keeps ordinary question words intact and still allows URL wrapping", () => {
    draw(
      <SurveyQuestionCard
        question={question as never}
        number={1}
        value=""
        onChange={() => {}}
        onCheckboxChange={() => {}}
        onMatrixChange={() => {}}
      />,
    );

    const title = container.querySelector("h3")!;
    expect(title.textContent).toContain("making us more globally connected");
    expect(title.className).toContain("break-words");
    expect(title.className).not.toContain("break-all");

    const optionLabel = container.querySelector("label span")!;
    expect(optionLabel.className).toContain("break-words");
    expect(optionLabel.className).not.toContain("break-all");
  });

  it("does not break consent prose mid-word either", () => {
    draw(
      <SurveyConsentGate
        consented={false}
        onChange={() => {}}
        consentText="By participating you agree that your responses may be used for research purposes."
      />,
    );

    const prose = container.querySelector("p")!;
    expect(prose.className).toContain("break-words");
    expect(prose.className).not.toContain("break-all");
  });
});
