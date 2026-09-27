/**
 * Carousel arrow visibility, kept out of the component so the rules are
 * testable without a DOM.
 *
 * Both arrows are derived from `activeIndex` and `childCount` — React state that
 * is current on every render — rather than from the measured scroll offset.
 * Scroll offsets are not: they are only sampled on `scroll` and resize events,
 * and appending a slide makes the track scroll rather than resize, so the
 * observer never fires and the last known value goes stale. That is how an
 * arrow ends up pointing at a card that does not exist.
 *
 * The right arrow doubles as the "fetch the next item" trigger, so it has to be
 * able to appear while only one child is rendered: the profile tabs seed each
 * section with `take: 1`, and that arrow is the only way to ask for item two.
 */
export function shouldShowRightArrow({
  activeIndex,
  childCount,
  hasMore,
  canLoadMore,
}: {
  /** Index of the slide currently in view. */
  activeIndex: number;
  /** Number of slides rendered. */
  childCount: number;
  /** The parent says more items exist beyond the ones loaded. */
  hasMore: boolean;
  /** An `onLoadMore` handler was supplied. */
  canLoadMore: boolean;
}): boolean {
  // Nothing rendered means nothing to page from, whatever the count claims.
  if (childCount === 0) return false;
  // A next slide is already loaded and waiting to be scrolled to.
  if (activeIndex < childCount - 1) return true;
  // On the last slide: the arrow is only meaningful if it can fetch another.
  return canLoadMore && hasMore;
}

export function shouldShowLeftArrow({
  activeIndex,
  childCount,
}: {
  activeIndex: number;
  childCount: number;
}): boolean {
  if (childCount === 0) return false;
  return activeIndex > 0;
}
