/**
 * @vitest-environment jsdom
 *
 * `PagedCarousel` — the shared component behind the journal reviews rail and the
 * supervisor recommendations rail.
 *
 * `carousel-click.test.tsx` covers the arrow mechanics with a hand-rolled host,
 * and `carousel-arrows.test.ts` covers arrow visibility as pure functions. What
 * this file covers is the piece that used to be copy-pasted into every detail
 * page and had drifted: the React Query seed, the offset pager, the dedup on
 * append, and `hasMore` derived from the materialized count.
 *
 * jsdom has no layout engine, so the track's geometry is stubbed to model a
 * viewport that shows exactly one full-width slide at a time.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PagedCarousel } from "@/components/ui/PagedCarousel";

const VIEWPORT = 300;

class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let container: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;

type Item = { id: string };

function stubTrackGeometry(track: HTMLElement) {
  const liveSlides = () => track.children.length;
  let scrollLeft = 0;

  Object.defineProperty(track, "clientWidth", {
    configurable: true,
    get: () => VIEWPORT,
  });
  Object.defineProperty(track, "scrollWidth", {
    configurable: true,
    get: () => liveSlides() * VIEWPORT,
  });
  Object.defineProperty(track, "scrollLeft", {
    configurable: true,
    get: () => scrollLeft,
    set: (v: number) => {
      scrollLeft = v;
    },
  });
  track.scrollTo = ((arg: number | ScrollToOptions) => {
    const left = typeof arg === "number" ? arg : (arg?.left ?? scrollLeft);
    const max = Math.max(0, liveSlides() * VIEWPORT - VIEWPORT);
    scrollLeft = Math.max(0, Math.min(left, max));
  }) as HTMLElement["scrollTo"];
  track.scrollBy = ((arg: number | ScrollToOptions) => {
    const delta = typeof arg === "number" ? arg : (arg?.left ?? 0);
    track.scrollTo({ left: scrollLeft + delta });
  }) as HTMLElement["scrollBy"];

  return () => {
    stubTrackGeometry(track);
  };
}

function findArrow(direction: "left" | "right"): HTMLButtonElement | null {
  return (
    Array.from(container.querySelectorAll("button")).find(
      (b) => b.getAttribute("aria-label") === `Scroll ${direction}`,
    ) ?? null
  );
}

async function clickRightArrow() {
  const arrow = findArrow("right");
  if (!arrow) throw new Error("right arrow is not rendered");
  await act(async () => {
    arrow.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  });
}

const slides = () => container.querySelectorAll("[data-testid=slide]");

function render(node: React.ReactNode) {
  return act(async () => {
    root.render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
  });
}

describe("PagedCarousel", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", NoopResizeObserver);
    vi.stubGlobal(
      "requestAnimationFrame",
      (cb: FrameRequestCallback) =>
        setTimeout(() => cb(performance.now()), 0) as unknown as number,
    );
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    queryClient.clear();
    vi.unstubAllGlobals();
  });

  it("paints the server seed without a client fetch, then pages one slide per click", async () => {
    const fetchPage = vi.fn(async (_skip: number, _take: number): Promise<Item[]> => []);
    const all: Item[] = [{ id: "r1" }, { id: "r2" }, { id: "r3" }];

    await render(
      <PagedCarousel<Item>
        queryKey={["journalReviews", "j1"]}
        initialItems={[all[0]]}
        totalCount={all.length}
        fetchPage={fetchPage}
        renderItem={(item) => (
          <div key={item.id} data-testid="slide">
            {item.id}
          </div>
        )}
      />,
    );

    // Seeded from the server render; the query is not stale, so no fetch fires.
    expect(slides()).toHaveLength(1);
    expect(fetchPage).not.toHaveBeenCalled();

    const track = container.querySelector("div.overflow-x-auto") as HTMLElement;
    const restub = stubTrackGeometry(track);

    // The offset pager asks for exactly what is already on screen.
    fetchPage.mockImplementation(async (skip: number, take: number) =>
      all.slice(skip, skip + take),
    );

    await clickRightArrow();
    restub();
    expect(slides()).toHaveLength(2);
    expect(fetchPage).toHaveBeenLastCalledWith(1, 1);

    await clickRightArrow();
    restub();
    expect(slides()).toHaveLength(3);
    expect(fetchPage).toHaveBeenLastCalledWith(2, 1);

    // Exhausted: the arrow disappears rather than paging a phantom slide.
    expect(findArrow("right")).toBeNull();
  });

  it("dedups an appended page so a shifting offset cannot duplicate a slide", async () => {
    // Delete-then-page: after the cache drops a row, the next offset request
    // overlaps the previous page. The dedup is what keeps one review from
    // rendering twice.
    const remaining: Item[] = [{ id: "r1" }, { id: "r3" }, { id: "r4" }];

    await render(
      <PagedCarousel<Item>
        queryKey={["recommendations", "s1"]}
        initialItems={[{ id: "r1" }]}
        totalCount={remaining.length}
        fetchPage={async (skip, take) => remaining.slice(skip, skip + take)}
        renderItem={(item) => (
          <div key={item.id} data-testid="slide">
            {item.id}
          </div>
        )}
      />,
    );

    const track = container.querySelector("div.overflow-x-auto") as HTMLElement;
    const restub = stubTrackGeometry(track);

    await clickRightArrow();
    restub();
    // r2 was deleted server-side, so r3 arrives instead of a duplicate.
    expect(Array.from(slides()).map((n) => n.textContent)).toEqual(["r1", "r3"]);

    // A row vanishes from the cache the way a delete does; the count drops too.
    await act(async () => {
      queryClient.setQueryData<Item[]>(["recommendations", "s1"], (prev = []) =>
        prev.filter((i) => i.id !== "r1"),
      );
      queryClient.setQueryData(["count", "s1"], remaining.length - 1);
    });

    await clickRightArrow();
    restub();
    expect(Array.from(slides()).map((n) => n.textContent)).toEqual(["r3", "r4"]);
  });

  it("hides the arrow when the loaded slice already matches the total", async () => {
    const fetchPage = vi.fn(async (_skip: number, _take: number): Promise<Item[]> => []);

    await render(
      <PagedCarousel<Item>
        queryKey={["journalReviews", "j2"]}
        initialItems={[{ id: "only" }]}
        totalCount={1}
        fetchPage={fetchPage}
        renderItem={(item) => (
          <div key={item.id} data-testid="slide">
            {item.id}
          </div>
        )}
      />,
    );

    const track = container.querySelector("div.overflow-x-auto") as HTMLElement;
    stubTrackGeometry(track);

    expect(slides()).toHaveLength(1);
    expect(findArrow("right")).toBeNull();
    expect(findArrow("left")).toBeNull();
  });
});
