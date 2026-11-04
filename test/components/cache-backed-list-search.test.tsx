/**
 * @vitest-environment jsdom
 *
 * Client-side list search swaps the query key instead of navigating. Two
 * behaviours have to hold or search looks broken:
 *
 *  - the previous term's rows stay on screen while the new first page loads
 *    (`keepPreviousOnKeyChange`), and
 *  - pagination is derived from the fetched page, so a full search result can
 *    still "load more" even though there is no server-rendered `initialItems`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { CacheBackedList } from "@/components/layout/CacheBackedList";
import type { ListPage } from "@/components/layout/listPage";

type Row = { id: string };

const rows = (prefix: string, count: number): Row[] =>
  Array.from({ length: count }, (_, index) => ({ id: `${prefix}${index}` }));

class MockIntersectionObserver {
  static latest: MockIntersectionObserver | null = null;
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.latest = this;
  }

  observe() {}
  unobserve() {}
  disconnect() {}

  trigger() {
    this.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

describe("CacheBackedList search key changes", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  let fetchPage: (cursor?: string) => Promise<ListPage<Row>>;
  let resolveFirstPage: (page: ListPage<Row>) => void;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    (
      globalThis as unknown as { IntersectionObserver: unknown }
    ).IntersectionObserver = MockIntersectionObserver;
    MockIntersectionObserver.latest = null;

    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    fetchPage = (vi.fn((cursor?: string) => {
      if (cursor === undefined) {
        return new Promise<ListPage<Row>>((resolve) => {
          resolveFirstPage = resolve;
        });
      }
      return Promise.resolve({ items: rows("c", 2), hasMore: false });
    }) as unknown) as (cursor?: string) => Promise<ListPage<Row>>;

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    queryClient.clear();
    delete (globalThis as unknown as { IntersectionObserver?: unknown })
      .IntersectionObserver;
  });

  const ids = () =>
    Array.from(container.querySelectorAll("li")).map((li) => li.textContent);

  const draw = (queryKey: readonly unknown[], initialItems?: Row[]) =>
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <CacheBackedList<Row>
            queryKey={queryKey}
            initialItems={initialItems}
            keepPreviousOnKeyChange
            fetchPage={fetchPage}
            renderItem={(item) => <li key={item.id}>{item.id}</li>}
            emptyMessage="No match found."
          />
        </QueryClientProvider>,
      );
    });

  it("keeps the previous rows, then paginates the new term's first page", async () => {
    draw(["list", ""], rows("a", 10));

    // Client-side search: new key, no server-rendered rows to seed it.
    draw(["list", "gen"]);

    // The old term stays put while the new first page is in flight.
    expect(ids()).toEqual(rows("a", 10).map((row) => row.id));

    await act(async () => {
      resolveFirstPage({ items: rows("b", 10), hasMore: true });
      // React Query notifies listeners after its own state settles; two turns
      // of the macrotask queue flush the fetch, the notify, and the rerender.
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(ids()).toEqual(rows("b", 10).map((row) => row.id));

    // A full first page must leave pagination enabled.
    expect(MockIntersectionObserver.latest).not.toBeNull();
    act(() => MockIntersectionObserver.latest!.trigger());
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchPage).toHaveBeenCalledWith("b9");
    expect(ids()).toHaveLength(12);
  });

  it("shows the no-search-match copy when a term has no rows", async () => {
    draw(["list", "gen"]);

    await act(async () => {
      resolveFirstPage({ items: [], hasMore: false });
      await Promise.resolve();
    });

    expect(container.textContent).toContain("No match found.");
  });
});
