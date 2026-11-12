"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { isValidImageUrl } from "@/lib/image-constants";

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

/**
 * Fixed minimum height (px) for the collapsed card body, so every card renders
 * a uniform rectangle regardless of text length or image aspect ratio.
 */
const COLLAPSED_MIN_HEIGHT = 80;

/**
 * Line cap for the collapsed body on the stacked list-page layout.
 *
 * The feed uses a fixed 100px box because its image sits BESIDE the text and
 * the two must line up. Stacked cards put the image BELOW the text, so the
 * text block is allowed to take its natural (clamped) height — a fixed box
 * left a visible hole between a one-line post and its image.
 */
const STACKED_COLLAPSED_LINES = 2;

/**
 * Height (px) of the collapsed image strip on the stacked layout. Shorter than
 * the feed's 100px thumbnail box: stacked cards already carry a badge/metadata
 * block above the body, so the strip only needs to hint at the image.
 */
const STACKED_COLLAPSED_IMAGE_HEIGHT = 64;

export type CollapsibleMediaBodyProps = {
  /** Detail page the collapsed body links to. */
  href: string;
  /** Card image URL. When absent the body renders as a full-width text block. */
  imageUrl?: string | null;
  /** Body text. Clamped in the collapsed state, fully visible when expanded. */
  text: ReactNode;
  /**
   * Optional always-visible heading rendered above the text/image row inside
   * the same link (e.g. a blog post's title).
   */
  header?: ReactNode;
  /**
   * Stable identity for the measured text, used to re-run truncation
   * measurement when the content actually changes (not on every render).
   */
  contentKey: string;
  /** Eagerly load the image (first card in a list). */
  priority?: boolean;
  /** Extra classes for the clamped text element. */
  textClassName?: string;
  /**
   * Where the image sits relative to the text.
   *
   * - `"side"` (default) — the feed layout: text left, image right, both
   *   clipped to a fixed-height rectangle.
   * - `"stacked"` — the list-page layout: text full width, image full width
   *   directly below it, collapsed to a short strip.
   */
  layout?: "side" | "stacked";
};

/**
 * CollapsibleMediaBody
 * --------------------
 * The shared "text with an image, collapsed" card body.
 *
 * This is the Research Feed card's body layout, extracted so every content
 * module that grows an `imageUrl` column renders the exact same collapse
 * behaviour instead of re-implementing it:
 *
 *   side (feed)   collapsed  ->  text on the left, image on the right, both
 *                                clipped to a fixed-height rectangle; the
 *                                image is cropped from the BOTTOM when it is
 *                                taller than that rectangle.
 *                 expanded   ->  text on top, image full-width below.
 *
 *   stacked       collapsed  ->  text full width, then a short full-width
 *                                image strip below it (top-anchored crop).
 *                 expanded   ->  image at its natural aspect ratio.
 *
 * "View more" appears whenever the text is truncated or the image is cropped,
 * in either layout, and "View less" collapses it back. The image opens the
 * shared ImageLightbox on click.
 *
 * Used by: the Research Feed card (side), the Research Blog / Call for Papers /
 * Academic Positions / Admissions list cards (stacked).
 */
export function CollapsibleMediaBody({
  href,
  imageUrl,
  text,
  header,
  contentKey,
  priority = false,
  textClassName,
  layout = "side",
}: CollapsibleMediaBodyProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  // Height of the collapsed preview box. Fixed minimum so every card renders a
  // uniform rectangle regardless of text length or image aspect ratio.
  const [collapsedBodyHeight, setCollapsedBodyHeight] = useState<number>(
    COLLAPSED_MIN_HEIGHT,
  );
  // How many text lines fit inside the collapsed preview box. Dynamic so the
  // text always fills the box height (no "cut with empty space below").
  const [maxLines, setMaxLines] = useState(3);
  // Intrinsic dimensions of the full-size image, used to detect whether the
  // thumbnail actually cuts off the bottom of the image.
  const [imageNatural, setImageNatural] = useState<{ w: number; h: number } | null>(
    null,
  );
  // Thumbnail width, used to compute the full-size image's natural height at
  // that width (to detect when it is cropped).
  const [thumbnailWidth, setThumbnailWidth] = useState(0);

  const bodyRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const imageButtonRef = useRef<HTMLButtonElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  // Track the previous expansion state so we only scroll on the
  // expanded → collapsed transition (when "View less" is clicked).
  const prevExpanded = useRef(isExpanded);

  const hasImage = isValidImageUrl(imageUrl);
  // In the stacked layout the image always sits BELOW the text at full width.
  const isStacked = layout === "stacked";
  // The text-beside-image row — feed layout only, and only while collapsed.
  const isSideRow = hasImage && !isStacked && !isExpanded;

  // Height of the collapsed image strip. The feed matches its side-by-side
  // text box (100px); stacked cards use a shorter, full-width strip.
  const collapsedImageHeight = isStacked
    ? STACKED_COLLAPSED_IMAGE_HEIGHT
    : collapsedBodyHeight;

  // Compute (a) how many text lines fit in the collapsed box, so text never
  // looks "cut while there is still empty space below it", and (b) whether the
  // full text exceeds that capacity (real truncation -> show toggle).
  const updateCollapsedMetrics = useCallback(() => {
    const body = bodyRef.current;
    const measure = measureRef.current;
    if (!body || !measure) {
      setIsTruncated(false);
      return;
    }
    const lineHeightPx = parseFloat(getComputedStyle(body).lineHeight) || 0;
    const lines = isStacked
      ? STACKED_COLLAPSED_LINES
      : lineHeightPx > 0
        ? Math.max(1, Math.floor(COLLAPSED_MIN_HEIGHT / lineHeightPx))
        : 3;
    setMaxLines(lines);
    setCollapsedBodyHeight(COLLAPSED_MIN_HEIGHT);
    // Truncation is when the non-clamped text is taller than what is visible.
    const visibleHeight = isStacked
      ? lineHeightPx * STACKED_COLLAPSED_LINES
      : COLLAPSED_MIN_HEIGHT;
    setIsTruncated(measure.getBoundingClientRect().height > visibleHeight + 1);
  }, [isStacked]);

  useEffect(() => {
    updateCollapsedMetrics();
    const observer = new ResizeObserver(updateCollapsedMetrics);
    if (bodyRef.current) observer.observe(bodyRef.current);
    if (measureRef.current) observer.observe(measureRef.current);
    return () => observer.disconnect();
  }, [contentKey, imageUrl, updateCollapsedMetrics]);

  // When collapsing ("View less"), scroll the card header back to the top of
  // the viewport so the user can see the title/author of the same card again
  // (and re-expand it) without hunting for the button.
  useEffect(() => {
    if (prevExpanded.current && !isExpanded && toggleButtonRef.current) {
      const card = toggleButtonRef.current.closest(".sb-card");
      (card ?? toggleButtonRef.current).scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
    prevExpanded.current = isExpanded;
  }, [isExpanded]);

  // Track the image thumbnail width so we can compute the full-size image's
  // natural height at that width (to detect when it is cropped). Refs must not
  // be read during render, so the width lives in state, kept fresh by an
  // observer.
  useEffect(() => {
    const el = imageButtonRef.current;
    if (!el) return;
    const updateWidth = () => setThumbnailWidth(el.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, [imageUrl]);

  // The image's natural height at the thumbnail's width. If this exceeds the
  // collapsed box height, the image is being cropped from the bottom -> show
  // "View more" so the user can reveal the rest. True for both layouts: the
  // stacked strip crops a tall image exactly like the feed's side thumbnail.
  const fullImageHeight =
    imageNatural && thumbnailWidth > 0
      ? thumbnailWidth * (imageNatural.h / imageNatural.w)
      : 0;
  const imageIsCut =
    !isExpanded && fullImageHeight > collapsedImageHeight + 1;
  const showToggle = isExpanded || isTruncated || imageIsCut;

  return (
    <>
      {/* The text + image are a row when collapsed; the expansion toggle and the
          lightbox button are siblings OUTSIDE this Link so they never navigate.
          The Link itself is a column so an optional header (e.g. a title) sits
          full-width ABOVE the text/image row instead of beside it. */}
      <Link
        href={href}
        prefetch={false}
        className="group flex min-w-0 flex-col"
      >
        {header}
        <div
          className={`flex min-w-0 ${
            isStacked ? "flex-col" : `gap-4 ${isSideRow ? "items-start" : "flex-col"}`
          }`}
          // The fixed minimum height keeps the side-by-side feed rectangle
          // uniform. Stacked cards let the text take its own clamped height, so
          // it must not apply here — otherwise a one-line post leaves a hole
          // under the text.
          style={!isStacked && !isExpanded ? { minHeight: collapsedBodyHeight } : undefined}
        >
          <div className={isSideRow ? "w-1/2 min-w-0" : "w-full min-w-0"}>
            <div className="relative min-w-0 w-full">
              {/* A <div>, not a <p>: the body can be rich content that renders
                  block elements (RichContent is a <div>), and a <div> inside a
                  <p> is invalid HTML — the browser reparents it, which breaks
                  hydration. */}
              <div
                ref={bodyRef}
                className={`mb-3 whitespace-pre-wrap break-words leading-relaxed text-slate-800 [overflow-wrap:anywhere] transition-colors group-hover:text-slate-600 ${
                  isExpanded ? "" : "overflow-hidden"
                } ${textClassName ?? ""}`}
                style={isExpanded ? undefined : lineClampStyle(maxLines)}
              >
                {text}
              </div>
              {/* Hidden, non-clamped copy used purely for truncation
                  measurement. It must share the body's exact text-layout
                  classes so it wraps/breaks identically and gives an accurate
                  height comparison. */}
              <div
                ref={measureRef}
                inert
                aria-hidden="true"
                className="pointer-events-none absolute left-0 top-0 w-full whitespace-pre-wrap break-words leading-relaxed [overflow-wrap:anywhere]"
                style={{ visibility: "hidden" }}
              >
                {text}
              </div>
            </div>
          </div>
          {hasImage && (
            <button
              ref={imageButtonRef}
              type="button"
              aria-label="Open image preview"
              className={`mb-3 self-start cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-left transition hover:opacity-90 dark:bg-slate-900 ${
                isSideRow ? "w-1/2" : "w-full"
              }`}
              style={!isExpanded ? { height: collapsedImageHeight } : undefined}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.nativeEvent?.stopImmediatePropagation();
                setOpenIndex(0);
              }}
            >
              <Image
                src={imageUrl as string}
                alt=""
                width={800}
                height={400}
                unoptimized
                loading={priority ? "eager" : "lazy"}
                onLoad={(e) => {
                  const el = e.currentTarget;
                  if (el.naturalWidth && el.naturalHeight) {
                    setImageNatural({ w: el.naturalWidth, h: el.naturalHeight });
                  }
                }}
                // Side layout: natural aspect ratio, so the image is never
                // distorted — anything taller than the collapsed box is cut off
                // from the bottom only, hinting there is more -> "View more".
                // Stacked collapsed: fill the full-width strip, anchored to the
                // top so it reads like the feed's thumbnail.
                // Expanded: shown at its natural aspect ratio, but capped so a
                // tall screenshot does not take over the whole page.
                className={`block transition duration-200 hover:scale-[1.02] ${
                  isStacked && !isExpanded
                    ? "h-full w-full object-cover object-top"
                    : isExpanded
                      ? "mx-auto h-auto max-h-[300px] w-auto max-w-full"
                      : "h-auto w-full"
                }`}
              />
            </button>
          )}
        </div>
      </Link>

      {showToggle && (
        <button
          ref={toggleButtonRef}
          type="button"
          onClick={(e) => {
            // This button sits OUTSIDE the <Link prefetch={false}>, so it never
            // navigates; this also guards against any parent
            // <Link prefetch={false}>/wrapper bubbling.
            e.preventDefault();
            e.stopPropagation();
            setIsExpanded((current) => !current);
          }}
          className="mt-2 inline-flex text-sm font-semibold text-blue-700 transition hover:text-blue-800 hover:underline dark:text-blue-300 dark:hover:text-blue-200"
        >
          {isExpanded ? "View less" : "View more"}
        </button>
      )}

      {openIndex !== null && (
        <ImageLightbox
          images={[imageUrl as string]}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onNavigate={(idx) => setOpenIndex(idx)}
        />
      )}
    </>
  );
}
