/**
 * @vitest-environment jsdom
 *
 * `useListSearch` is the one place list pages read/write the search term.
 * Lists fetch their own rows from `appliedQuery`; this hook debounces typing,
 * floors terms at the shared minimum, applies an explicit submit immediately,
 * and mirrors the term into the URL with a shallow `replaceState` (no RSC
 * navigation, so no list skeleton).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { useListSearch } from "@/hooks/useListSearch";

function Host({ initialQuery }: { initialQuery?: string }) {
  const {
    query,
    setQuery,
    appliedQuery,
    isDebouncing,
    handleSearch,
    handleClear,
  } = useListSearch("/help", initialQuery);

  return (
    <>
      <form onSubmit={handleSearch}>
        <input
          id="box"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit" id="submit">
          search
        </button>
      </form>
      <button type="button" id="clear" onClick={handleClear}>
        clear
      </button>
      <span data-testid="state">
        {`${appliedQuery}|${isDebouncing ? "debouncing" : "idle"}`}
      </span>
    </>
  );
}

describe("useListSearch", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/help?tab=latest");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    window.history.replaceState({}, "", "/");
  });

  const draw = (initialQuery?: string) =>
    act(() => {
      root.render(<Host initialQuery={initialQuery} />);
    });

  const state = () =>
    container.querySelector('[data-testid="state"]')!.textContent;

  const type = (value: string) =>
    act(() => {
      const input = container.querySelector<HTMLInputElement>("#box")!;
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!;
      setValue.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

  const click = (selector: string) =>
    act(() => {
      container
        .querySelector(selector)!
        .dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true }),
        );
    });

  const submit = () =>
    act(() => {
      container
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

  const waitDebounce = () =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

  it("starts on the term the server rendered", () => {
    window.history.replaceState({}, "", "/help?q=genomics");
    draw("genomics");

    expect(state()).toBe("genomics|idle");
  });

  it("applies a 3+ character term after the debounce", async () => {
    draw();
    type("demo");
    expect(state()).toBe("|debouncing");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });
    expect(state()).toBe("|debouncing");

    await waitDebounce();
    expect(state()).toBe("demo|idle");
  });

  it("never applies a term below the shared floor", async () => {
    draw();
    type("ab");

    expect(state()).toBe("|idle");
    await waitDebounce();
    expect(state()).toBe("|idle");
  });

  it("drops back to the unfiltered list when a term falls below the floor", () => {
    window.history.replaceState({}, "", "/help?q=genomics");
    draw("genomics");

    type("ge");

    expect(state()).toBe("|idle");
  });

  it("applies an explicit submit immediately, skipping the debounce", () => {
    draw();
    type("demo");
    submit();

    expect(state()).toBe("demo|idle");
  });

  it("trims the term before applying it", async () => {
    draw();
    type("  demo  ");
    await waitDebounce();

    expect(state()).toBe("demo|idle");
  });

  it("clears the box and the URL param, keeping unrelated params", () => {
    window.history.replaceState({}, "", "/help?tab=latest&q=demo");
    draw("demo");

    click("#clear");

    expect(state()).toBe("|idle");
    expect(window.location.search).toBe("?tab=latest");
  });

  it("mirrors the applied term into the URL without navigating", async () => {
    draw();
    type("demo");
    await waitDebounce();

    expect(window.location.search).toBe("?tab=latest&q=demo");
    expect(window.location.pathname).toBe("/help");
  });
});
