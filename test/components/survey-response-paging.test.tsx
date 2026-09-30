/**
 * @vitest-environment jsdom
 *
 * TEMPORARY diagnostic: does clicking "Next" in the live survey response form
 * scroll the window to the top of the newly rendered page?
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/app/actions/surveys", () => ({
  submitSurveyResponse: vi.fn(async () => ({ success: true })),
}));
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock("@/components/interactions/AuthModal", () => ({
  useAuthModal: () => ({ openAuthModal: vi.fn() }),
}));

import { SurveyResponseForm } from "@/components/surveys/SurveyResponseForm";

const option = (id: string) => ({ id, value: id, label: id, order: 0 });
const question = (id: string, required = false) => ({
  id,
  type: "MULTIPLE_CHOICE",
  title: `Question ${id}`,
  required,
  order: 0,
  minValue: null,
  maxValue: null,
  options: [option(`${id}-a`)],
});

let container: HTMLDivElement;
let root: Root;
let scrollCalls: Array<{ top: number }>;

function rect(top: number): DOMRect {
  return {
    top,
    height: 0,
    bottom: top,
    left: 0,
    right: 0,
    width: 0,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

beforeEach(() => {
  scrollCalls = [];
    // jsdom has no layout engine, so stub the geometry the effect reads.
    window.scrollY = 900;
    window.scrollTo = ((arg: number | ScrollToOptions) => {
      const top = typeof arg === "number" ? arg : (arg?.top ?? 0);
      scrollCalls.push({ top });
    }) as typeof window.scrollTo;

    // Desktop layout: <main> is the scroller, so this is the path that used to
    // be a no-op when the form called window.scrollTo directly.
    const main = document.createElement("main");
    main.id = "sb-main-scroll";
    main.style.overflowY = "auto";
    Object.defineProperty(main, "scrollTop", {
      configurable: true,
      writable: true,
      value: 0,
    });
    main.scrollTo = ((arg: number | ScrollToOptions) => {
      const top = typeof arg === "number" ? arg : (arg?.top ?? 0);
      scrollCalls.push({ top });
    }) as HTMLElement["scrollTo"];
    document.body.appendChild(main);

    container = document.createElement("div");
    main.appendChild(container);
    root = createRoot(container);
  });

describe("survey response page navigation scroll", () => {
  it("scrolls to the anchor when Next advances the page, and not on mount", async () => {
    // buildSurveyPages caps section-free pages at 3 questions, so 6 gives 2 pages.
    const questions = Array.from({ length: 6 }, (_, i) => question(`q${i + 1}`));

    await act(async () => {
      root.render(
        <SurveyResponseForm
          surveyId="s1"
          questions={questions as never}
          blocks={[]}
          privacy="ANONYMOUS"
          hasResponded={false}
          response={null}
        />,
      );
    });

    // jsdom reports 0 for every rect; make the anchor look like it sits far
    // down the document so a working scroll produces a distinctive value.
    const main = document.getElementById("sb-main-scroll")!;
    main.getBoundingClientRect = () => rect(64);
    const realGetRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      if (this.tagName === "DIV" && this.getAttribute("aria-hidden") === "true") {
        return rect(300);
      }
      return realGetRect.call(this);
    };

    // No scroll should have happened from mounting alone.
    expect(scrollCalls).toEqual([]);

    const next = [...container.querySelectorAll("button")].find(
      (b) => b.textContent?.trim().startsWith("Next"),
    );
    expect(next, "Next button should render").toBeTruthy();

    await act(async () => {
      next!.click();
    });

    // Anchor sits 300px down the viewport, <main> starts at 64 and is at
    // scrollTop 0, minus the 16px gap: 300 - 64 - 16 = 220. Crucially this is
    // the CONTAINER scrolling, not the window.
    expect(scrollCalls).toEqual([{ top: 220 }]);

    Element.prototype.getBoundingClientRect = realGetRect;
  });
});
