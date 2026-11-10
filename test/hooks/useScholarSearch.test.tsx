/**
 * @vitest-environment jsdom
 *
 * The two scholar typeaheads (message recipient + `@mention`) used to run their
 * own effects: a 500 ms debounce in one, a local 2-character floor in the other,
 * no cache, and no stale-response protection. `useScholarSearch` owns the
 * debounce, the shared minimum length, and React Query's keyed cache so the two
 * cannot drift from each other or from the list/inbox searches.
 *
 * `searchScholarsForPicker` is mocked with manually-controlled promises so
 * React Query's fetch-state settlement can be flushed deterministically,
 * mirroring `useInboxSearch.test.tsx`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { searchScholarsForPicker } = vi.hoisted(() => ({
  searchScholarsForPicker: vi.fn(),
}));
vi.mock("@/app/actions/scholars", () => ({ searchScholarsForPicker }));

import { useScholarSearch } from "@/hooks/useScholarSearch";

function Host({ term, limit = 6 }: { term: string; limit?: number }) {
  const { results, isSearching } = useScholarSearch(term, limit);
  return (
    <span data-testid="state">
      {`results:${results.length}|${isSearching ? "searching" : "idle"}`}
    </span>
  );
}

describe("useScholarSearch", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  const resolvers: Array<(value: unknown) => void> = [];

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    searchScholarsForPicker.mockReset();
    resolvers.length = 0;
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    searchScholarsForPicker.mockImplementation(() =>
      new Promise((resolve) => resolvers.push(resolve)),
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    queryClient.clear();
    vi.useRealTimers();
  });

  const draw = (term: string, limit?: number) =>
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Host term={term} limit={limit} />
        </QueryClientProvider>,
      );
    });

  const state = () => container.querySelector('[data-testid="state"]')!.textContent;
  const waitDebounce = () =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
  // React Query schedules fetch-state settlement on setTimeout(0); flush two
  // macrotasks so isFetching settles before assertions.
  const flush = () =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);
    });

  it("never queries below the shared search floor", async () => {
    draw("ab");
    await waitDebounce();
    await flush();

    expect(searchScholarsForPicker).not.toHaveBeenCalled();
    expect(state()).toBe("results:0|idle");
  });

  it("queries once the debounce elapses and exposes the results", async () => {
    draw("ali");
    expect(state()).toBe("results:0|searching");
    await waitDebounce();
    await flush();

    resolvers[0]([{ id: "u1" }]);
    await flush();

    expect(searchScholarsForPicker).toHaveBeenCalledWith("ali", 6);
    expect(state()).toBe("results:1|idle");
  });

  it("does not re-query when only trailing whitespace changes", async () => {
    draw("ali");
    await waitDebounce();
    await flush();
    resolvers[0]([{ id: "u1" }]);
    await flush();

    draw("ali ");
    await waitDebounce();
    await flush();

    expect(searchScholarsForPicker).toHaveBeenCalledTimes(1);
    expect(state()).toBe("results:1|idle");
  });

  it("caches a repeated term instead of spending another search token", async () => {
    draw("ali");
    await waitDebounce();
    await flush();
    resolvers[0]([{ id: "u1" }]);
    await flush();

    draw("");
    draw("ali");
    await waitDebounce();
    await flush();

    expect(searchScholarsForPicker).toHaveBeenCalledTimes(1);
    expect(state()).toBe("results:1|idle");
  });

  it("ignores a stale response for an older term", async () => {
    draw("ali");
    await waitDebounce();
    await flush();
    expect(searchScholarsForPicker).toHaveBeenCalledTimes(1);

    draw("alice");
    await waitDebounce();
    await flush();
    expect(searchScholarsForPicker).toHaveBeenCalledTimes(2);

    // The newer term's response arrives first.
    await act(async () => {
      resolvers[1]([{ id: "new-1" }, { id: "new-2" }]);
      await flush();
    });
    expect(state()).toBe("results:2|idle");

    // The slower older response arrives last and must not replace it.
    await act(async () => {
      resolvers[0]([]);
      await flush();
    });
    expect(state()).toBe("results:2|idle");
  });

  it("clears the results when the term drops below the floor mid-request", async () => {
    draw("ali");
    await waitDebounce();
    await flush();
    expect(searchScholarsForPicker).toHaveBeenCalledTimes(1);

    draw("a");
    expect(state()).toBe("results:0|idle");

    await act(async () => {
      resolvers[0]([{ id: "late" }]);
      await flush();
    });
    expect(state()).toBe("results:0|idle");
  });
});
