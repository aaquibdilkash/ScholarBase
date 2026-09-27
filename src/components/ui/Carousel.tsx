"use client";

import { useState, useRef, useEffect, useCallback, Children, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { shouldShowLeftArrow, shouldShowRightArrow } from "./carousel-arrows";

interface CarouselProps {
  children: ReactNode;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export function Carousel({ children, onLoadMore, hasMore }: CarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeHeight, setActiveHeight] = useState<number>();
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const childCountRef = useRef(Children.count(children));

  const updateActiveSlide = useCallback(() => {
    const el = containerRef.current;
    if (!el || el.clientWidth === 0) return;

    // Read the slide count from the DOM, not from the `children` prop. This is
    // also called right after a load, and the closure would still hold the
    // pre-append children — clamping the newly appended slide's index back into
    // the old range, which leaves the carousel believing it is still on the
    // first slide and turns the next arrow click into a no-op scroll.
    const slideCount = el.children.length;
    if (slideCount === 0) return;

    const index = Math.max(
      0,
      Math.min(slideCount - 1, Math.round(el.scrollLeft / el.clientWidth)),
    );
    setActiveIndex(index);
  }, []);

  const updateActiveHeight = useCallback(() => {
    const height = slideRefs.current[activeIndex]?.offsetHeight;
    if (height) setActiveHeight(height);
  }, [activeIndex]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const resizeObserver = new ResizeObserver(() => {
      updateActiveSlide();
      updateActiveHeight();
    });
    resizeObserver.observe(el);
    slideRefs.current.forEach((slide) => slide && resizeObserver.observe(slide));

    const onScroll = () => {
      updateActiveSlide();
    };
    el.addEventListener("scroll", onScroll);

    return () => {
      if (el) {
        resizeObserver.unobserve(el);
        el.removeEventListener("scroll", onScroll);
      }
    };
  }, [children, activeIndex, updateActiveHeight, updateActiveSlide]);

  useEffect(() => {
    updateActiveHeight();
  }, [activeIndex, children, updateActiveHeight]);

  useEffect(() => {
    childCountRef.current = Children.count(children);
  }, [children]);

  const scroll = async (direction: "left" | "right") => {
    const el = containerRef.current;
    if (!el) return;

    // Which slide is in view, rather than where the track happens to be sitting.
    // `scrollLeft` is unusable as the test here: `scrollTo`/`scrollBy` animate
    // smoothly, so a click that lands while an earlier animation is still
    // running reads a half-finished offset, concludes it is not at the end, and
    // quietly does nothing. `activeIndex` is snapped to the nearest slide, so it
    // stays correct throughout the animation and the arrow cannot get stuck.
    const currentChildCount = Children.count(children);
    const nextIndex = activeIndex + (direction === "right" ? 1 : -1);
    const hasLoadedChildBeyond = nextIndex < currentChildCount;

    if (direction === "right" && !hasLoadedChildBeyond && onLoadMore) {
      const prevCount = childCountRef.current;
      await onLoadMore();

      // Wait for React to commit the newly appended children before scrolling.
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );

      const newCount = childCountRef.current;
      if (newCount > prevCount) {
        // Scroll to the first newly added item.
        el.scrollTo({
          left: prevCount * el.clientWidth,
          behavior: "smooth",
        });
        // Re-read the offset now that the slide is committed, so `activeIndex`
        // reflects the newly revealed item.
        updateActiveSlide();
      }
      return;
    }

    const scrollAmount = el.clientWidth;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const childCount = Children.count(children);
  const showRightArrow = shouldShowRightArrow({
    activeIndex,
    childCount,
    hasMore: Boolean(hasMore),
    canLoadMore: Boolean(onLoadMore),
  });
  const showLeftArrow = shouldShowLeftArrow({ activeIndex, childCount });

  return (
    <div className="group relative overflow-visible">
      <div className="overflow-x-hidden">
        <div
          ref={containerRef}
          className="flex items-start overflow-x-auto overflow-y-hidden snap-x snap-mandatory transition-[height] duration-200 ease-out [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          style={activeHeight ? { height: activeHeight } : undefined}
        >
          {Children.map(children, (child, i) => (
            <div
              key={i}
              ref={(element) => {
                slideRefs.current[i] = element;
              }}
              className="w-full shrink-0 snap-center"
            >
              {child}
            </div>
          ))}
        </div>
      </div>

      {showLeftArrow && (
        <button
          type="button"
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 z-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white/80 p-2 shadow-md"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-6 h-6 text-slate-700" />
        </button>
      )}

      {showRightArrow && (
        <button
          type="button"
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 z-5 -translate-y-1/2 translate-x-1/2 rounded-full border border-slate-200 bg-white/80 p-2 shadow-md"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-6 h-6 text-slate-700" />
        </button>
      )}
    </div>
  );
}
