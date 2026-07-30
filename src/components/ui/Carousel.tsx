"use client";

import { useState, useRef, useEffect, Children, type ReactNode } from "react";

interface CarouselProps {
  children: ReactNode;
}

export function Carousel({ children }: CarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollability = () => {
    const el = containerRef.current;
    if (el) {
      // A little buffer to prevent floating point inaccuracies
      const isScrollable = el.scrollWidth > el.clientWidth + 2;
      if (!isScrollable) {
        setCanScrollLeft(false);
        setCanScrollRight(false);
        return;
      }
      setCanScrollLeft(el.scrollLeft > 0);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
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
      resizeObserver.unobserve(el);
      el.removeEventListener("scroll", checkScrollability);
    };
  }, []);

  const scroll = (direction: "left" | "right") => {
    const el = containerRef.current;
    if (el) {
      const scrollAmount = el.clientWidth;
      el.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const childCount = Children.count(children);

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
          <svg
            className="w-6 h-6 text-slate-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      )}

      {childCount > 1 && canScrollRight && (
        <button
          type="button"
          onClick={() => scroll("right")}
          className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 z-10 rounded-full bg-white/80 border border-slate-200 p-2 shadow-md"
          aria-label="Scroll right"
        >
          <svg
            className="w-6 h-6 text-slate-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
