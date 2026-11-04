/**
 * @vitest-environment jsdom
 *
 * Clearing a list-page search box and pressing Enter is a real action only when
 * a search is currently applied — it removes `?q` and restores the unfiltered
 * list. With no active search there is nothing to clear, so an empty box keeps
 * the normal "enter at least 3 characters" guard.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { SearchInput } from "@/components/ui/SearchInput";

const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ toast }),
}));

describe("SearchInput clear-on-submit", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    toast.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const draw = (value: string, activeQuery?: string) =>
    act(() => {
      root.render(
        <form onSubmit={(event) => event.preventDefault()}>
          <SearchInput
            value={value}
            activeQuery={activeQuery}
            onChange={() => {}}
            placeholder="Search..."
          />
        </form>,
      );
    });

  const pressEnter = () => {
    let notPrevented = true;
    act(() => {
      const input = container.querySelector("input")!;
      notPrevented = input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
    });
    return notPrevented;
  };

  it("lets an empty box submit while a search is active, so ?q can be cleared", () => {
    draw("", "genomics");

    expect(pressEnter()).toBe(true);
    expect(toast).not.toHaveBeenCalled();
  });

  it("lets the search button clear an active search too", () => {
    draw("", "genomics");
    let notPrevented = true;
    act(() => {
      const button = container.querySelector("button")!;
      notPrevented = button.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });

    expect(notPrevented).toBe(true);
    expect(toast).not.toHaveBeenCalled();
  });

  it("shows the normal toast for an empty box when no search is active", () => {
    draw("");

    expect(pressEnter()).toBe(false);
    expect(toast).toHaveBeenCalledWith(
      "Please enter at least 3 characters to search.",
    );
  });

  it("treats a whitespace-only active query as no search", () => {
    draw("", "   ");

    expect(pressEnter()).toBe(false);
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it("still blocks a 1-2 character term even with an active search", () => {
    draw("ab", "genomics");

    expect(pressEnter()).toBe(false);
    expect(toast).toHaveBeenCalledTimes(1);
  });
});
