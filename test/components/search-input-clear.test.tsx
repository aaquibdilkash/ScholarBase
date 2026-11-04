/**
 * @vitest-environment jsdom
 *
 * Clearing a list-page search box is a real action only when a search is
 * currently applied — the clear button (and Enter on an empty box) removes
 * `?q` and restores the unfiltered list. With no active search there is nothing
 * to clear, so an empty box keeps the normal "enter at least 3 characters"
 * guard.
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

  const draw = (
    value: string,
    {
      activeQuery,
      onClear,
      onSubmit,
      loading,
    }: {
      activeQuery?: string;
      onClear?: () => void;
      onSubmit?: () => void;
      loading?: boolean;
    } = {},
  ) =>
    act(() => {
      root.render(
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit?.();
          }}
        >
          <SearchInput
            value={value}
            activeQuery={activeQuery}
            onClear={onClear}
            loading={loading}
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

  const clearButton = () =>
    container.querySelector<HTMLButtonElement>('button[aria-label="Clear search"]');

  it("lets an empty box submit while a search is active, so ?q can be cleared", () => {
    draw("", { activeQuery: "genomics" });

    expect(pressEnter()).toBe(true);
    expect(toast).not.toHaveBeenCalled();
  });

  it("lets the search button clear an active search too", () => {
    draw("", { activeQuery: "genomics" });
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
    draw("", { activeQuery: "   " });

    expect(pressEnter()).toBe(false);
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it("still blocks a 1-2 character term even with an active search", () => {
    draw("ab", { activeQuery: "genomics" });

    expect(pressEnter()).toBe(false);
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it("clears the box and the applied search from the clear button", () => {
    const onClear = vi.fn();
    const onSubmit = vi.fn();
    draw("demo", { activeQuery: "demo", onClear, onSubmit });

    const button = clearButton();
    expect(button).not.toBeNull();
    act(() => {
      button!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });

    expect(onClear).toHaveBeenCalledTimes(1);
    // A clear button must never submit the form (that would re-search "demo").
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("hides the clear button for an empty box", () => {
    draw("", { activeQuery: "demo", onClear: vi.fn() });

    expect(clearButton()).toBeNull();
  });

  it("hides the clear button when the caller cannot handle clearing", () => {
    draw("demo");

    expect(clearButton()).toBeNull();
  });

  it("marks the search button busy while a live search runs", () => {
    draw("demo", { activeQuery: "demo", loading: true });

    const button = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Search"]',
    );
    expect(button?.getAttribute("aria-busy")).toBe("true");
    expect(button?.querySelector("svg")).not.toBeNull();
  });

  it("is idle when no live search is running", () => {
    draw("demo", { activeQuery: "demo" });

    expect(
      container
        .querySelector('button[aria-label="Search"]')
        ?.getAttribute("aria-busy"),
    ).toBeNull();
  });

  it("explains the minimum length while the term is too short", () => {
    draw("ab", { activeQuery: "ab" });

    expect(container.textContent).toContain(
      "Type at least 3 characters to search.",
    );
  });

  it("hides the hint once the term is searchable", () => {
    draw("abc", { activeQuery: "abc" });

    expect(container.textContent).not.toContain("Type at least");
  });
});
