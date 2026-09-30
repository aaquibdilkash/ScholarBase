/**
 * @vitest-environment jsdom
 *
 * `scrollToElementTop` — the shared viewport-mover behind survey page changes.
 *
 * The root layout makes `<main id="sb-main-scroll">` the scroller at `lg+` and
 * leaves the window as the scroller below it. A helper that only calls
 * `window.scrollTo` therefore works on mobile and silently does nothing on
 * desktop, which is how survey "Next" failed to move the viewport.
 *
 * jsdom has no layout engine, so the two scroll geometries are stubbed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { scrollToElementTop } from "@/lib/scroll";

let scrollCalls: Array<{ target: string; top: number }>;
let windowScrollTop = 0;
let realMatchMedia: typeof window.matchMedia;

function rect(top: number): DOMRect {
  return {
    top,
    height: 0,
    bottom: top,
    left: 0,
    right: 0,
    width: 0,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

beforeEach(() => {
  scrollCalls = [];
  windowScrollTop = 0;
  realMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
    onchange: null,
  })) as unknown as typeof window.matchMedia;

  window.scrollTo = ((arg: number | ScrollToOptions) => {
    const top = typeof arg === "number" ? arg : (arg?.top ?? 0);
    windowScrollTop = Math.max(0, top);
    scrollCalls.push({ target: "window", top: windowScrollTop });
  }) as typeof window.scrollTo;
});

afterEach(() => {
  window.matchMedia = realMatchMedia;
  document.body.innerHTML = "";
});

describe("scrollToElementTop — window scroll mode (below lg)", () => {
  it("scrolls the window and clears the sticky navbar", () => {
    // Navbar is sticky over the window scroller on mobile.
    const navbar = document.createElement("div");
    navbar.id = "sb-navbar";
    Object.defineProperty(navbar, "offsetHeight", { value: 56 });
    document.body.appendChild(navbar);

    // <main> exists but is NOT a scroll container at this breakpoint.
    const main = document.createElement("main");
    main.id = "sb-main-scroll";
    document.body.appendChild(main);

    const target = document.createElement("div");
    target.getBoundingClientRect = () => rect(400);
    main.appendChild(target);

    window.scrollY = 1000;
    scrollToElementTop(target);

    // 400 (viewport-relative) + 1000 (scrollY) - 56 (navbar) - 16 (gap)
    expect(scrollCalls).toEqual([{ target: "window", top: 1328 }]);
  });

  it("never scrolls to a negative offset", () => {
    const target = document.createElement("div");
    target.getBoundingClientRect = () => rect(10);
    document.body.appendChild(target);
    window.scrollY = 0;

    scrollToElementTop(target);

    expect(scrollCalls).toEqual([{ target: "window", top: 0 }]);
  });
});

describe("scrollToElementTop — inner container mode (lg+)", () => {
  it("scrolls #sb-main-scroll, not the window", () => {
    const main = document.createElement("main");
    main.id = "sb-main-scroll";
    // Mirrors `lg:overflow-y-auto` on the real element. Must go through the
    // real style declaration so `getComputedStyle` actually reports it.
    main.style.overflowY = "auto";
    const containerCalls: number[] = [];
    Object.defineProperty(main, "scrollTop", {
      configurable: true,
      writable: true,
      value: 0,
    });
    main.scrollTo = ((arg: number | ScrollToOptions) => {
      const top = typeof arg === "number" ? arg : (arg?.top ?? 0);
      containerCalls.push(top);
      scrollCalls.push({ target: "container", top });
    }) as HTMLElement["scrollTo"];
    document.body.appendChild(main);

    // The navbar is a SIBLING of <main> on desktop: already pinned outside
    // the scroll area, so it must not be subtracted.
    const navbar = document.createElement("div");
    navbar.id = "sb-navbar";
    Object.defineProperty(navbar, "offsetHeight", { value: 64 });
    document.body.appendChild(navbar);

    main.getBoundingClientRect = () => rect(64);
    const target = document.createElement("div");
    // 300px down the document, i.e. 236px into <main>'s scroll content.
    target.getBoundingClientRect = () => rect(300);
    main.appendChild(target);

    // The window is pinned at 0 on desktop — this is the regression guard.
    window.scrollY = 0;
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

    scrollToElementTop(target);

    // 300 (target) - 64 (main's top) + 0 (main.scrollTop) - 16 (gap)
    expect(scrollCalls).toEqual([{ target: "container", top: 220 }]);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});

describe("scrollToElementTop — misc", () => {
  it("no-ops on a null target", () => {
    scrollToElementTop(null);
    expect(scrollCalls).toEqual([]);
  });

  it("honours prefers-reduced-motion with instant scrolling", () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
      onchange: null,
    })) as unknown as typeof window.matchMedia;

    const target = document.createElement("div");
    target.getBoundingClientRect = () => rect(100);
    document.body.appendChild(target);

    let behavior: ScrollBehavior | undefined;
    window.scrollTo = ((arg: ScrollToOptions) => {
      behavior = arg.behavior;
    }) as typeof window.scrollTo;

    scrollToElementTop(target);
    expect(behavior).toBe("auto");
  });
});
