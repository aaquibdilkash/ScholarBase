"use client";

import { useState, useRef, useEffect, Children, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CarouselProps {
  children: ReactNode;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export function Carousel({ children, onLoadMore, hasMore }: CarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const childCountRef = useRef(Children.count(children));

  const checkScrollability = () => {
    const el = containerRef.current;
    if (el) {
      // A little buffer to prevent floating point inaccuracies
      const isScrollable = el.scrollWidth > el.clientWidth;
      if (!isScrollable) {
        setCanScrollLeft(false);
        setCanScrollRight(false);
        return;
      }
      setCanScrollLeft(el.scrollLeft > 0);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth);
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    checkScrollability();

    const resizeObserver = new ResizeObserver(checkScrollability);
    resizeObserver.observe(el);

    el.addEventListener("scroll", checkScrollability);

    return () => {
      if (el) {
        resizeObserver.unobserve(el);
        el.removeEventListener("scroll", checkScrollability);
      }
    };
  }, [children]); // Rerender when children change to re-evaluate scrollability

  useEffect(() => {
    childCountRef.current = Children.count(children);
  }, [children]);

  const scroll = async (direction: "left" | "right") => {
    const el = containerRef.current;
    if (!el) return;

    const isAtEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth;

    if (direction === "right" && isAtEnd && onLoadMore) {
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
  const showRightArrow = canScrollRight || (onLoadMore && hasMore);

  return (
    <div className="relative group">
      <div
        ref={containerRef}
        className="flex overflow-x-auto snap-x snap-mandatory py-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {Children.map(children, (child, i) => (
          <div key={i} className="snap-center shrink-0 w-full">
            {child}
          </div>
        ))}
      </div>

      {childCount > 1 && canScrollLeft && (
        <button
          type="button"
          onClick={() => scroll("left")}
          className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2 z-10 rounded-full bg-white/80 border border-slate-200 p-2 shadow-md"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-6 h-6 text-slate-700" />
        </button>
      )}

      {showRightArrow && (
        <button
          type="button"
          onClick={() => scroll("right")}
          className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 z-10 rounded-full bg-white/80 border border-slate-200 p-2 shadow-md"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-6 h-6 text-slate-700" />
        </button>
      )}
    </div>
  );
}
