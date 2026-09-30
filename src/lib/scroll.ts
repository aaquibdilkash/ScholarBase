/**
 * Scroll helpers that respect the app's two scroll modes.
 *
 * The root layout (see `src/app/layout.tsx`) makes `<main id="sb-main-scroll">`
 * the scroll container at `lg+` — the outer wrapper is `lg:h-dvh lg:overflow-hidden`,
 * so the window itself never scrolls on desktop and `window.scrollTo` is a silent
 * no-op there. Below `lg` that `<main>` has `overflow-y: visible` and the window is
 * the scroller, with the navbar `sticky top-0` on top of it.
 *
 * Any code that needs to move the viewport (paging, jumping to an error, restoring
 * a position) must go through this module instead of calling `window.scrollTo`
 * directly, otherwise it works on mobile and does nothing on desktop.
 */

/** Breathing room between the target and the edge of the scroll viewport. */
const SCROLL_GAP = 16;

/**
 * The element that actually scrolls: `#sb-main-scroll` when it is a scroll
 * container, otherwise `null` (meaning the window).
 */
function getScrollContainer(): HTMLElement | null {
  const main = document.getElementById("sb-main-scroll");
  if (!main) return null;
  // `lg:overflow-y-auto` only applies at lg+, so computed overflow is the
  // reliable signal for which mode the viewport is currently in.
  const overflowY = window.getComputedStyle(main).overflowY;
  return overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay"
    ? main
    : null;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Scroll `target` to the top of the current scroll viewport, staying clear of
 * any sticky chrome. No-ops if the target is not laid out yet.
 */
export function scrollToElementTop(target: HTMLElement | null): void {
  if (!target) return;

  const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
  const container = getScrollContainer();

  if (container) {
    // Desktop: the navbar is a sibling of <main>, so it is already pinned
    // outside the scroll area and needs no offset — just the gap.
    const top =
      target.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop -
      SCROLL_GAP;
    container.scrollTo({ top: Math.max(0, top), behavior });
    return;
  }

  // Mobile: the navbar is sticky over the window scroller, so subtract it.
  const navbar = document.getElementById("sb-navbar");
  const offset = (navbar?.offsetHeight ?? 0) + SCROLL_GAP;
  const top = target.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top: Math.max(0, top), behavior });
}
