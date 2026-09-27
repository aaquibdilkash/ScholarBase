/**
 * @vitest-environment jsdom
 *
 * The profile tabs' paging loop, end to end.
 *
 * `Carousel` on its own pages correctly (see `carousel-click.test.tsx`), and
 * the data layer pages correctly (see the SQL replay). What actually ships is
 * `ProfileSectionList` driving `Carousel`, where `hasMore` is derived from a
 * count and the loader carries a `loadingMore` re-entrancy guard. This test
 * reproduces that composition verbatim so a break in the loop shows up here
 * rather than in the browser.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { useCallback, useState } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Carousel } from "@/components/ui/Carousel";

const VIEWPORT = 300;

class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let container: HTMLDivElement;
let root: Root;

function stubTrackGeometry(
  track: HTMLElement,
  { animate = false }: { animate?: boolean } = {},
) {
  // Read the live DOM on every access: a MutationObserver would update
  // asynchronously and leave `scrollTo` clamping against a stale slide count,
  // which looks exactly like the product bug this file is hunting.
  const liveSlides = () => track.children.length;
  let scrollLeft = 0;
  // When `animate` is on, the offset lands part-way, as a real smooth scroll
  // does, and only reaches the target once `settle()` is called.
  let animatedTo: number | null = null;

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
    scrollToCalls.push({ left: typeof arg === "number" ? arg : arg?.left });
    const left = typeof arg === "number" ? arg : (arg?.left ?? scrollLeft);
    const max = Math.max(0, liveSlides() * VIEWPORT - VIEWPORT);
    const target = Math.max(0, Math.min(left, max));
    if (animate) {
      animatedTo = target;
      scrollLeft = target / 2;
    } else {
      animatedTo = null;
      scrollLeft = target;
    }
  }) as HTMLElement["scrollTo"];
  track.scrollBy = ((arg: number | ScrollToOptions) => {
    const delta = typeof arg === "number" ? arg : (arg?.left ?? 0);
    track.scrollTo({ left: scrollLeft + delta });
  }) as HTMLElement["scrollBy"];

  const applySlideProps = () => {
    for (const slide of Array.from(track.children) as HTMLElement[]) {
      Object.defineProperty(slide, "clientWidth", {
        configurable: true,
        get: () => VIEWPORT,
      });
      Object.defineProperty(slide, "offsetHeight", {
        configurable: true,
        get: () => 100,
      });
    }
  };
  applySlideProps();
  const observer = new MutationObserver(applySlideProps);
  observer.observe(track, { childList: true });

  return {
    scrollLeft: () => scrollLeft,
    scrollToCalls,
    /** Finish any in-flight smooth scroll, as the browser would. */
    settle: () => {
      if (animatedTo === null) return;
      scrollLeft = animatedTo;
      // A real smooth scroll emits `scroll` throughout, so the Carousel's
      // listener re-evaluates the active slide as the offset settles.
      track.dispatchEvent(new Event("scroll"));
    },
  };
}

/** Stands in for `getProfileSection` / `getProfileBookmarkSection`. */
type Loader = (skip: number) => Promise<string[]>;

let loadCalls: number[] = [];
let scrollToCalls: { left?: number }[] = [];

/**
 * `ProfileSectionList` + `loadMore`, copied from `ProfileTabs` including the
 * `loadingMore` guard and the count-derived `hasMore`.
 */
function ProfileSectionList({
  total,
  loader,
  sectionKey,
}: {
  total: number;
  loader: Loader;
  sectionKey: string;
}) {
  // The first page comes from the server, so a section whose count is zero
  // genuinely starts with no slides rather than a placeholder.
  const [items, setItems] = useState<string[]>(total > 0 ? ["item-1"] : []);
  const [loadingMore, setLoadingMore] = useState<string | null>(null);
  const [sectionHasMore, setSectionHasMore] = useState<Record<string, boolean>>(
    {},
  );

  const loadMore = useCallback(
    async (key: string) => {
      const currentLoadingKey = loadingMore;
      if (currentLoadingKey) return;
      setLoadingMore(key);
      try {
        const currentItems = items;
        const totalCount = total;
        if (currentItems.length >= totalCount) {
          setSectionHasMore((prev) => ({ ...prev, [key]: false }));
          return;
        }
        const result = await loader(currentItems.length);
        if (result.length > 0) {
          setItems((prev) => [...prev, ...result]);
        } else {
          setSectionHasMore((prev) => ({ ...prev, [key]: false }));
        }
      } finally {
        setLoadingMore(null);
      }
    },
    [items, total, loader, loadingMore],
  );

  const count = total;
  const sectionHasMoreItems =
    sectionHasMore[sectionKey] !== false && items.length < count;

  return (
    <div className="relative px-1">
      <Carousel
        onLoadMore={
          sectionHasMoreItems ? () => loadMore(sectionKey) : undefined
        }
        hasMore={sectionHasMoreItems}
      >
        {items.map((id) => (
          <div key={id} data-testid="slide">
            {id}
          </div>
        ))}
      </Carousel>
      {loadingMore === sectionKey && (
        <div className="pointer-events-none" data-testid="spinner" />
      )}
    </div>
  );
}

function arrow(label: string): HTMLButtonElement | null {
  const found = Array.from(container.querySelectorAll("button")).find(
    (b) => b.getAttribute("aria-label") === label,
  );
  return found ?? null;
}

async function clickRight() {
  const btn = arrow("Scroll right");
  if (!btn) return false;
  // Dispatch, then flush. The click handler is async: it awaits `onLoadMore`
  // and then two animation frames before it reads `childCountRef`. Those frames
  // run outside the synchronous `act` scope, so React needs a separate flush to
  // commit the appended slide and run the effect that updates the ref.
  await act(async () => {
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
  }
  return true;
}

const slideCount = () => container.querySelectorAll("[data-testid=slide]").length;

function pagingLoader(total: number): Loader {
  return async (skip: number) => {
    loadCalls.push(skip);
    const next = skip + 1;
    return next <= total ? [`item-${next}`] : [];
  };
}

describe("profile section paging loop", () => {
  beforeEach(() => {
    // React 19 checks this before honouring `act`.
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    loadCalls = [];
    scrollToCalls = [];
    vi.stubGlobal("ResizeObserver", NoopResizeObserver);
    vi.stubGlobal(
      "requestAnimationFrame",
      (cb: FrameRequestCallback) =>
        setTimeout(() => cb(0), 0) as unknown as number,
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it.each([
    ["content / articles", 5],
    ["content / recommendations", 5],
    ["content / journal reviews", 5],
    ["bookmarks / articles", 5],
    ["bookmarks / recommendations", 5],
    ["bookmarks / journal reviews", 5],
  ])("%s pages every item on consecutive arrow clicks", async (_label, total) => {
    await act(async () => {
      root.render(
        <ProfileSectionList
          total={total as number}
          loader={pagingLoader(total as number)}
          sectionKey="articles"
        />,
      );
    });
    const track = container.querySelector("div.overflow-x-auto") as HTMLElement;
    const geometry = stubTrackGeometry(track);

    expect(slideCount()).toBe(1);
    expect(arrow("Scroll right")).not.toBeNull();

    for (let click = 1; click <= (total as number) - 1; click++) {
      const clicked = await clickRight();
      expect(clicked, `arrow present on click ${click}`).toBe(true);
      expect(slideCount(), `slides after click ${click}`).toBe(click + 1);
      expect(geometry.scrollLeft(), `track advanced on click ${click}`).toBe(
        click * VIEWPORT,
      );
    }

    // The loader must have been asked for consecutive offsets: that is what
    // proves each click paged rather than re-fetching the same slice.
    expect(loadCalls).toEqual([1, 2, 3, 4]);
    expect(arrow("Scroll right")).toBeNull();
  });

  it("still loads when clicked mid-animation, before the previous scroll settles", async () => {
    // The real-browser failure mode: `scrollTo({behavior:"smooth"})` animates
    // for a few hundred ms, so a second click often lands while the offset is
    // only part of the way across. Deciding with `scrollLeft` made that click a
    // no-op, which is what "the arrow works once and then stops" looked like.
    const TOTAL = 4;
    await act(async () => {
      root.render(
        <ProfileSectionList
          total={TOTAL}
          loader={pagingLoader(TOTAL)}
          sectionKey="articles"
        />,
      );
    });
    const track = container.querySelector("div.overflow-x-auto") as HTMLElement;
    const geometry = stubTrackGeometry(track, { animate: true });

    // Click 1: one item loaded, and the advance is still animating.
    await clickRight();
    expect(slideCount()).toBe(2);
    expect(geometry.scrollLeft()).toBe(VIEWPORT / 2); // part-way

    // Click 2 arrives mid-animation.
    const clicked = await clickRight();
    expect(clicked, "arrow must still be there mid-animation").toBe(true);
    expect(slideCount(), "second click must load, not no-op").toBe(3);
    expect(loadCalls).toEqual([1, 2]);

    geometry.settle();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    await clickRight();
    expect(slideCount()).toBe(4);
    expect(loadCalls).toEqual([1, 2, 3]);
  });

  it("reveals the left arrow only after advancing past the first slide", async () => {
    await act(async () => {
      root.render(
        <ProfileSectionList
          total={3}
          loader={pagingLoader(3)}
          sectionKey="articles"
        />,
      );
    });
    const track = container.querySelector("div.overflow-x-auto") as HTMLElement;
    stubTrackGeometry(track);

    expect(arrow("Scroll left"), "nothing to go back to yet").toBeNull();
    await clickRight();
    expect(arrow("Scroll left"), "should be able to go back").not.toBeNull();
  });

  it("stops offering more once every item is loaded", async () => {
    await act(async () => {
      root.render(
        <ProfileSectionList
          total={2}
          loader={pagingLoader(2)}
          sectionKey="articles"
        />,
      );
    });
    const track = container.querySelector("div.overflow-x-auto") as HTMLElement;
    stubTrackGeometry(track);

    expect(arrow("Scroll right")).not.toBeNull();
    await clickRight();
    expect(slideCount()).toBe(2);
    expect(arrow("Scroll right")).toBeNull();
  });

  it("shows no arrow for a single card with nothing beyond it", async () => {
    // "Why do I see the right arrow if there are no cards?" — one card, no more.
    // The arrow here would point at nothing, so it must not render at all.
    await act(async () => {
      root.render(
        <ProfileSectionList
          total={1}
          loader={pagingLoader(1)}
          sectionKey="articles"
        />,
      );
    });
    const track = container.querySelector("div.overflow-x-auto") as HTMLElement;
    stubTrackGeometry(track);

    expect(slideCount()).toBe(1);
    expect(arrow("Scroll right")).toBeNull();
    expect(arrow("Scroll left")).toBeNull();
  });

  it("drops the arrow when the count claims more than the loader can return", async () => {
    // The materialized count can run ahead of what the query returns (a
    // filtered or soft-deleted row still counts). Left uncorrected, the arrow
    // would sit there permanently and every click would refetch an empty page.
    let served = 0;
    const shortLoader: Loader = async () => {
      served += 1;
      return served === 1 ? ["item-2"] : [];
    };

    await act(async () => {
      root.render(
        <ProfileSectionList
          total={25}
          loader={shortLoader}
          sectionKey="articles"
        />,
      );
    });
    const track = container.querySelector("div.overflow-x-auto") as HTMLElement;
    stubTrackGeometry(track);

    expect(arrow("Scroll right"), "count says more are available").not.toBeNull();

    await clickRight();
    expect(slideCount()).toBe(2);

    // Second click finds nothing, and the arrow must go away rather than
    // lingering on a card that does not exist.
    await clickRight();
    expect(arrow("Scroll right"), "arrow must not point at nothing").toBeNull();
  });

  it("renders no arrows at all when a section is empty", async () => {
    await act(async () => {
      root.render(
        <ProfileSectionList
          total={0}
          loader={pagingLoader(0)}
          sectionKey="articles"
        />,
      );
    });
    const track = container.querySelector("div.overflow-x-auto") as HTMLElement;
    stubTrackGeometry(track);

    expect(slideCount()).toBe(0);
    expect(arrow("Scroll right")).toBeNull();
    expect(arrow("Scroll left")).toBeNull();
  });
});
