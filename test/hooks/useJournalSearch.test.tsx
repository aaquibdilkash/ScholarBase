/**
 * @vitest-environment jsdom
 *
 * The publication journal picker used to run its own effect: a 250 ms debounce,
 * a local 2-character floor, no cache, no stale-response protection, and an
 * error path that could leave the previous term's rows on screen.
 *
 * It now uses the same `useDebouncedSearch` primitive as the scholar pickers.
 * This suite covers the journal wiring; `useScholarSearch.test.tsx` covers the
 * shared debounce/cache/stale-response behavior in depth.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { searchJournalsForPicker } = vi.hoisted(() => ({
  searchJournalsForPicker: vi.fn(),
}));
vi.mock("@/app/actions/journals", () => ({ searchJournalsForPicker }));

import { useJournalSearch } from "@/hooks/useJournalSearch";

function Host({ term, limit = 6 }: { term: string; limit?: number }) {
  const { results, isSearching, isError } = useJournalSearch(term, limit);
  return (
    <span data-testid="state">
      {`results:${results.length}|${isSearching ? "searching" : "idle"}|${
        isError ? "error" : "ok"
      }`}
    </span>
  );
}

describe("useJournalSearch", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  const resolvers: Array<{
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
  }> = [];

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    searchJournalsForPicker.mockReset();
    resolvers.length = 0;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    searchJournalsForPicker.mockImplementation(
      () =>
        new Promise((resolve, reject) => resolvers.push({ resolve, reject })),
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

  const state = () =>
    container.querySelector('[data-testid="state"]')!.textContent;
  const waitDebounce = () =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
  const flush = () =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);
    });

  it("never queries below the shared search floor", async () => {
    draw("Na");
    await waitDebounce();
    await flush();

    expect(searchJournalsForPicker).not.toHaveBeenCalled();
    expect(state()).toBe("results:0|idle|ok");
  });

  it("queries once the debounce elapses and exposes the results", async () => {
    draw("Nature");
    expect(state()).toBe("results:0|searching|ok");
    await waitDebounce();
    await flush();

    resolvers[0].resolve([{ id: "j1" }]);
    await flush();

    expect(searchJournalsForPicker).toHaveBeenCalledWith("Nature", 6);
    expect(state()).toBe("results:1|idle|ok");
  });

  it("caches a repeated term instead of spending another search token", async () => {
    draw("Nature");
    await waitDebounce();
    await flush();
    resolvers[0].resolve([{ id: "j1" }]);
    await flush();

    draw("");
    draw("Nature");
    await waitDebounce();
    await flush();

    expect(searchJournalsForPicker).toHaveBeenCalledTimes(1);
    expect(state()).toBe("results:1|idle|ok");
  });

  it("clears the results and flags the error when the search fails", async () => {
    draw("Nature");
    await waitDebounce();
    await flush();

    await act(async () => {
      resolvers[0].reject(new Error("boom"));
      await flush();
    });

    expect(state()).toBe("results:0|idle|error");
  });
});
