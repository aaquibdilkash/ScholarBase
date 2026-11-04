/**
 * @vitest-environment jsdom
 *
 * The conversation search used to let a slow response overwrite the list after
 * the box was cleared (showing "No conversations found." over an empty search)
 * and searched 1-2 character terms the server drops. `useInboxSearch` owns the
 * debounce, the shared minimum length, and stale-response cancellation.
 *
 * searchInbox is mocked with manually-controlled promises so React Query's
 * fetch-state settlement can be flushed with macrotasks, mirroring the pattern
 * in cache-backed-list-search.test.tsx.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { searchInbox } = vi.hoisted(() => ({ searchInbox: vi.fn() }));
vi.mock("@/app/actions/messages", () => ({ searchInbox }));

import { useInboxSearch } from "@/hooks/useInboxSearch";

function Host({ userId, query }: { userId?: string; query: string }) {
  const { results, isSearching, searchNow } = useInboxSearch(userId, query);
  const list = results === null ? "inbox" : `results:${results.length}`;
  return (
    <div>
      <span data-testid="state">
        {`${list}|${isSearching ? "searching" : "idle"}`}
      </span>
      <button type="button" id="now" onClick={searchNow}>
        search now
      </button>
    </div>
  );
}

describe("useInboxSearch", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  const resolvers: Array<(value: unknown) => void> = [];

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    searchInbox.mockReset();
    resolvers.length = 0;
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Manually-controlled promise: the test decides when each fetch settles so
    // React Query's fetch-state can be flushed deterministically.
    searchInbox.mockImplementation(() =>
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

  const draw = (userId: string | undefined, query: string) =>
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Host userId={userId} query={query} />
        </QueryClientProvider>,
      );
    });

  const state = () =>
    container.querySelector('[data-testid="state"]')!.textContent;
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
  const pressSearchNow = () =>
    act(() => {
      container
        .querySelector<HTMLButtonElement>("#now")!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

  it("never queries below the shared search floor", async () => {
    draw("u1", "ab");
    await waitDebounce();
    await flush();

    expect(searchInbox).not.toHaveBeenCalled();
    expect(state()).toBe("inbox|idle");
  });

  it("queries once the debounce elapses and exposes the results", async () => {
    draw("u1", "demo");
    expect(state()).toBe("inbox|searching");
    await waitDebounce();
    await flush();

    resolvers[0]([{ id: "c1" }]);
    await flush();

    expect(searchInbox).toHaveBeenCalledWith("u1", "demo");
    expect(state()).toBe("results:1|idle");
  });

  it("searches immediately on submit, skipping the debounce", async () => {
    draw("u1", "demo");
    pressSearchNow();
    await flush();

    // No timer advance: the explicit submit must not wait out the debounce.
    expect(searchInbox).toHaveBeenCalledTimes(1);
    expect(searchInbox).toHaveBeenCalledWith("u1", "demo");

    resolvers[0]([{ id: "c1" }]);
    await flush();
    expect(state()).toBe("results:1|idle");
  });

  it("does not re-query when only trailing whitespace changes", async () => {
    draw("u1", "demo");
    await waitDebounce();
    await flush();
    resolvers[0]([{ id: "c1" }]);
    await flush();

    draw("u1", "demo ");
    await waitDebounce();
    await flush();

    expect(searchInbox).toHaveBeenCalledTimes(1);
    expect(searchInbox).toHaveBeenCalledWith("u1", "demo");
    expect(state()).toBe("results:1|idle");
  });

  it("stays on the inbox when the box is cleared mid-request", async () => {
    draw("u1", "demo");
    await waitDebounce();
    await flush();
    expect(searchInbox).toHaveBeenCalledTimes(1);

    // Clearing must immediately show the full inbox, not the pending search.
    draw("u1", "");
    expect(state()).toBe("inbox|idle");

    await act(async () => {
      resolvers[0]([{ id: "late" }]);
      await flush();
    });
    expect(state()).toBe("inbox|idle");
  });

  it("ignores a stale response for an older term", async () => {
    draw("u1", "demo");
    await waitDebounce();
    await flush();
    expect(searchInbox).toHaveBeenCalledTimes(1);

    draw("u1", "data");
    await waitDebounce();
    await flush();
    expect(searchInbox).toHaveBeenCalledTimes(2);

    // The newer "data" response arrives first.
    await act(async () => {
      resolvers[1]([{ id: "new-1" }, { id: "new-2" }]);
      await flush();
    });
    expect(state()).toBe("results:2|idle");

    // The slower "demo" response arrives last and must be discarded because its
    // query key is no longer the active one.
    await act(async () => {
      resolvers[0]([]);
      await flush();
    });
    expect(state()).toBe("results:2|idle");
  });

  it("shows an empty result set when the search fails", async () => {
    draw("u1", "demo");
    await waitDebounce();
    await flush();

    await act(async () => {
      resolvers[0]([]);
      await flush();
    });
    expect(state()).toBe("results:0|idle");
  });
});
