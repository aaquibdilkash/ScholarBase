/**
 * @vitest-environment jsdom
 *
 * A `Select` owns exactly one visible frame: the trigger button. The wrapper
 * only positions the menu, so passing a bordered control class (as the admin
 * toolbars do) must not paint a second box around it.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { Select } from "@/components/ui/Select";

describe("Select", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("keeps control styling on the trigger and layout classes on the wrapper", () => {
    act(() => {
      root.render(
        <Select
          id="status-filter"
          value="all"
          onChange={() => {}}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5"
          containerClassName="min-w-0 w-full"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
        </Select>,
      );
    });

    const wrapper = container.querySelector("[data-select-root]");
    const trigger = container.querySelector("button");

    expect(wrapper).not.toBeNull();
    expect(trigger).not.toBeNull();
    expect(wrapper?.className).toContain("min-w-0");
    expect(wrapper?.className).toContain("w-full");
    expect(wrapper?.className).not.toContain("border");
    expect(wrapper?.className).not.toContain("rounded-lg");
    expect(trigger?.className).toContain("rounded-lg");
    expect(trigger?.className).toContain("border-slate-300");
  });
});
