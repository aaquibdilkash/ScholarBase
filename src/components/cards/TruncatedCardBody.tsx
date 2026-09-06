"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";

/**
 * Inline styles for a native CSS line clamp. Unlike a rigid pixel-height
 * (`overflow: hidden`) container, a line clamp clips only at whole lines, so
 * text is never sliced in half mid-line.
 */
const lineClampStyle = (lines: number): React.CSSProperties => ({
  display: "-webkit-box",
  WebkitLineClamp: lines,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
});

export function TruncatedCardBody({
  children,
  detailPageHref,
  className,
  noBodyLink,
  constrainBody = true,
  maxLines = 3,
}: {
  children: ReactNode;
  detailPageHref: string;
  className?: string;
  noBodyLink: boolean;
  /**
   * When false the body is rendered verbatim (no clamp, measurement or toggle).
   * Use this when a card manages its own expansion (e.g. SocialPostCard with an
   * image beside the text) so the neighbouring media is never clipped.
   */
  constrainBody?: boolean;
  /** Number of visible lines before clamping (default 3). */
  maxLines?: number;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const updateTruncation = () => {
    const body = bodyRef.current;
    const measure = measureRef.current;
    if (!body || !measure) return setIsTruncated(false);
    // The measurement copy carries the same children WITHOUT the clamp, so its
    // natural height reveals whether the clamped body actually clipped content.
    setIsTruncated(
      measure.getBoundingClientRect().height >
        body.getBoundingClientRect().height + 1,
    );
  };

  useEffect(() => {
    if (!constrainBody) return;
    updateTruncation();
    const observer = new ResizeObserver(updateTruncation);
    if (bodyRef.current) observer.observe(bodyRef.current);
    if (measureRef.current) observer.observe(measureRef.current);
    return () => observer.disconnect();
  }, [children, constrainBody]);

  const content = constrainBody ? (
    <div className="relative min-w-0">
      <div
        ref={bodyRef}
        className="min-w-0"
        style={isExpanded ? undefined : lineClampStyle(maxLines)}
      >
        {children}
      </div>
      {/* Hidden, non-clamped copy used purely for truncation measurement. */}
      <div
        ref={measureRef}
        aria-hidden="true"
        inert
        className="pointer-events-none absolute left-0 top-0 w-full"
        style={{ visibility: "hidden" }}
      >
        {children}
      </div>
    </div>
  ) : (
    <div ref={bodyRef} className="min-w-0">
      {children}
    </div>
  );

  return (
    <>
      {noBodyLink ? (
        <div className={className}>{content}</div>
      ) : (
        <Link href={detailPageHref} className={className}>
          {content}
        </Link>
      )}
      {constrainBody && (isTruncated || isExpanded) ? (
        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          className="mt-3 inline-flex text-sm font-semibold text-blue-700 transition hover:text-blue-800 hover:underline dark:text-blue-300 dark:hover:text-blue-200"
        >
          {isExpanded ? "View less" : "View more"}
        </button>
      ) : null}
    </>
  );
}
