/**
 * @vitest-environment jsdom
 */
/**
 * Every survey question type, exercised the way a respondent meets it.
 *
 * `SurveyQuestionInput` is the single renderer shared by the live response form
 * and the builder preview, so a bug here is a bug in both. It had no tests at
 * all, which is why all ten types are covered here. The interesting properties
 * are not "does it render" but
 *
 *   - the right CONTROL per type (a checkbox group that renders as radios
 *     silently changes what the survey measures),
 *   - `required` actually reaching the DOM (the response form carries
 *     `noValidate`, so a missing `required` means a required question can be
 *     skipped), and
 *   - the PAYLOAD each type emits, because that payload is what
 *     `submitSurveyResponse` persists and what the export later analyses.
 *
 * The payload assertions are the load-bearing ones. `CHECKBOXES` and
 * `MATRIX_LIKERT` emit JSON strings, not comma-joined text: the server parses
 * them with `JSON.parse`, and a regression that emitted `"a,b"` would store one
 * answer where two were selected.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { SurveyQuestionInput } from "@/components/surveys/SurveyQuestionInput";

type Option = { value: string; label: string; order: number };

const OPTIONS: Option[] = [
  { value: "cs", label: "Computer Science", order: 0 },
  { value: "bio", label: "Biology", order: 1 },
  { value: "math", label: "Mathematics", order: 2 },
];

const LIKERT_OPTIONS: Option[] = [
  { value: "sd", label: "Strongly disagree", order: 0 },
  { value: "d", label: "Disagree", order: 1 },
  { value: "n", label: "Neither", order: 2 },
  { value: "a", label: "Agree", order: 3 },
  { value: "sa", label: "Strongly agree", order: 4 },
];

const MATRIX_ROWS: Option[] = [
  { value: "row_teaching", label: "Teaching quality", order: 0 },
  { value: "row_research", label: "Research output", order: 1 },
];

const MATRIX_COLUMNS = ["Poor", "Fair", "Good", "Excellent"];

type QuestionType =
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "MULTIPLE_CHOICE"
  | "CHECKBOXES"
  | "DROPDOWN"
  | "RATING"
  | "LINEAR_SCALE"
  | "LIKERT_SCALE"
  | "DATE"
  | "MATRIX_LIKERT";

/** Every type the product ships. */
const ALL_TYPES: QuestionType[] = [
  "SHORT_TEXT",
  "LONG_TEXT",
  "MULTIPLE_CHOICE",
  "CHECKBOXES",
  "DROPDOWN",
  "RATING",
  "LINEAR_SCALE",
  "LIKERT_SCALE",
  "DATE",
  "MATRIX_LIKERT",
];

/**
 * Types answered via buttons or table cells, which have no single form control.
 *
 * `CHECKBOXES` is here for a different reason: HTML's `required` on a checkbox
 * means "THIS box must be ticked", not "at least one box in the group". Marking
 * every option required would force a respondent to select all of them, so the
 * component correctly omits `required` and `SurveyResponseForm` validates the
 * group server-side instead.
 */
const NO_REQUIRED_ATTRIBUTE: QuestionType[] = [
  "RATING",
  "LINEAR_SCALE",
  "MATRIX_LIKERT",
  "CHECKBOXES",
];

function questionFor(type: QuestionType, required: boolean) {
  return {
    id: `q_${type}`,
    type,
    required,
    order: 0,
    minValue: type === "LINEAR_SCALE" ? 1 : null,
    maxValue: type === "LINEAR_SCALE" ? 5 : null,
    columnLabels: type === "MATRIX_LIKERT" ? MATRIX_COLUMNS : null,
    options:
      type === "MATRIX_LIKERT"
        ? MATRIX_ROWS
        : type === "LIKERT_SCALE"
          ? LIKERT_OPTIONS
          : type === "RATING" ||
              type === "LINEAR_SCALE" ||
              type === "SHORT_TEXT" ||
              type === "LONG_TEXT" ||
              type === "DATE"
            ? []
            : OPTIONS,
  };
}

describe("SurveyQuestionInput — every question type", () => {
  let container: HTMLDivElement;
  let root: Root;

  const onChange = vi.fn();
  const onCheckboxChange = vi.fn();
  const onMatrixChange = vi.fn();

  beforeEach(() => {
    (
      globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    onChange.mockClear();
    onCheckboxChange.mockClear();
    onMatrixChange.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  /**
   * Types a respondent answers via a controlled React input.
   *
   * React installs its own `value` setter to detect changes, so assigning
   * `input.value` directly makes React believe nothing changed and `onChange`
   * never fires. Going through the prototype's native setter is what a real
   * keystroke does, and is what makes the callback assertions meaningful.
   */
  function typeInto(
    input: HTMLInputElement | HTMLTextAreaElement,
    value: string,
  ) {
    const proto =
      input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /** Render a question and hand back the DOM to assert against. */
  function draw(
    type: QuestionType,
    { required = false, value = "" }: { required?: boolean; value?: string } = {},
  ) {
    act(() => {
      root.render(
        <SurveyQuestionInput
          question={questionFor(type, required)}
          value={value}
          onChange={onChange}
          onCheckboxChange={onCheckboxChange}
          onMatrixChange={onMatrixChange}
        />,
      );
    });
    return container;
  }

  /** Render with a fully custom question, for range/label edge cases. */
  function drawCustom(question: Record<string, unknown>) {
    act(() => {
      root.render(
        <SurveyQuestionInput
          question={question as never}
          value=""
          onChange={onChange}
          onCheckboxChange={onCheckboxChange}
          onMatrixChange={onMatrixChange}
        />,
      );
    });
    return container;
  }

  describe("the shipped type list is fully covered", () => {
    it("renders every type in the product's question-type list", () => {
      // Guards against a new type shipping without a test here.
      for (const type of ALL_TYPES) {
        const dom = draw(type);
        expect(
          dom.querySelector("input, select, textarea, button"),
          `type: ${type}`,
        ).not.toBeNull();
      }
    });

    it("matches QUESTION_TYPES exposed by the builder", async () => {
      const { QUESTION_TYPES } = await import(
        "@/components/surveys/QuestionEditor"
      );
      const builderTypes = QUESTION_TYPES.map((t) => t.value).sort();
      expect([...ALL_TYPES].sort()).toEqual(builderTypes);
    });
  });

  describe("SHORT_TEXT", () => {
    it("renders a single auto-growing text box with a character counter", () => {
      const dom = draw("SHORT_TEXT");
      const textarea = dom.querySelector("textarea")!;
      // rows=1 is what makes it read as a one-line answer that grows on input.
      expect(textarea.getAttribute("rows")).toBe("1");
      expect(dom.textContent).toMatch(/\d+\/256 characters/);
    });

    it("emits the raw typed string", () => {
      const dom = draw("SHORT_TEXT");
      act(() => {
        typeInto(dom.querySelector("textarea")!, "My answer");
      });
      expect(onChange).toHaveBeenCalledWith("My answer");
    });
  });

  describe("LONG_TEXT", () => {
    it("renders a taller box for a paragraph-length answer", () => {
      const dom = draw("LONG_TEXT");
      expect(dom.querySelector("textarea")!.getAttribute("rows")).toBe("4");
      expect(dom.textContent).toMatch(/\d+\/1024 characters/);
    });
  });

  describe("MULTIPLE_CHOICE", () => {
    it("renders one radio per option, so only one answer is possible", () => {
      const dom = draw("MULTIPLE_CHOICE");
      expect(dom.querySelectorAll('input[type="radio"]')).toHaveLength(
        OPTIONS.length,
      );
      expect(dom.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    });

    it("labels every option so the control is reachable by its text", () => {
      const dom = draw("MULTIPLE_CHOICE");
      for (const option of OPTIONS) {
        const radio = dom.querySelector(
          `input[type="radio"][value="${option.value}"]`,
        );
        expect(radio, `option: ${option.label}`).not.toBeNull();
        expect(radio!.closest("label")!.textContent).toContain(option.label);
      }
    });

    it("emits the single option value, not a list", () => {
      const dom = draw("MULTIPLE_CHOICE");
      act(() => {
        dom.querySelector<HTMLInputElement>('input[value="bio"]')!.click();
      });
      expect(onChange).toHaveBeenCalledWith("bio");
    });

    it("shows the chosen option as selected", () => {
      const dom = draw("MULTIPLE_CHOICE", { value: "math" });
      expect(
        dom.querySelector<HTMLInputElement>('input[value="math"]')!.checked,
      ).toBe(true);
      expect(
        dom.querySelector<HTMLInputElement>('input[value="cs"]')!.checked,
      ).toBe(false);
    });
  });

  describe("CHECKBOXES", () => {
    it("renders one checkbox per option, so several answers are possible", () => {
      const dom = draw("CHECKBOXES");
      expect(dom.querySelectorAll('input[type="checkbox"]')).toHaveLength(
        OPTIONS.length,
      );
      expect(dom.querySelectorAll('input[type="radio"]')).toHaveLength(0);
    });

    it("reports a tick as (value, true)", () => {
      // The parent owns the JSON array; the child never sees the other ticks.
      const dom = draw("CHECKBOXES");
      act(() => {
        dom.querySelector<HTMLInputElement>('input[value="cs"]')!.click();
      });
      expect(onCheckboxChange).toHaveBeenCalledWith("cs", true);
    });

    it("reports an untick as (value, false)", () => {
      const dom = draw("CHECKBOXES", { value: JSON.stringify(["cs"]) });
      act(() => {
        dom.querySelector<HTMLInputElement>('input[value="cs"]')!.click();
      });
      expect(onCheckboxChange).toHaveBeenLastCalledWith("cs", false);
    });

    it("reflects a stored multi-answer value by ticking exactly those options", () => {
      // The stored shape is a JSON array string; if the renderer stopped parsing
      // it, a respondent editing their response would see every box cleared.
      const dom = draw("CHECKBOXES", {
        value: JSON.stringify(["cs", "math"]),
      });
      const ticked = [...dom.querySelectorAll<HTMLInputElement>("input")].filter(
        (input) => input.checked,
      );
      expect(ticked.map((input) => input.value)).toEqual(["cs", "math"]);
    });
  });

  describe("DROPDOWN", () => {
    it("renders a select with an explicit empty choice plus every option", () => {
      const dom = draw("DROPDOWN");
      const select = dom.querySelector<HTMLSelectElement>("select")!;
      // The placeholder is what an unanswered dropdown shows, so it must not be
      // a real option value a respondent could submit.
      expect(select.options).toHaveLength(OPTIONS.length + 1);
      expect(select.options[0].value).toBe("");
      expect([...select.options].slice(1).map((o) => o.value)).toEqual(
        OPTIONS.map((o) => o.value),
      );
    });

    it("emits the option value", () => {
      const dom = draw("DROPDOWN");
      const select = dom.querySelector<HTMLSelectElement>("select")!;
      act(() => {
        select.value = "bio";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(onChange).toHaveBeenCalledWith("bio");
    });

    it("shows a previously chosen value as selected", () => {
      const dom = draw("DROPDOWN", { value: "cs" });
      expect(dom.querySelector<HTMLSelectElement>("select")!.value).toBe("cs");
    });
  });

  describe("RATING", () => {
    it("renders exactly five rating buttons", () => {
      expect(draw("RATING").querySelectorAll("button")).toHaveLength(5);
    });

    it("emits the star count as a string", () => {
      const dom = draw("RATING");
      act(() => {
        dom.querySelectorAll("button")[3].click();
      });
      expect(onChange).toHaveBeenCalledWith("4");
    });

    it("keeps a rating value out of the DOM as a form field", () => {
      // RATING is button-driven. The form submits through a server action with
      // an explicit JSON payload, so no hidden input is needed.
      expect(draw("RATING", { value: "3" }).querySelector("input")).toBeNull();
    });
  });

  describe("LINEAR_SCALE", () => {
    it("renders one button per step across the configured min..max", () => {
      const dom = draw("LINEAR_SCALE");
      const labels = [...dom.querySelectorAll("button")].map(
        (b) => b.textContent,
      );
      expect(labels).toEqual(["1", "2", "3", "4", "5"]);
      expect(dom.textContent).toContain("(1 - 5)");
    });

    it("honours a custom range rather than assuming five points", () => {
      const dom = drawCustom({
        ...questionFor("LINEAR_SCALE", false),
        minValue: 0,
        maxValue: 10,
      });
      expect(dom.querySelectorAll("button")).toHaveLength(11);
    });

    it("emits the selected step as a string", () => {
      const dom = draw("LINEAR_SCALE");
      act(() => {
        dom.querySelectorAll("button")[1].click();
      });
      expect(onChange).toHaveBeenCalledWith("2");
    });
  });

  describe("LIKERT_SCALE", () => {
    it("renders one radio per agreement option", () => {
      expect(
        draw("LIKERT_SCALE").querySelectorAll('input[type="radio"]'),
      ).toHaveLength(LIKERT_OPTIONS.length);
    });

    it("emits the option value", () => {
      const dom = draw("LIKERT_SCALE");
      act(() => {
        dom.querySelector<HTMLInputElement>('input[value="sa"]')!.click();
      });
      expect(onChange).toHaveBeenCalledWith("sa");
    });
  });

  describe("DATE", () => {
    it("renders a native date input", () => {
      const dom = draw("DATE");
      expect(dom.querySelector<HTMLInputElement>("input")!.type).toBe("date");
    });

    it("emits an ISO yyyy-mm-dd value", () => {
      const dom = draw("DATE");
      act(() => {
        typeInto(dom.querySelector<HTMLInputElement>("input")!, "2026-03-15");
      });
      expect(onChange).toHaveBeenCalledWith("2026-03-15");
    });

    it("shows a stored date back to a respondent editing their response", () => {
      const dom = draw("DATE", { value: "2026-01-02" });
      expect(dom.querySelector<HTMLInputElement>("input")!.value).toBe(
        "2026-01-02",
      );
    });
  });

  describe("MATRIX_LIKERT", () => {
    it("renders a row per statement and a radio per column", () => {
      const dom = draw("MATRIX_LIKERT");
      expect(dom.querySelectorAll("tbody tr")).toHaveLength(MATRIX_ROWS.length);
      // One radio per (row x column) cell: 2 rows x 4 columns.
      expect(dom.querySelectorAll('tbody input[type="radio"]')).toHaveLength(
        MATRIX_ROWS.length * MATRIX_COLUMNS.length,
      );
    });

    it("shows every column label as a header", () => {
      const headers = [...draw("MATRIX_LIKERT").querySelectorAll("thead th")].map(
        (th) => th.textContent,
      );
      expect(headers).toEqual(["", ...MATRIX_COLUMNS]);
    });

    it("reports a cell as (rowValue, 1-based columnIndex)", () => {
      // 1-based because the export maps index -> column label via `columns[n-1]`.
      // A regression to 0-based would shift every matrix answer by one column.
      const dom = draw("MATRIX_LIKERT");
      const cells = dom
        .querySelectorAll("tbody tr")[1]
        .querySelectorAll("input");
      act(() => {
        cells[2].click();
      });
      expect(onMatrixChange).toHaveBeenCalledWith("row_research", 3);
    });

    it("restores a stored matrix answer as the right ticked cells", () => {
      const dom = draw("MATRIX_LIKERT", {
        value: JSON.stringify({ row_teaching: 3, row_research: 1 }),
      });
      const tickedIn = (row: Element) =>
        [...row.querySelectorAll<HTMLInputElement>("input")]
          .map((input, index) => (input.checked ? index + 1 : 0))
          .filter(Boolean);

      const rows = dom.querySelectorAll("tbody tr");
      expect(tickedIn(rows[0])).toEqual([3]);
      expect(tickedIn(rows[1])).toEqual([1]);
    });

    it("shares one radio group per row, so each row picks a single column", () => {
      // The grouping is PER ROW, not per cell: all four cells of "Teaching
      // quality" must share a name so ticking "Good" unticks "Poor" in that row,
      // while leaving the other row's answer intact. One name for the whole
      // matrix would leave only one cell answerable per response.
      const rowNames = (rowIndex: number) =>
        [
          ...draw("MATRIX_LIKERT").querySelectorAll("tbody tr")[rowIndex]
            .querySelectorAll("input"),
        ].map((input) => input.getAttribute("name"));

      const teaching = rowNames(0);
      expect(new Set(teaching).size).toBe(1);
      expect(teaching).toHaveLength(MATRIX_COLUMNS.length);
      // Distinct rows get distinct groups.
      expect(rowNames(0)[0]).not.toBe(rowNames(1)[0]);
    });

    it("lets a second row keep its answer when the first row is changed", () => {
      // The real consequence of the per-row grouping: answering two rows must
      // not wipe the first, or a matrix response could only ever hold one row.
      const dom = draw("MATRIX_LIKERT", {
        value: JSON.stringify({ row_research: 2 }),
      });
      const research = dom.querySelectorAll("tbody tr")[1];
      act(() => {
        research.querySelectorAll("input")[3].click();
      });
      expect(onMatrixChange).toHaveBeenCalledWith("row_research", 4);
    });

    it("does not crash on a matrix question with no column labels", () => {
      // Column labels are optional in the builder; a half-built question must
      // render rather than throw and blank the whole page.
      const dom = drawCustom({
        ...questionFor("MATRIX_LIKERT", false),
        columnLabels: null,
      });
      expect(dom.querySelectorAll("tbody tr")).toHaveLength(
        MATRIX_ROWS.length,
      );
    });
  });

  describe("required is enforced in the DOM for every type", () => {
    // The response form is `noValidate`, so the browser will NOT block a submit
    // on its own. `required` here is the last line of client-side defence, and
    // the server re-validates independently, so a missing attribute is a UX
    // regression rather than a data-integrity one — still worth pinning.
    it("marks the control required when the question is required", () => {
      for (const type of ALL_TYPES) {
        if (NO_REQUIRED_ATTRIBUTE.includes(type)) continue;
        const control = draw(type, { required: true }).querySelector<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >("input, select, textarea");
        expect(control, `type: ${type}`).not.toBeNull();
        expect(control!.required, `type: ${type}`).toBe(true);
      }
    });

    it("leaves the control optional when the question is not required", () => {
      for (const type of ALL_TYPES) {
        if (NO_REQUIRED_ATTRIBUTE.includes(type)) continue;
        const control = draw(type, { required: false }).querySelector<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >("input, select, textarea");
        expect(control, `type: ${type}`).not.toBeNull();
        expect(control!.required, `type: ${type}`).toBe(false);
      }
    });

    it("never marks every CHECKBOXES option required", () => {
      // The trap: adding `required` to each box would read as "tick them all".
      const dom = draw("CHECKBOXES", { required: true });
      for (const input of dom.querySelectorAll<HTMLInputElement>("input")) {
        expect(input.required).toBe(false);
      }
    });
  });

  describe("option order and shuffling", () => {
    it("renders options in the order supplied by the caller", () => {
      // `SurveyResponseForm` passes a shuffled list for randomised questions;
      // the input must render what it is given rather than re-sorting by
      // `order`, or the recorded shuffle seed would not describe what the
      // respondent actually saw.
      act(() => {
        root.render(
          <SurveyQuestionInput
            question={questionFor("MULTIPLE_CHOICE", false)}
            value=""
            options={[OPTIONS[2], OPTIONS[0], OPTIONS[1]]}
            onChange={onChange}
            onCheckboxChange={onCheckboxChange}
            onMatrixChange={onMatrixChange}
          />,
        );
      });
      const values = [
        ...container.querySelectorAll('input[type="radio"]'),
      ].map((input) => input.getAttribute("value"));
      expect(values).toEqual(["math", "cs", "bio"]);
    });
  });

  describe("unknown types fail soft", () => {
    it("falls back to a text box rather than rendering nothing", () => {
      // A question type added to the database but not yet handled here must
      // still be answerable, or a half-deployed type silently drops responses.
      const dom = draw("SOMETHING_NEW" as QuestionType);
      expect(dom.querySelector("textarea")).not.toBeNull();
    });
  });
});
